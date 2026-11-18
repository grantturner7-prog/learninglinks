import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepareAccountDeletion } from "@/lib/account/deletion";
import { confirmOrderPaid, createFamilyOrder, createSchoolOrder, listPendingOrdersForAdmin } from "@/lib/billing/orders";
import { getHolderMembership } from "@/lib/billing/orders";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { submitClaim } from "@/lib/orgs/service";
import { TEST_DB_URL, closeTestDb, makeUser, nowPlus, openTestDb, resetTestDb } from "./helpers";

/** What the auth library does for "delete my account": the hook first, then the delete (cascades do the rest). */
async function deleteAccount(db: Db, userId: string) {
  const res = await prepareAccountDeletion(db, userId);
  await db.delete(schema.user).where(eq(schema.user.id, userId));
  return res;
}

describe.skipIf(!TEST_DB_URL)("deleting a school or family account (real Postgres)", () => {
  let db: Db;
  beforeAll(async () => { db = await openTestDb(); });
  beforeEach(async () => { await resetTestDb(db); });
  afterAll(async () => { await closeTestDb(); });

  it("a family: unpaid order cancelled, invoice email erased, paid order kept without a link to the person", async () => {
    const fam = await makeUser(db, "family");
    const admin = await makeUser(db, "educator");
    const paid = await createFamilyOrder(db, fam, { email: "private@example.com" });
    await confirmOrderPaid(db, paid.id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-20" });
    const pending = await createFamilyOrder(db, fam, { email: "private2@example.com", taxId: "22099131", title: "Lin Co" });
    const res = await deleteAccount(db, fam.id);
    expect(res).toEqual({ cancelledOrders: 1, releasedCampuses: 0 });

    expect(await db.select().from(schema.user).where(eq(schema.user.id, fam.id))).toHaveLength(0);
    const [p] = await db.select().from(schema.orders).where(eq(schema.orders.id, paid.id));
    expect(p).toMatchObject({ status: "paid", createdByUserId: null, invoiceEmail: null });
    const [c] = await db.select().from(schema.orders).where(eq(schema.orders.id, pending.id));
    expect(c).toMatchObject({ status: "cancelled", createdByUserId: null, invoiceEmail: null, invoiceTaxId: "22099131", invoiceTitle: "Lin Co" });
    expect(await listPendingOrdersForAdmin(db)).toHaveLength(0); // the admin queue does not show the cancelled order
    const [audit] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "account.deleted"));
    expect(audit?.entityId).toBe(fam.id);
    expect(JSON.stringify(audit?.meta)).not.toMatch(/@/);
  });

  it("a school: the campus nobody else is linked to is released and its jobs close; shared campuses stay claimed", async () => {
    const owner = await makeUser(db, "school");
    const colleague = await makeUser(db, "school");
    const admin = await makeUser(db, "educator");
    const [solo] = await db.insert(schema.organizations).values({ name: "Solo", type: "cram_school", status: "claimed", claimedAt: new Date(), contactEmail: "owner@example.com", contactPhone: "0912345678" }).returning();
    const [shared] = await db.insert(schema.organizations).values({ name: "Shared", type: "cram_school", status: "claimed", claimedAt: new Date() }).returning();
    await db.insert(schema.orgMembers).values([{ organizationId: solo!.id, userId: owner.id, role: "owner" }, { organizationId: shared!.id, userId: owner.id, role: "owner" }, { organizationId: shared!.id, userId: colleague.id, role: "member" }]);
    await confirmOrderPaid(db, (await createSchoolOrder(db, owner, [solo!.id, shared!.id])).id, admin.id, { receivedAmount: 20_000, receivedOn: "2026-11-20" }, nowPlus(-1));
    await db.insert(schema.jobs).values([{ organizationId: solo!.id, title: "Solo job", type: "full_time", status: "open" }, { organizationId: shared!.id, title: "Shared job", type: "full_time", status: "open" }]);
    const [other] = await db.insert(schema.organizations).values({ name: "Other", type: "cram_school" }).returning();
    await submitClaim(db, owner, other!.id, { contactName: "Ms Lin", contactRole: "Director", contactPhone: "0912345678" });

    const res = await deleteAccount(db, owner.id);
    expect(res.releasedCampuses).toBe(1);
    const [s] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, solo!.id));
    expect(s).toMatchObject({ status: "unclaimed", claimedAt: null, contactEmail: null, contactPhone: null });
    const [sh] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, shared!.id));
    expect(sh!.status).toBe("claimed");
    const jobs = await db.select().from(schema.jobs);
    expect(Object.fromEntries(jobs.map((j) => [j.title, j.status]))).toEqual({ "Solo job": "closed", "Shared job": "open" });
    expect(await db.select().from(schema.orgClaims)).toHaveLength(0); // their claims went with them
    expect((await getHolderMembership(db, "org", solo!.id, nowPlus(1))).active).toBe(true); // the paid membership is untouched
    expect(await db.select().from(schema.orgMembers).where(eq(schema.orgMembers.userId, colleague.id))).toHaveLength(1);
  });

  it("their contact requests and reports go with them", async () => {
    const fam = await makeUser(db, "family");
    const edu = await makeUser(db, "educator");
    const [p] = await db.insert(schema.educatorProfiles).values({ userId: edu.id, displayName: "T", status: "published", openTo: ["private_tutoring"] }).returning();
    await db.insert(schema.contactReveals).values({ userId: fam.id, audience: "family", educatorId: p!.id, channels: ["email"] });
    await db.insert(schema.reports).values({ reporterUserId: fam.id, targetType: "educator", targetId: p!.id, reason: "misleading" });
    await deleteAccount(db, fam.id);
    expect(await db.select().from(schema.contactReveals)).toHaveLength(0);
    expect(await db.select().from(schema.reports)).toHaveLength(0);
  });
});
