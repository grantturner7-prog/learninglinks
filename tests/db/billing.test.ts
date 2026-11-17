import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adminCancelOrder, cancelOwnOrder, confirmOrderPaid, createFamilyOrder, createSchoolOrder, findOrderByReference, getHolderMembership, getOrderForUser, listPendingOrdersForAdmin, MAX_PENDING_ORDERS } from "@/lib/billing/orders";
import { getMemberAudience } from "@/lib/directory/service";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { parseJobForm } from "@/lib/jobs/input";
import { closeJob, createJob, listJobsForUser } from "@/lib/jobs/manage";
import { getJobViewer, listOpenJobs, listSchoolPoints } from "@/lib/jobs/service";
import { sendDueReminders } from "@/lib/membership/reminders";
import { addCampusAndClaim, approveClaim, listMyCampuses, listPendingClaims, rejectClaim, searchOrganizations, submitClaim } from "@/lib/orgs/service";
import { listContactsForEducator, revealContact } from "@/lib/reveal/service";
import { TEST_DB_URL, closeTestDb, makeUser, nowPlus, openTestDb, resetTestDb } from "./helpers";
import type { EmailMessage } from "@/lib/email";

const claimInfo = { contactName: "Ms Lin", contactRole: "Director", contactPhone: "0912-345-678" };

async function claimedCampus(db: Db, owner: { id: string }, name: string, extra: Partial<typeof schema.organizations.$inferInsert> = {}) {
  const [org] = await db.insert(schema.organizations).values({ name, type: "cram_school", city: "taichung", district: "taichung:xitun", latitude: 24.17, longitude: 120.62, status: "claimed", claimedAt: new Date(), ...extra }).returning();
  await db.insert(schema.orgMembers).values({ organizationId: org!.id, userId: owner.id, role: "owner" });
  return org!;
}

async function educator(db: Db, name: string, openTo: ("full_time" | "part_time" | "private_tutoring")[]) {
  const u = await makeUser(db, "educator", name);
  const [p] = await db.insert(schema.educatorProfiles).values({ userId: u.id, displayName: name, status: "published", publishedAt: new Date(), openTo, city: "taichung", districts: ["taichung:xitun"], subjects: ["phonics"], levels: ["kindergarten"], languages: ["en"], teachingModes: ["in_person"], workAuthorization: "open_work_rights", rateMin: 600, rateMax: 900 }).returning();
  await db.insert(schema.educatorContacts).values([{ educatorId: p!.id, channel: "email", value: `${name}@secret.example` }, { educatorId: p!.id, channel: "line", value: `${name}-line` }]);
  return { user: u, profile: p! };
}

const form = (o: Record<string, string | string[]>) => ({ get: (k: string) => (typeof o[k] === "string" ? (o[k] as string) : null), getAll: (k: string) => (Array.isArray(o[k]) ? (o[k] as string[]) : []) });
const jobInput = () => parseJobForm(form({ title: "Kindergarten English teacher", type: "full_time", city: "taichung", applyContact: "hr@sunshine.example" })).values;

describe.skipIf(!TEST_DB_URL)("billing, claims, reveals and job posts (real Postgres)", () => {
  let db: Db;
  beforeAll(async () => { db = await openTestDb(); });
  beforeEach(async () => { await resetTestDb(db); });
  afterAll(async () => { await closeTestDb(); });

  describe("family order", () => {
    it("costs NT$2,000, waits for an admin, then gives exactly 12 months", async () => {
      const now = new Date("2026-11-20T04:00:00Z");
      const fam = await makeUser(db, "family");
      const admin = await makeUser(db, "educator", "Admin");
      const order = await createFamilyOrder(db, fam);
      expect(order).toMatchObject({ amount: 2000, status: "pending", currency: "TWD", provider: "bank_transfer", campuses: 1 });
      expect(order.referenceCode).toMatch(/^LL-/);
      expect(await getMemberAudience(db, fam, now)).toBeNull(); // not a member until the money is confirmed

      const res = await confirmOrderPaid(db, order.id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-20" }, now);
      expect(res.created).toBe(true);
      expect(res.terms).toHaveLength(1);
      expect(res.terms[0]!.startsAt).toEqual(now);
      expect(res.terms[0]!.endsAt).toEqual(new Date("2027-11-20T04:00:00Z"));
      expect(await getMemberAudience(db, fam, now)).toBe("family");
      expect(await getMemberAudience(db, fam, new Date("2027-11-20T04:00:00Z"))).toBeNull(); // never auto-renews
      const [audit] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "order.confirmed"));
      expect(audit?.actorUserId).toBe(admin.id);
    });

    it("is not available to a school or an educator account", async () => {
      await expect(createFamilyOrder(db, await makeUser(db, "school"))).rejects.toMatchObject({ code: "wrong_account_type" });
      await expect(createFamilyOrder(db, await makeUser(db, "educator"))).rejects.toMatchObject({ code: "wrong_account_type" });
    });

    it("confirming twice never creates a second membership", async () => {
      const fam = await makeUser(db, "family");
      const admin = await makeUser(db, "educator");
      const o = await createFamilyOrder(db, fam);
      const a = await confirmOrderPaid(db, o.id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-20" });
      const b = await confirmOrderPaid(db, o.id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-20" });
      expect(a.created).toBe(true);
      expect(b.created).toBe(false);
      expect(await db.select().from(schema.memberships)).toHaveLength(1);
    });

    it("survives two admins confirming at the same moment", async () => {
      const fam = await makeUser(db, "family");
      const admin = await makeUser(db, "educator");
      const o = await createFamilyOrder(db, fam);
      const results = await Promise.all([1, 2, 3].map(() => confirmOrderPaid(db, o.id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-20" })));
      expect(results.filter((r) => r.created)).toHaveLength(1);
      expect(await db.select().from(schema.memberships)).toHaveLength(1);
    });

    it("refuses a short or wrong payment and a bad date", async () => {
      const fam = await makeUser(db, "family");
      const admin = await makeUser(db, "educator");
      const o = await createFamilyOrder(db, fam);
      await expect(confirmOrderPaid(db, o.id, admin.id, { receivedAmount: 1500, receivedOn: "2026-11-20" })).rejects.toMatchObject({ code: "amount_mismatch" });
      await expect(confirmOrderPaid(db, o.id, admin.id, { receivedAmount: 2000, receivedOn: "yesterday" })).rejects.toMatchObject({ code: "invalid_date" });
      expect(await db.select().from(schema.memberships)).toHaveLength(0);
      expect((await getOrderForUser(db, fam.id, o.id))?.status).toBe("pending");
    });

    it("renewing early stacks after the current term so no days are lost", async () => {
      const fam = await makeUser(db, "family");
      const admin = await makeUser(db, "educator");
      const t0 = new Date("2026-11-20T04:00:00Z");
      await confirmOrderPaid(db, (await createFamilyOrder(db, fam)).id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-20" }, t0);
      const t1 = new Date("2027-10-20T04:00:00Z"); // a month early
      const second = await confirmOrderPaid(db, (await createFamilyOrder(db, fam)).id, admin.id, { receivedAmount: 2000, receivedOn: "2027-10-20" }, t1);
      expect(second.terms[0]!.startsAt).toEqual(new Date("2027-11-20T04:00:00Z"));
      expect(second.terms[0]!.endsAt).toEqual(new Date("2028-11-20T04:00:00Z"));
      expect((await getHolderMembership(db, "user", fam.id, t1)).endsAt).toEqual(new Date("2028-11-20T04:00:00Z"));
    });

    it("limits how many unpaid orders one person can leave open, and lets them cancel", async () => {
      const fam = await makeUser(db, "family");
      const made = [];
      for (let i = 0; i < MAX_PENDING_ORDERS; i++) made.push(await createFamilyOrder(db, fam));
      await expect(createFamilyOrder(db, fam)).rejects.toMatchObject({ code: "too_many_pending" });
      await cancelOwnOrder(db, fam.id, made[0]!.id);
      await expect(createFamilyOrder(db, fam)).resolves.toBeTruthy();
      await expect(cancelOwnOrder(db, fam.id, made[0]!.id)).rejects.toMatchObject({ code: "not_pending" });
    });

    it("lets only the buyer see their order; admin finds it by the reference quoted", async () => {
      const fam = await makeUser(db, "family");
      const other = await makeUser(db, "family");
      const o = await createFamilyOrder(db, fam, { taxId: "22099131", title: "Chen Co" });
      expect(await getOrderForUser(db, fam.id, o.id)).toMatchObject({ invoice: { taxId: "22099131", title: "Chen Co" } });
      expect(await getOrderForUser(db, other.id, o.id)).toBeNull();
      expect(await getOrderForUser(db, fam.id, "not-a-uuid")).toBeNull();
      const found = await findOrderByReference(db, o.referenceCode.toLowerCase().replace(/-/g, " "));
      expect(found?.id).toBe(o.id);
      expect((await listPendingOrdersForAdmin(db)).map((x) => x.id)).toEqual([o.id]);
      await adminCancelOrder(db, o.id, fam.id);
      expect(await listPendingOrdersForAdmin(db)).toHaveLength(0);
      await expect(confirmOrderPaid(db, o.id, fam.id, { receivedAmount: 2000, receivedOn: "2026-11-20" })).rejects.toMatchObject({ code: "not_pending" });
    });
  });

  describe("school order: NT$10,000 per campus, each campus its own 12 months", () => {
    it("charges 10,000 x campuses with no discount, and starts each campus on its own", async () => {
      const now = new Date("2026-11-20T04:00:00Z");
      const owner = await makeUser(db, "school");
      const admin = await makeUser(db, "educator");
      const a = await claimedCampus(db, owner, "Campus A");
      const b = await claimedCampus(db, owner, "Campus B");
      const c = await claimedCampus(db, owner, "Campus C");
      const order = await createSchoolOrder(db, owner, [a.id, b.id, c.id]);
      expect(order.amount).toBe(30_000);
      expect(order.campuses).toBe(3);
      const res = await confirmOrderPaid(db, order.id, admin.id, { receivedAmount: 30_000, receivedOn: "2026-11-20" }, now);
      expect(res.terms).toHaveLength(3);
      for (const t of res.terms) expect(t.endsAt).toEqual(new Date("2027-11-20T04:00:00Z"));
      for (const camp of [a, b, c]) expect((await getHolderMembership(db, "org", camp.id, now)).active).toBe(true);
    });

    it("a campus added mid-year pays the full 10,000 and gets its own full 12 months", async () => {
      const owner = await makeUser(db, "school");
      const admin = await makeUser(db, "educator");
      const a = await claimedCampus(db, owner, "Campus A");
      const t0 = new Date("2026-11-20T04:00:00Z");
      await confirmOrderPaid(db, (await createSchoolOrder(db, owner, [a.id])).id, admin.id, { receivedAmount: 10_000, receivedOn: "2026-11-20" }, t0);
      const b = await claimedCampus(db, owner, "Campus B");
      const t1 = new Date("2027-05-20T04:00:00Z");
      const second = await createSchoolOrder(db, owner, [b.id]);
      expect(second.amount).toBe(10_000);
      const res = await confirmOrderPaid(db, second.id, admin.id, { receivedAmount: 10_000, receivedOn: "2027-05-20" }, t1);
      expect(res.terms[0]!.startsAt).toEqual(t1);
      expect(res.terms[0]!.endsAt).toEqual(new Date("2028-05-20T04:00:00Z"));
      // Campus A is untouched: still ends Nov 2027.
      expect((await getHolderMembership(db, "org", a.id, t1)).endsAt).toEqual(new Date("2027-11-20T04:00:00Z"));
    });

    it("one campus renewing early stacks only for that campus", async () => {
      const owner = await makeUser(db, "school");
      const admin = await makeUser(db, "educator");
      const a = await claimedCampus(db, owner, "Campus A");
      const t0 = new Date("2026-11-20T04:00:00Z");
      await confirmOrderPaid(db, (await createSchoolOrder(db, owner, [a.id])).id, admin.id, { receivedAmount: 10_000, receivedOn: "2026-11-20" }, t0);
      const t1 = new Date("2027-11-01T04:00:00Z");
      const res = await confirmOrderPaid(db, (await createSchoolOrder(db, owner, [a.id])).id, admin.id, { receivedAmount: 10_000, receivedOn: "2027-11-01" }, t1);
      expect(res.terms[0]!.startsAt).toEqual(new Date("2027-11-20T04:00:00Z"));
    });

    it("only for campuses the buyer belongs to and that an admin has approved", async () => {
      const owner = await makeUser(db, "school");
      const stranger = await makeUser(db, "school");
      const mine = await claimedCampus(db, owner, "Mine");
      const theirs = await claimedCampus(db, stranger, "Theirs");
      const [unclaimed] = await db.insert(schema.organizations).values({ name: "Nobody's", type: "cram_school" }).returning();
      await db.insert(schema.orgMembers).values({ organizationId: unclaimed!.id, userId: owner.id });
      await expect(createSchoolOrder(db, owner, [theirs.id])).rejects.toMatchObject({ code: "campus_not_yours" });
      await expect(createSchoolOrder(db, owner, [mine.id, theirs.id])).rejects.toMatchObject({ code: "campus_not_yours" });
      await expect(createSchoolOrder(db, owner, [unclaimed!.id])).rejects.toMatchObject({ code: "campus_not_claimed" });
      await expect(createSchoolOrder(db, owner, [])).rejects.toMatchObject({ code: "no_campus" });
      await expect(createSchoolOrder(db, await makeUser(db, "family"), [mine.id])).rejects.toMatchObject({ code: "wrong_account_type" });
      await expect(createSchoolOrder(db, owner, [mine.id, mine.id])).resolves.toMatchObject({ amount: 10_000, campuses: 1 }); // duplicates are not charged twice
    });

    it("a paying campus makes the SCHOOL a member (browse schools-side educators)", async () => {
      const owner = await makeUser(db, "school");
      const admin = await makeUser(db, "educator");
      const a = await claimedCampus(db, owner, "Campus A");
      expect(await getMemberAudience(db, owner)).toBeNull();
      await confirmOrderPaid(db, (await createSchoolOrder(db, owner, [a.id])).id, admin.id, { receivedAmount: 10_000, receivedOn: "2026-11-20" });
      expect(await getMemberAudience(db, owner)).toBe("school");
      expect((await listMyCampuses(db, owner.id))[0]?.membership.active).toBe(true);
    });
  });

  describe("claims", () => {
    it("search finds a campus by part of its name and treats % and _ as plain text", async () => {
      await db.insert(schema.organizations).values([{ name: "Sunshine English", type: "cram_school" }, { name: "100% Math", type: "cram_school" }]);
      expect((await searchOrganizations(db, "sunshine")).map((o) => o.name)).toEqual(["Sunshine English"]);
      expect((await searchOrganizations(db, "100%")).map((o) => o.name)).toEqual(["100% Math"]);
      expect(await searchOrganizations(db, "%%")).toHaveLength(0);
      expect(await searchOrganizations(db, "s")).toHaveLength(0); // too short
    });

    it("a claim changes nothing until an admin approves; then the claimant owns the campus", async () => {
      const user = await makeUser(db, "school");
      const admin = await makeUser(db, "educator");
      const [org] = await db.insert(schema.organizations).values({ name: "Sunshine", type: "cram_school", city: "taichung" }).returning();
      const claim = await submitClaim(db, user, org!.id, claimInfo);
      expect(await listMyCampuses(db, user.id)).toHaveLength(0);
      expect(await submitClaim(db, user, org!.id, claimInfo).then((c) => c.id)).toBe(claim.id); // resubmitting is a no-op
      expect(await listPendingClaims(db)).toHaveLength(1);
      await approveClaim(db, claim.id, admin.id);
      expect((await listMyCampuses(db, user.id)).map((c) => c.name)).toEqual(["Sunshine"]);
      const [after] = await db.select().from(schema.organizations).where(eq(schema.organizations.id, org!.id));
      expect(after).toMatchObject({ status: "claimed", contactPhone: "0912345678" });
      await expect(approveClaim(db, claim.id, admin.id)).rejects.toMatchObject({ code: "claim_not_pending" });
      await expect(submitClaim(db, await makeUser(db, "school"), org!.id, claimInfo)).rejects.toMatchObject({ code: "already_claimed" });
    });

    it("approving one of two competing claims rejects the other", async () => {
      const u1 = await makeUser(db, "school");
      const u2 = await makeUser(db, "school");
      const admin = await makeUser(db, "educator");
      const [org] = await db.insert(schema.organizations).values({ name: "Sunshine", type: "cram_school" }).returning();
      const c1 = await submitClaim(db, u1, org!.id, claimInfo);
      await submitClaim(db, u2, org!.id, claimInfo);
      expect((await listPendingClaims(db))[0]!.competing).toBe(1);
      await approveClaim(db, c1.id, admin.id);
      expect(await listPendingClaims(db)).toHaveLength(0);
      expect(await listMyCampuses(db, u2.id)).toHaveLength(0);
      const [row] = await db.select().from(schema.orgClaims).where(and(eq(schema.orgClaims.userId, u2.id)));
      expect(row?.status).toBe("rejected");
    });

    it("only school accounts claim; bad contact details are refused; rejecting works", async () => {
      const [org] = await db.insert(schema.organizations).values({ name: "Sunshine", type: "cram_school" }).returning();
      await expect(submitClaim(db, await makeUser(db, "family"), org!.id, claimInfo)).rejects.toMatchObject({ code: "wrong_account_type" });
      const u = await makeUser(db, "school");
      await expect(submitClaim(db, u, org!.id, { ...claimInfo, contactPhone: "123" })).rejects.toMatchObject({ code: "invalid_phone" });
      await expect(submitClaim(db, u, org!.id, { ...claimInfo, contactName: "" })).rejects.toMatchObject({ code: "invalid_name" });
      await expect(submitClaim(db, u, "nope", claimInfo)).rejects.toMatchObject({ code: "not_found" });
      const claim = await submitClaim(db, u, org!.id, claimInfo);
      await rejectClaim(db, claim.id, u.id);
      await expect(rejectClaim(db, claim.id, u.id)).rejects.toMatchObject({ code: "claim_not_pending" });
    });

    it("a campus missing from our data is added unclaimed, pinned at the district centre, and reviewed like any claim", async () => {
      const u = await makeUser(db, "school");
      const admin = await makeUser(db, "educator");
      const { organization, claim } = await addCampusAndClaim(db, u, { ...claimInfo, name: "Little Birds Academy", type: "language_school", city: "taichung", district: "taichung:xitun", website: "https://birds.example" });
      expect(organization).toMatchObject({ status: "unclaimed", source: "manual", district: "taichung:xitun" });
      expect(organization.latitude).toBeGreaterThan(24);
      expect(organization.address).toBeNull(); // never a street address
      await approveClaim(db, claim.id, admin.id);
      expect((await listMyCampuses(db, u.id))[0]?.name).toBe("Little Birds Academy");
      await expect(addCampusAndClaim(db, u, { ...claimInfo, name: "X Y", type: "zoo", city: "taichung" })).rejects.toMatchObject({ code: "invalid_type" });
      await expect(addCampusAndClaim(db, u, { ...claimInfo, name: "X Y", type: "cram_school", city: "atlantis" })).rejects.toMatchObject({ code: "invalid_city" });
      await expect(addCampusAndClaim(db, u, { ...claimInfo, name: "X Y", type: "cram_school", city: "taichung", district: "taipei:daan" })).rejects.toMatchObject({ code: "invalid_district" });
    });
  });

  describe("contact reveal", () => {
    async function paidFamily(now: Date) {
      const fam = await makeUser(db, "family");
      const admin = await makeUser(db, "educator");
      await confirmOrderPaid(db, (await createFamilyOrder(db, fam)).id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-20" }, nowPlus(-1, now));
      return fam;
    }
    async function paidSchool(now: Date, names = ["Campus A"]) {
      const owner = await makeUser(db, "school");
      const admin = await makeUser(db, "educator");
      const camps = [];
      for (const n of names) camps.push(await claimedCampus(db, owner, n));
      await confirmOrderPaid(db, (await createSchoolOrder(db, owner, camps.map((c) => c.id))).id, admin.id, { receivedAmount: 10_000 * camps.length, receivedOn: "2026-11-20" }, nowPlus(-1, now));
      return { owner, camps };
    }

    it("gives a paying family a tutor's contact and logs it; the educator sees 'a family', never who", async () => {
      const now = new Date();
      const fam = await paidFamily(now);
      const tutor = await educator(db, "Tutor", ["private_tutoring"]);
      const res = await revealContact(db, fam, tutor.profile.id, { dailyCap: 10, now });
      expect(res).toMatchObject({ ok: true, alreadyRevealed: false });
      if (res.ok) expect(res.channels.map((c) => c.channel).sort()).toEqual(["email", "line"]);
      const seen = await listContactsForEducator(db, tutor.user.id);
      expect(seen).toHaveLength(1);
      expect(seen[0]).toMatchObject({ audience: "family", school: null });
      expect(JSON.stringify(seen)).not.toContain(fam.id);
    });

    it("names the school to the educator when a school asks", async () => {
      const now = new Date();
      const { owner } = await paidSchool(now, ["Sunshine Kindergarten"]);
      const teacher = await educator(db, "Teacher", ["full_time"]);
      await revealContact(db, owner, teacher.profile.id, { dailyCap: 10, now });
      const seen = await listContactsForEducator(db, teacher.user.id);
      expect(seen[0]?.school?.name).toBe("Sunshine Kindergarten");
      expect(seen[0]?.audience).toBe("school");
    });

    it("refuses anyone without an active membership, and every non-member type", async () => {
      const now = new Date();
      const tutor = await educator(db, "Tutor", ["private_tutoring", "full_time"]);
      for (const type of ["family", "school", "educator"] as const) {
        const u = await makeUser(db, type);
        expect(await revealContact(db, u, tutor.profile.id, { dailyCap: 10, now })).toEqual({ ok: false, reason: "no_membership" });
      }
      const lapsed = await makeUser(db, "family");
      const [o] = await db.insert(schema.orders).values({ holderType: "user", holderId: lapsed.id, planCode: "family_tw", amount: 2000, currency: "TWD", countryCode: "TW", status: "paid", provider: "bank_transfer", referenceCode: "LL-LAPS-EDXX", createdByUserId: lapsed.id }).returning();
      await db.insert(schema.memberships).values({ holderType: "user", holderId: lapsed.id, orderId: o!.id, planCode: "family_tw", startsAt: nowPlus(-400, now), endsAt: nowPlus(-35, now) });
      expect(await revealContact(db, lapsed, tutor.profile.id, { dailyCap: 10, now })).toEqual({ ok: false, reason: "no_membership" });
      expect(await db.select().from(schema.contactReveals)).toHaveLength(0);
    });

    it("never crosses sides: families get no school-only educator, schools get no tutor-only educator", async () => {
      const now = new Date();
      const fam = await paidFamily(now);
      const { owner } = await paidSchool(now);
      const schoolOnly = await educator(db, "SchoolOnly", ["full_time"]);
      const tutorOnly = await educator(db, "TutorOnly", ["private_tutoring"]);
      expect(await revealContact(db, fam, schoolOnly.profile.id, { dailyCap: 10, now })).toEqual({ ok: false, reason: "unavailable" });
      expect(await revealContact(db, owner, tutorOnly.profile.id, { dailyCap: 10, now })).toEqual({ ok: false, reason: "unavailable" });
      expect(await db.select().from(schema.contactReveals)).toHaveLength(0);
    });

    it("never reveals a draft, hidden or suspended educator", async () => {
      const now = new Date();
      const fam = await paidFamily(now);
      for (const status of ["draft", "hidden", "suspended"] as const) {
        const e = await educator(db, status, ["private_tutoring"]);
        await db.update(schema.educatorProfiles).set({ status }).where(eq(schema.educatorProfiles.id, e.profile.id));
        expect(await revealContact(db, fam, e.profile.id, { dailyCap: 10, now })).toEqual({ ok: false, reason: "unavailable" });
      }
    });

    it("enforces the daily cap on distinct educators; viewing the same one again is free", async () => {
      const now = new Date("2026-11-20T04:00:00Z");
      const fam = await paidFamily(now);
      const [a, b, c] = [await educator(db, "A", ["private_tutoring"]), await educator(db, "B", ["private_tutoring"]), await educator(db, "C", ["private_tutoring"])];
      expect((await revealContact(db, fam, a.profile.id, { dailyCap: 2, now })).ok).toBe(true);
      expect((await revealContact(db, fam, b.profile.id, { dailyCap: 2, now })).ok).toBe(true);
      expect(await revealContact(db, fam, c.profile.id, { dailyCap: 2, now })).toEqual({ ok: false, reason: "daily_cap" });
      const again = await revealContact(db, fam, a.profile.id, { dailyCap: 2, now });
      expect(again).toMatchObject({ ok: true, alreadyRevealed: true });
      expect(await db.select().from(schema.contactReveals)).toHaveLength(2); // the repeat logged nothing
      // Next Taipei day the cap resets.
      expect((await revealContact(db, fam, c.profile.id, { dailyCap: 2, now: nowPlus(1, now) })).ok).toBe(true);
    });

    it("counts the day in Taipei time, not UTC", async () => {
      const fam = await paidFamily(new Date("2026-11-20T00:00:00Z"));
      const [a, b] = [await educator(db, "A", ["private_tutoring"]), await educator(db, "B", ["private_tutoring"])];
      // 15:30 UTC on the 20th is 23:30 in Taipei (still the 20th); 16:30 UTC is 00:30 on the 21st.
      expect((await revealContact(db, fam, a.profile.id, { dailyCap: 1, now: new Date("2026-11-20T15:30:00Z") })).ok).toBe(true);
      expect(await revealContact(db, fam, b.profile.id, { dailyCap: 1, now: new Date("2026-11-20T15:45:00Z") })).toEqual({ ok: false, reason: "daily_cap" });
      expect((await revealContact(db, fam, b.profile.id, { dailyCap: 1, now: new Date("2026-11-20T16:30:00Z") })).ok).toBe(true);
    });

    it("cannot be beaten by firing many requests at once", async () => {
      const now = new Date("2026-11-20T04:00:00Z");
      const fam = await paidFamily(now);
      const tutors = [];
      for (let i = 0; i < 8; i++) tutors.push(await educator(db, `T${i}`, ["private_tutoring"]));
      const results = await Promise.all(tutors.map((t) => revealContact(db, fam, t.profile.id, { dailyCap: 3, now })));
      expect(results.filter((r) => r.ok)).toHaveLength(3);
      expect(await db.select().from(schema.contactReveals)).toHaveLength(3);
    });

    it("a school's cap is per campus; a campus you do not belong to is refused", async () => {
      const now = new Date("2026-11-20T04:00:00Z");
      const { owner, camps } = await paidSchool(now, ["Campus A", "Campus B"]);
      const outsider = await paidSchool(now, ["Someone else"]);
      const [a, b] = [await educator(db, "A", ["part_time"]), await educator(db, "B", ["part_time"])];
      expect((await revealContact(db, owner, a.profile.id, { dailyCap: 1, now, organizationId: camps[0]!.id })).ok).toBe(true);
      expect(await revealContact(db, owner, b.profile.id, { dailyCap: 1, now, organizationId: camps[0]!.id })).toEqual({ ok: false, reason: "daily_cap" });
      expect((await revealContact(db, owner, b.profile.id, { dailyCap: 1, now, organizationId: camps[1]!.id })).ok).toBe(true);
      expect(await revealContact(db, owner, b.profile.id, { dailyCap: 5, now, organizationId: outsider.camps[0]!.id })).toEqual({ ok: false, reason: "not_a_member" });
    });

    it("an educator who has been deleted leaves nothing to reveal", async () => {
      const now = new Date();
      const fam = await paidFamily(now);
      const t = await educator(db, "Gone", ["private_tutoring"]);
      await db.delete(schema.user).where(eq(schema.user.id, t.user.id));
      expect(await revealContact(db, fam, t.profile.id, { dailyCap: 5, now })).toEqual({ ok: false, reason: "unavailable" });
    });
  });

  describe("job posts", () => {
    async function paidCampus(now = new Date()) {
      const owner = await makeUser(db, "school");
      const admin = await makeUser(db, "educator");
      const camp = await claimedCampus(db, owner, "Sunshine");
      await confirmOrderPaid(db, (await createSchoolOrder(db, owner, [camp.id])).id, admin.id, { receivedAmount: 10_000, receivedOn: "2026-11-20" }, nowPlus(-1, now));
      return { owner, camp };
    }
    const viewer = async () => getJobViewer(db, (await educator(db, "Reader", ["full_time"])).user);

    it("needs an active membership on that campus", async () => {
      const owner = await makeUser(db, "school");
      const camp = await claimedCampus(db, owner, "Unpaid");
      await expect(createJob(db, owner, camp.id, jobInput())).rejects.toMatchObject({ code: "no_membership" });
    });

    it("only a member of the campus, and only a school account, can post or close", async () => {
      const { owner, camp } = await paidCampus();
      const stranger = await makeUser(db, "school");
      await expect(createJob(db, stranger, camp.id, jobInput())).rejects.toMatchObject({ code: "not_a_member" });
      await expect(createJob(db, await makeUser(db, "family"), camp.id, jobInput())).rejects.toMatchObject({ code: "wrong_account_type" });
      const job = await createJob(db, owner, camp.id, jobInput());
      await expect(closeJob(db, stranger, job.id)).rejects.toMatchObject({ code: "not_a_member" });
      await closeJob(db, owner, job.id);
      await closeJob(db, owner, job.id); // harmless twice
      expect((await listJobsForUser(db, owner.id))[0]?.status).toBe("closed");
    });

    it("an open post shows to a signed-in educator with a profile on the board and on the map, and nobody else", async () => {
      const { owner, camp } = await paidCampus();
      await createJob(db, owner, camp.id, jobInput());
      const v = await viewer();
      expect((await listOpenJobs(db, v)).items.map((j) => j.title)).toEqual(["Kindergarten English teacher"]);
      expect((await listSchoolPoints(db, v)).find((p) => p.id === camp.id)?.jobs).toBe(1);
      const noProfile = await getJobViewer(db, await makeUser(db, "educator"));
      const family = await getJobViewer(db, await makeUser(db, "family"));
      const school = await getJobViewer(db, owner);
      for (const nobody of [null, noProfile, family, school]) {
        expect((await listOpenJobs(db, nobody)).items).toHaveLength(0);
        expect(await listSchoolPoints(db, nobody)).toHaveLength(0);
      }
    });

    it("posts vanish when the campus's 12 months end, and come back when it renews", async () => {
      const { owner, camp } = await paidCampus();
      await createJob(db, owner, camp.id, jobInput());
      const v = await viewer();
      const later = nowPlus(400);
      expect((await listOpenJobs(db, v, {}, later)).items).toHaveLength(0);
      expect((await listSchoolPoints(db, v, {}, later)).find((p) => p.id === camp.id)?.jobs).toBe(0);
      const admin = await makeUser(db, "educator");
      await confirmOrderPaid(db, (await createSchoolOrder(db, owner, [camp.id])).id, admin.id, { receivedAmount: 10_000, receivedOn: "2027-12-20" }, later);
      expect((await listOpenJobs(db, v, {}, nowPlus(401))).items).toHaveLength(1);
    });

    it("caps how many posts one campus can have open", async () => {
      const { owner, camp } = await paidCampus();
      for (let i = 0; i < 20; i++) await createJob(db, owner, camp.id, jobInput());
      await expect(createJob(db, owner, camp.id, jobInput())).rejects.toMatchObject({ code: "too_many_open" });
      const [first] = await listJobsForUser(db, owner.id);
      await closeJob(db, owner, first!.id);
      await expect(createJob(db, owner, camp.id, jobInput())).resolves.toBeTruthy();
    });
  });

  describe("renewal reminders", () => {
    const capture = () => {
      const sent: EmailMessage[] = [];
      return { sent, send: async (m: EmailMessage) => void sent.push(m) };
    };
    async function familyEndingIn(days: number, now: Date) {
      const fam = await makeUser(db, "family");
      const [o] = await db.insert(schema.orders).values({ holderType: "user", holderId: fam.id, planCode: "family_tw", amount: 2000, currency: "TWD", countryCode: "TW", status: "paid", provider: "bank_transfer", referenceCode: `LL-T${Math.floor(Math.random() * 1e6)}`, createdByUserId: fam.id }).returning();
      await db.insert(schema.memberships).values({ holderType: "user", holderId: fam.id, orderId: o!.id, planCode: "family_tw", startsAt: nowPlus(days - 365, now), endsAt: nowPlus(days, now) });
      return fam;
    }

    it("sends each reminder once, and says it never renews by itself", async () => {
      const now = new Date("2027-01-10T01:00:00Z");
      await familyEndingIn(29, now);
      const { sent, send } = capture();
      expect(await sendDueReminders(db, now, send)).toMatchObject({ sent: 1, failed: 0 });
      expect(await sendDueReminders(db, now, send)).toMatchObject({ sent: 0 });
      expect(sent).toHaveLength(1);
      expect(sent[0]!.text).toMatch(/never|不會自動/);
      expect(sent[0]!.text).toMatch(/background checks/i); // the compliance notice rides along
      expect(sent[0]!.text).toContain("背景");
      // Later, at 6 days, the 7-day reminder is due.
      expect(await sendDueReminders(db, nowPlus(23, now), send)).toMatchObject({ sent: 1 });
    });

    it("stays quiet when the membership is far off, already renewed or long gone", async () => {
      const now = new Date("2027-01-10T01:00:00Z");
      await familyEndingIn(200, now);
      await familyEndingIn(-30, now);
      const renewed = await familyEndingIn(20, now);
      const [o] = await db.select().from(schema.orders).where(eq(schema.orders.holderId, renewed.id));
      await db.insert(schema.memberships).values({ holderType: "user", holderId: renewed.id, orderId: o!.id, planCode: "family_tw", startsAt: nowPlus(20, now), endsAt: nowPlus(385, now) });
      const { sent, send } = capture();
      expect((await sendDueReminders(db, now, send)).sent).toBe(0);
      expect(sent).toHaveLength(0);
    });

    it("emails the campus owners, and tries again later if sending fails", async () => {
      const now = new Date("2027-01-10T01:00:00Z");
      const owner = await makeUser(db, "school", "Owner");
      const camp = await claimedCampus(db, owner, "Sunshine");
      const [o] = await db.insert(schema.orders).values({ holderType: "user", holderId: owner.id, planCode: "school_tw", amount: 10000, currency: "TWD", countryCode: "TW", status: "paid", provider: "bank_transfer", referenceCode: "LL-SCHL-TEST", createdByUserId: owner.id }).returning();
      await db.insert(schema.memberships).values({ holderType: "org", holderId: camp.id, orderId: o!.id, planCode: "school_tw", startsAt: nowPlus(-340, now), endsAt: nowPlus(5, now) });
      expect(await sendDueReminders(db, now, async () => { throw new Error("provider down"); })).toMatchObject({ sent: 0, failed: 1 });
      const { sent, send } = capture();
      expect(await sendDueReminders(db, now, send)).toMatchObject({ sent: 1 });
      expect(sent[0]!.to).toBe(`${owner.id}@example.com`);
      expect(sent[0]!.text).toContain("Sunshine");
    });
  });
});
