import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { confirmOrderPaid, createFamilyOrder, createSchoolOrder, getHolderMembership, getOrderForUser, OrderFailure } from "@/lib/billing/orders";
import { getOrderRefundState, listRecentPaidOrders, refundAndEnd, type RefundInput } from "@/lib/billing/refunds";
import { getMemberAudience } from "@/lib/directory/service";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { EmailMessage } from "@/lib/email";
import { sendRefundEmail } from "@/lib/billing/paid-email";
import { getOutbox } from "@/lib/email";
import { sendDueReminders } from "@/lib/membership/reminders";
import { TEST_DB_URL, closeTestDb, makeUser, nowPlus, openTestDb, resetTestDb } from "./helpers";

const NOW = new Date("2026-11-20T04:00:00Z");

async function claimedCampus(db: Db, owner: { id: string }, name: string) {
  const [org] = await db.insert(schema.organizations).values({ name, type: "cram_school", city: "taichung", district: "taichung:xitun", latitude: 24.17, longitude: 120.62, status: "claimed", claimedAt: new Date() }).returning();
  await db.insert(schema.orgMembers).values({ organizationId: org!.id, userId: owner.id, role: "owner" });
  return org!;
}

const refund = (o: Partial<RefundInput> = {}): RefundInput => ({ requestId: randomUUID(), amount: 0, method: null, refundedOn: null, reason: "Paid by mistake", endMembershipIds: [], ...o });

async function expectFailure(p: Promise<unknown>, code: string) {
  const err = await p.then(() => null, (e: unknown) => e);
  expect(err, `expected ${code}`).toBeInstanceOf(OrderFailure);
  expect((err as OrderFailure).code).toBe(code);
}

describe.skipIf(!TEST_DB_URL)("refunds and ending memberships early (real Postgres)", () => {
  let db: Db;
  beforeAll(async () => { db = await openTestDb(); });
  beforeEach(async () => { await resetTestDb(db); });
  afterAll(async () => { await closeTestDb(); });

  async function paidFamily() {
    const fam = await makeUser(db, "family");
    const admin = await makeUser(db, "educator", "Admin");
    const order = await createFamilyOrder(db, fam, undefined, "ecpay");
    await confirmOrderPaid(db, order.id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-20" }, NOW);
    const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.orderId, order.id));
    return { fam, admin, order, membership: m! };
  }

  async function paidSchool(campusCount: number) {
    const owner = await makeUser(db, "school");
    const admin = await makeUser(db, "educator", "Admin");
    const campuses = [];
    for (let i = 0; i < campusCount; i++) campuses.push(await claimedCampus(db, owner, `Campus ${i + 1}`));
    const order = await createSchoolOrder(db, owner, campuses.map((c) => c.id));
    await confirmOrderPaid(db, order.id, admin.id, { receivedAmount: 10_000 * campusCount, receivedOn: "2026-11-20" }, NOW);
    const memberships = await db.select().from(schema.memberships).where(eq(schema.memberships.orderId, order.id));
    return { owner, admin, campuses, order, memberships };
  }

  it("refunds a family in full and ends the membership at once", async () => {
    const { fam, admin, order, membership } = await paidFamily();
    expect(await getMemberAudience(db, fam, NOW)).toBe("family");

    const later = new Date(NOW.getTime() + 3 * 3_600_000);
    const res = await refundAndEnd(db, order.id, admin.id, refund({ amount: 2000, method: "ecpay_backoffice", refundedOn: "2026-11-20", reason: "Paid twice by mistake", endMembershipIds: [membership.id] }), later);
    expect(res).toMatchObject({ applied: true, refunded: 2000, totalRefunded: 2000 });
    expect(res.ended).toHaveLength(1);

    // The family is no longer a member the moment it is recorded, and cannot see educators.
    expect(await getMemberAudience(db, fam, later)).toBeNull();
    expect((await getHolderMembership(db, "user", fam.id, later)).active).toBe(false);

    const [m] = await db.select().from(schema.memberships).where(eq(schema.memberships.id, membership.id));
    expect(m).toMatchObject({ endedEarlyBy: admin.id, endedEarlyReason: "Paid twice by mistake" });
    expect(m!.endsAt).toEqual(later);
    expect(m!.originalEndsAt).toEqual(new Date("2027-11-20T04:00:00Z"));

    // The order stays "paid" (it was paid), and the state is read from the refund rows.
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
    expect(o!.status).toBe("paid");
    const state = await getOrderRefundState(db, order.id, later);
    expect(state).toMatchObject({ paid: 2000, refunded: 2000, refundable: 0 });
    expect(state!.memberships[0]).toMatchObject({ state: "ended_early", endedEarlyReason: "Paid twice by mistake" });

    // The buyer's own view carries what they need to see.
    const view = await getOrderForUser(db, fam.id, order.id);
    expect(view).toMatchObject({ status: "paid", refundedAmount: 2000 });
    expect(view!.membershipEndedAt).toEqual(later);

    const refunds = await db.select().from(schema.orderRefunds).where(eq(schema.orderRefunds.orderId, order.id));
    expect(refunds).toHaveLength(1);
    expect(refunds[0]).toMatchObject({ amount: 2000, method: "ecpay_backoffice", refundedOn: "2026-11-20", createdBy: admin.id });
    const actions = (await db.select().from(schema.auditLog)).map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(["order.refunded", "membership.ended_early"]));
  });

  it("records the same request only once (double click, retry)", async () => {
    const { admin, order, membership } = await paidFamily();
    const input = refund({ amount: 2000, method: "bank_transfer", refundedOn: "2026-11-21", endMembershipIds: [membership.id] });
    const first = await refundAndEnd(db, order.id, admin.id, input, nowPlus(1, NOW));
    const second = await refundAndEnd(db, order.id, admin.id, input, nowPlus(1, NOW));
    expect(first.applied).toBe(true);
    expect(second).toMatchObject({ applied: false, refunded: 0, totalRefunded: 2000 });
    expect(await db.select().from(schema.orderRefunds)).toHaveLength(1);
    expect((await db.select().from(schema.auditLog)).filter((a) => a.action === "order.refunded")).toHaveLength(1);
  });

  it("two admins refunding at the same moment cannot refund more than was paid", async () => {
    const { admin, order } = await paidFamily();
    const results = await Promise.allSettled([
      refundAndEnd(db, order.id, admin.id, refund({ amount: 2000, method: "ecpay_backoffice", refundedOn: "2026-11-20" }), nowPlus(1, NOW)),
      refundAndEnd(db, order.id, admin.id, refund({ amount: 2000, method: "ecpay_backoffice", refundedOn: "2026-11-20" }), nowPlus(1, NOW)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as OrderFailure).code).toBe("too_much");
    expect((await getOrderRefundState(db, order.id, NOW))!.refunded).toBe(2000);
  });

  it("allows partial refunds that add up, and refuses more than is left", async () => {
    const { admin, order } = await paidFamily();
    const at = nowPlus(2, NOW);
    await refundAndEnd(db, order.id, admin.id, refund({ amount: 500, method: "bank_transfer", refundedOn: "2026-11-22" }), at);
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ amount: 1600, method: "bank_transfer", refundedOn: "2026-11-22" }), at), "too_much");
    const res = await refundAndEnd(db, order.id, admin.id, refund({ amount: 1500, method: "bank_transfer", refundedOn: "2026-11-22" }), at);
    expect(res.totalRefunded).toBe(2000);
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ amount: 1, method: "bank_transfer", refundedOn: "2026-11-22" }), at), "too_much");
  });

  it("can refund without ending the membership (goodwill), and the family keeps access", async () => {
    const { fam, admin, order } = await paidFamily();
    const at = nowPlus(2, NOW);
    await refundAndEnd(db, order.id, admin.id, refund({ amount: 500, method: "other", refundedOn: "2026-11-22", reason: "Goodwill" }), at);
    expect(await getMemberAudience(db, fam, at)).toBe("family");
    expect((await getOrderForUser(db, fam.id, order.id))!.membershipEndedAt).toBeNull();
  });

  it("can end a membership without any refund", async () => {
    const { fam, admin, order, membership } = await paidFamily();
    const at = nowPlus(2, NOW);
    const res = await refundAndEnd(db, order.id, admin.id, refund({ reason: "Shared the account", endMembershipIds: [membership.id] }), at);
    expect(res).toMatchObject({ applied: true, refunded: 0 });
    expect(await getMemberAudience(db, fam, at)).toBeNull();
    expect(await db.select().from(schema.orderRefunds)).toHaveLength(0);
    expect((await db.select().from(schema.auditLog)).map((a) => a.action)).toContain("membership.ended_early");
    // A second try to end it is refused: it has already ended.
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ endMembershipIds: [membership.id] }), at), "membership_not_active");
  });

  it("ends one campus of a school order and leaves the others running", async () => {
    const { owner, admin, campuses, order, memberships } = await paidSchool(3);
    expect(memberships).toHaveLength(3);
    const target = memberships.find((m) => m.holderId === campuses[1]!.id)!;
    const at = nowPlus(5, NOW);
    await refundAndEnd(db, order.id, admin.id, refund({ amount: 10_000, method: "ecpay_backoffice", refundedOn: "2026-11-25", reason: "Campus closed", endMembershipIds: [target.id] }), at);

    expect((await getHolderMembership(db, "org", campuses[1]!.id, at)).active).toBe(false);
    expect((await getHolderMembership(db, "org", campuses[0]!.id, at)).active).toBe(true);
    expect((await getHolderMembership(db, "org", campuses[2]!.id, at)).active).toBe(true);
    expect(await getMemberAudience(db, owner, at)).toBe("school"); // still has two running campuses

    const state = await getOrderRefundState(db, order.id, at);
    expect(state).toMatchObject({ paid: 30_000, refunded: 10_000, refundable: 20_000 });
    expect(state!.memberships.map((m) => [m.campus, m.state])).toEqual([["Campus 1", "active"], ["Campus 2", "ended_early"], ["Campus 3", "active"]]);
  });

  it("refuses what is not allowed", async () => {
    const { fam, admin, order, membership } = await paidFamily();
    const at = nowPlus(1, NOW);
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ reason: "   " }), at), "reason_required");
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ amount: -5, method: "other", refundedOn: "2026-11-21" }), at), "invalid_amount");
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ amount: 10.5, method: "other", refundedOn: "2026-11-21" }), at), "invalid_amount");
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ amount: 100 }), at), "method_required");
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ amount: 100, method: "other", refundedOn: "yesterday" }), at), "invalid_date");
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({}), at), "nothing_to_do");
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ requestId: "x" , amount: 100, method: "other", refundedOn: "2026-11-21" }), at), "invalid_request");
    await expectFailure(refundAndEnd(db, randomUUID(), admin.id, refund({ amount: 100, method: "other", refundedOn: "2026-11-21" }), at), "not_found");
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ endMembershipIds: [randomUUID()] }), at), "membership_not_found");

    // A membership from a different order cannot be ended through this one.
    const other = await paidFamily();
    await expectFailure(refundAndEnd(db, order.id, admin.id, refund({ endMembershipIds: [other.membership.id] }), at), "membership_not_found");

    // Nothing above changed anything.
    expect(await db.select().from(schema.orderRefunds)).toHaveLength(0);
    expect(await getMemberAudience(db, fam, at)).toBe("family");
    expect(membership.endedEarlyAt).toBeNull();
  });

  it("only a paid order can be refunded", async () => {
    const fam = await makeUser(db, "family");
    const admin = await makeUser(db, "educator", "Admin");
    const pending = await createFamilyOrder(db, fam);
    await expectFailure(refundAndEnd(db, pending.id, admin.id, refund({ amount: 100, method: "other", refundedOn: "2026-11-21" }), NOW), "not_paid");
  });

  it("a term bought in advance (not started yet) can be ended too, and the table rules still hold", async () => {
    const { fam, admin, order, membership } = await paidFamily();
    // The family renews early: a second order stacks a term after the first.
    const second = await createFamilyOrder(db, fam);
    const day10 = nowPlus(10, NOW);
    await confirmOrderPaid(db, second.id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-30" }, day10);
    const [next] = await db.select().from(schema.memberships).where(eq(schema.memberships.orderId, second.id));
    expect(next!.startsAt).toEqual(membership.endsAt); // starts when the first ends

    const at = nowPlus(11, NOW);
    await refundAndEnd(db, second.id, admin.id, refund({ amount: 2000, method: "bank_transfer", refundedOn: "2026-12-01", reason: "Renewed by mistake", endMembershipIds: [next!.id] }), at);
    const [after] = await db.select().from(schema.memberships).where(eq(schema.memberships.id, next!.id));
    expect(after!.endsAt).toEqual(at);
    expect(after!.startsAt < after!.endsAt).toBe(true);
    // The first term is untouched and still running.
    expect(await getMemberAudience(db, fam, at)).toBe("family");
    expect((await getOrderRefundState(db, second.id, at))!.memberships[0]!.state).toBe("ended_early");
    expect((await getOrderRefundState(db, order.id, at))!.memberships[0]!.state).toBe("active");
  });

  it("renewing after an early end starts from now, not from the old end date", async () => {
    const { fam, admin, order, membership } = await paidFamily();
    const at = nowPlus(30, NOW);
    await refundAndEnd(db, order.id, admin.id, refund({ endMembershipIds: [membership.id], reason: "Ended at the family's request" }), at);
    const again = await createFamilyOrder(db, fam);
    const res = await confirmOrderPaid(db, again.id, admin.id, { receivedAmount: 2000, receivedOn: "2026-12-20" }, nowPlus(31, NOW));
    expect(res.terms[0]!.startsAt).toEqual(nowPlus(31, NOW));
    expect(await getMemberAudience(db, fam, nowPlus(32, NOW))).toBe("family");
  });

  it("an early-ended membership never gets a renewal reminder", async () => {
    // Two families, both ending in 5 days; one is ended early (refund) the moment before the reminder run.
    const a = await makeUser(db, "family", "A");
    const b = await makeUser(db, "family", "B");
    const admin = await makeUser(db, "educator", "Admin");
    const start = nowPlus(-360, NOW);
    const orders = [];
    for (const u of [a, b]) {
      const o = await createFamilyOrder(db, u);
      await confirmOrderPaid(db, o.id, admin.id, { receivedAmount: 2000, receivedOn: "2025-11-25" }, start);
      orders.push(o);
    }
    const [mA] = await db.select().from(schema.memberships).where(eq(schema.memberships.orderId, orders[0]!.id));
    await refundAndEnd(db, orders[0]!.id, admin.id, refund({ amount: 2000, method: "ecpay_backoffice", refundedOn: "2026-11-20", endMembershipIds: [mA!.id] }), NOW);

    const sent: EmailMessage[] = [];
    const report = await sendDueReminders(db, NOW, async (m) => { sent.push(m); });
    expect(report.sent).toBe(1);
    expect(sent).toHaveLength(1);
    const to = (await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, b.id)))[0]!.email;
    expect(sent[0]!.to).toBe(to);
  });

  it("lists the latest paid orders for the admin, with what was refunded", async () => {
    const { admin, order } = await paidFamily();
    await refundAndEnd(db, order.id, admin.id, refund({ amount: 700, method: "other", refundedOn: "2026-11-21" }), nowPlus(1, NOW));
    const list = await listRecentPaidOrders(db, 5);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ referenceCode: order.referenceCode, amount: 2000, refunded: 700 });
  });

  it("emails the buyer what was done, and reports honestly when there is nobody to email", async () => {
    const { fam, admin, order, membership } = await paidFamily();
    const at = nowPlus(1, NOW);
    const res = await refundAndEnd(db, order.id, admin.id, refund({ amount: 2000, method: "ecpay_backoffice", refundedOn: "2026-11-21", endMembershipIds: [membership.id] }), at);
    getOutbox().length = 0;
    expect(await sendRefundEmail(db, res, at)).toBe("sent");
    const [mail] = getOutbox();
    const [buyer] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, fam.id));
    expect(mail!.to).toBe(buyer!.email);
    expect(mail!.text).toContain(order.referenceCode);

    // The buyer deleted their account: the order stays as a record, with no person to write to.
    await db.update(schema.orders).set({ createdByUserId: null }).where(eq(schema.orders.id, order.id));
    getOutbox().length = 0;
    expect(await sendRefundEmail(db, res, at)).toBe("none");
    expect(getOutbox()).toHaveLength(0);
    // And nothing to say means nothing sent.
    expect(await sendRefundEmail(db, { ...res, refunded: 0, ended: [] }, at)).toBe("none");
  });
});
