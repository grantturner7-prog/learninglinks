import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { confirmOrderPaid, createFamilyOrder, createSchoolOrder } from "@/lib/billing/orders";
import { getMemberAudience, searchEducators } from "@/lib/directory/service";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { parseJobForm } from "@/lib/jobs/input";
import { createJob } from "@/lib/jobs/manage";
import { getJobViewer, getSchoolWithJobs, listOpenJobs, listSchoolPoints } from "@/lib/jobs/service";
import { listOpenReports, listSuspended, ModerationFailure, reinstate, resolveReport, submitReport } from "@/lib/moderation/service";
import { MAX_REPORTS_PER_DAY } from "@/lib/moderation/reasons";
import { listMyCampuses } from "@/lib/orgs/service";
import { revealContact } from "@/lib/reveal/service";
import { TEST_DB_URL, closeTestDb, makeUser, nowPlus, openTestDb, resetTestDb } from "./helpers";

async function educator(db: Db, name: string, openTo: ("full_time" | "part_time" | "private_tutoring")[]) {
  const u = await makeUser(db, "educator", name);
  const [p] = await db.insert(schema.educatorProfiles).values({ userId: u.id, displayName: name, status: "published", publishedAt: new Date(), openTo, city: "taichung", districts: ["taichung:xitun"], subjects: ["phonics"], levels: ["kindergarten"], languages: ["en"], teachingModes: ["in_person"], workAuthorization: "open_work_rights", rateMin: 600, rateMax: 900 }).returning();
  await db.insert(schema.educatorContacts).values({ educatorId: p!.id, channel: "email", value: `${name}@secret.example` });
  return { user: u, profile: p! };
}

const form = (o: Record<string, string>) => ({ get: (k: string) => o[k] ?? null, getAll: () => [] as string[] });
const jobInput = () => parseJobForm(form({ title: "Kindergarten English teacher", type: "full_time", city: "taichung", applyContact: "hr@sunshine.example" })).values;

describe.skipIf(!TEST_DB_URL)("reports and moderation (real Postgres)", () => {
  let db: Db;
  beforeAll(async () => { db = await openTestDb(); });
  beforeEach(async () => { await resetTestDb(db); });
  afterAll(async () => { await closeTestDb(); });

  async function paidFamily() {
    const fam = await makeUser(db, "family");
    const admin = await makeUser(db, "educator");
    await confirmOrderPaid(db, (await createFamilyOrder(db, fam)).id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-20" }, nowPlus(-1));
    return { fam, admin };
  }
  async function paidSchool(name = "Sunshine") {
    const owner = await makeUser(db, "school");
    const admin = await makeUser(db, "educator");
    const [org] = await db.insert(schema.organizations).values({ name, type: "cram_school", city: "taichung", district: "taichung:xitun", latitude: 24.17, longitude: 120.62, status: "claimed", claimedAt: new Date() }).returning();
    await db.insert(schema.orgMembers).values({ organizationId: org!.id, userId: owner.id, role: "owner" });
    await confirmOrderPaid(db, (await createSchoolOrder(db, owner, [org!.id])).id, admin.id, { receivedAmount: 10_000, receivedOn: "2026-11-20" }, nowPlus(-1));
    return { owner, org: org!, admin };
  }
  const readerWithProfile = async () => (await educator(db, `Reader${Math.random()}`, ["full_time"])).user;

  describe("who may report what", () => {
    it("a paying family can report a tutor, twice is one report, and the reporter is stored", async () => {
      const { fam } = await paidFamily();
      const tutor = await educator(db, "Tutor", ["private_tutoring"]);
      expect(await submitReport(db, fam, { targetType: "educator", targetId: tutor.profile.id, reason: "misleading" })).toEqual({ created: true });
      expect(await submitReport(db, fam, { targetType: "educator", targetId: tutor.profile.id, reason: "abusive" })).toEqual({ created: false });
      const open = await listOpenReports(db);
      expect(open).toHaveLength(1);
      expect(open[0]).toMatchObject({ reason: "misleading", targetType: "educator", target: { label: "Tutor", state: "published" } });
    });

    it("people who cannot see a target cannot report it (and learn nothing about it)", async () => {
      const { fam } = await paidFamily();
      const { owner } = await paidSchool();
      const unpaid = await makeUser(db, "family");
      const schoolOnly = await educator(db, "SchoolOnly", ["full_time"]);
      const tutorOnly = await educator(db, "TutorOnly", ["private_tutoring"]);
      await expect(submitReport(db, unpaid, { targetType: "educator", targetId: tutorOnly.profile.id, reason: "misleading" })).rejects.toMatchObject({ code: "not_allowed" });
      await expect(submitReport(db, fam, { targetType: "educator", targetId: schoolOnly.profile.id, reason: "misleading" })).rejects.toMatchObject({ code: "not_found" });
      await expect(submitReport(db, owner, { targetType: "educator", targetId: tutorOnly.profile.id, reason: "misleading" })).rejects.toMatchObject({ code: "not_found" });
      await expect(submitReport(db, fam, { targetType: "educator", targetId: "not-a-uuid", reason: "misleading" })).rejects.toMatchObject({ code: "not_found" });
      // A family cannot report a job or a school either: they cannot see them.
      const { org } = await paidSchool("Other");
      await expect(submitReport(db, fam, { targetType: "organization", targetId: org.id, reason: "misleading" })).rejects.toMatchObject({ code: "not_allowed" });
      expect(await listOpenReports(db)).toHaveLength(0);
    });

    it("an educator with a profile can report a job post and a school; one without a profile cannot", async () => {
      const { owner, org } = await paidSchool();
      const job = await createJob(db, owner, org.id, jobInput());
      const reader = await readerWithProfile();
      const noProfile = await makeUser(db, "educator");
      await expect(submitReport(db, noProfile, { targetType: "job", targetId: job.id, reason: "payment_or_documents" })).rejects.toMatchObject({ code: "not_allowed" });
      expect(await submitReport(db, reader, { targetType: "job", targetId: job.id, reason: "payment_or_documents" })).toEqual({ created: true });
      expect(await submitReport(db, reader, { targetType: "organization", targetId: org.id, reason: "other", details: "They asked me to pay a fee before the interview" })).toEqual({ created: true });
      const open = await listOpenReports(db);
      expect(open.map((o) => o.targetType).sort()).toEqual(["job", "organization"]);
    });

    it("checks the reason: substitute work is for jobs only, 'other' needs words, junk is refused", async () => {
      const { owner, org } = await paidSchool();
      const job = await createJob(db, owner, org.id, jobInput());
      const reader = await readerWithProfile();
      await expect(submitReport(db, reader, { targetType: "organization", targetId: org.id, reason: "substitute_work" })).rejects.toMatchObject({ code: "invalid_reason" });
      await expect(submitReport(db, reader, { targetType: "job", targetId: job.id, reason: "other" })).rejects.toMatchObject({ code: "details_required" });
      await expect(submitReport(db, reader, { targetType: "job", targetId: job.id, reason: "rm -rf" })).rejects.toMatchObject({ code: "invalid_reason" });
      expect(await submitReport(db, reader, { targetType: "job", targetId: job.id, reason: "substitute_work", details: "x".repeat(900) })).toEqual({ created: true });
      const [row] = await db.select().from(schema.reports);
      expect(row!.details!.length).toBe(500);
    });

    it("limits how many reports one person can send in a day", async () => {
      const { fam } = await paidFamily();
      const tutors = [];
      for (let i = 0; i < MAX_REPORTS_PER_DAY + 1; i++) tutors.push(await educator(db, `T${i}`, ["private_tutoring"]));
      for (let i = 0; i < MAX_REPORTS_PER_DAY; i++) await submitReport(db, fam, { targetType: "educator", targetId: tutors[i]!.profile.id, reason: "misleading" });
      await expect(submitReport(db, fam, { targetType: "educator", targetId: tutors[MAX_REPORTS_PER_DAY]!.profile.id, reason: "misleading" })).rejects.toMatchObject({ code: "too_many" });
    });
  });

  describe("what an admin can do", () => {
    it("dismissing changes nothing but the report", async () => {
      const { fam } = await paidFamily();
      const admin = await makeUser(db, "educator");
      const tutor = await educator(db, "Tutor", ["private_tutoring"]);
      await submitReport(db, fam, { targetType: "educator", targetId: tutor.profile.id, reason: "misleading" });
      const [r] = await listOpenReports(db);
      await resolveReport(db, r!.id, admin.id, "dismiss");
      expect(await listOpenReports(db)).toHaveLength(0);
      expect((await searchEducators(db, "family", {})).total).toBe(1);
      await expect(resolveReport(db, r!.id, admin.id, "dismiss")).rejects.toMatchObject({ code: "report_not_open" });
      // After a dismissal the same person may report again.
      expect(await submitReport(db, fam, { targetType: "educator", targetId: tutor.profile.id, reason: "abusive" })).toEqual({ created: true });
    });

    it("actioning a report on an educator hides the profile everywhere, closes every open report on it and says whom to tell", async () => {
      const { fam } = await paidFamily();
      const { fam: fam2 } = await paidFamily();
      const admin = await makeUser(db, "educator");
      const tutor = await educator(db, "Tutor", ["private_tutoring"]);
      await submitReport(db, fam, { targetType: "educator", targetId: tutor.profile.id, reason: "misleading" });
      await submitReport(db, fam2, { targetType: "educator", targetId: tutor.profile.id, reason: "abusive" });
      const open = await listOpenReports(db);
      expect(open[0]!.alsoReported).toBe(1);
      const res = await resolveReport(db, open[0]!.id, admin.id, "action");
      expect(res.notify).toMatchObject({ what: "profile", emails: [`${tutor.user.id}@example.com`] });
      expect(await listOpenReports(db)).toHaveLength(0);
      const all = await db.select().from(schema.reports);
      expect(all.every((r) => r.status === "actioned" && r.resolvedBy === admin.id)).toBe(true);
      const [p] = await db.select().from(schema.educatorProfiles).where(eq(schema.educatorProfiles.id, tutor.profile.id));
      expect(p).toMatchObject({ status: "suspended", publishedAt: null });
      expect((await searchEducators(db, "family", {})).total).toBe(0);
      expect(await revealContact(db, fam, tutor.profile.id, { dailyCap: 10 })).toEqual({ ok: false, reason: "unavailable" });
      const [audit] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "moderation.educator.actioned"));
      expect(audit?.actorUserId).toBe(admin.id);
      expect((await listSuspended(db)).map((s) => s.label)).toEqual(["Tutor"]);
    });

    it("a suspended educator cannot publish, hide-then-publish, or edit their way back", async () => {
      const { fam } = await paidFamily();
      const admin = await makeUser(db, "educator");
      const tutor = await educator(db, "Tutor", ["private_tutoring"]);
      await submitReport(db, fam, { targetType: "educator", targetId: tutor.profile.id, reason: "abusive" });
      await resolveReport(db, (await listOpenReports(db))[0]!.id, admin.id, "action");
      const { publishProfile, hideProfile, saveProfile, getEducatorState } = await import("@/lib/educators/service");
      expect(await publishProfile(db, tutor.user.id)).toMatchObject({ ok: false, suspended: true });
      expect(await hideProfile(db, tutor.user.id)).toBe(false);
      const state = await getEducatorState(db, tutor.user.id);
      await saveProfile(db, tutor.user.id, state.input);
      const [p] = await db.select().from(schema.educatorProfiles).where(eq(schema.educatorProfiles.id, tutor.profile.id));
      expect(p!.status).toBe("suspended");
    });

    it("reinstating brings the profile back as hidden, never straight to published", async () => {
      const { fam } = await paidFamily();
      const admin = await makeUser(db, "educator");
      const tutor = await educator(db, "Tutor", ["private_tutoring"]);
      await submitReport(db, fam, { targetType: "educator", targetId: tutor.profile.id, reason: "abusive" });
      await resolveReport(db, (await listOpenReports(db))[0]!.id, admin.id, "action");
      await reinstate(db, "educator", tutor.profile.id, admin.id);
      const [p] = await db.select().from(schema.educatorProfiles).where(eq(schema.educatorProfiles.id, tutor.profile.id));
      expect(p!.status).toBe("hidden");
      expect((await searchEducators(db, "family", {})).total).toBe(0);
      await expect(reinstate(db, "educator", tutor.profile.id, admin.id)).rejects.toBeInstanceOf(ModerationFailure);
    });

    it("removing a job closes it for good: it leaves the board and the school cannot see it as open", async () => {
      const { owner, org } = await paidSchool();
      const admin = await makeUser(db, "educator");
      const job = await createJob(db, owner, org.id, jobInput());
      const reader = await readerWithProfile();
      const viewer = await getJobViewer(db, reader);
      await submitReport(db, reader, { targetType: "job", targetId: job.id, reason: "substitute_work" });
      const res = await resolveReport(db, (await listOpenReports(db))[0]!.id, admin.id, "action");
      expect(res.notify).toMatchObject({ what: "job", emails: [`${owner.id}@example.com`] });
      expect((await listOpenJobs(db, viewer)).items).toHaveLength(0);
      const [j] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
      expect(j).toMatchObject({ status: "closed" });
      expect(j!.removedAt).not.toBeNull();
    });

    it("suspending a school removes its jobs and pin, and stops it browsing, revealing, posting and paying", async () => {
      const { owner, org } = await paidSchool();
      const admin = await makeUser(db, "educator");
      const tutor = await educator(db, "Teacher", ["part_time"]);
      await createJob(db, owner, org.id, jobInput());
      const reader = await readerWithProfile();
      const viewer = await getJobViewer(db, reader);
      expect(await getMemberAudience(db, owner)).toBe("school");
      expect((await listOpenJobs(db, viewer)).items).toHaveLength(1);

      await submitReport(db, reader, { targetType: "organization", targetId: org.id, reason: "payment_or_documents" });
      const res = await resolveReport(db, (await listOpenReports(db))[0]!.id, admin.id, "action");
      expect(res.notify).toMatchObject({ what: "school", emails: [`${owner.id}@example.com`] });

      expect((await listOpenJobs(db, viewer)).items).toHaveLength(0);
      expect((await listSchoolPoints(db, viewer)).find((p) => p.id === org.id)).toBeUndefined();
      expect(await getSchoolWithJobs(db, viewer, org.id)).toBeNull();
      expect(await getMemberAudience(db, owner)).toBeNull();
      expect(await revealContact(db, owner, tutor.profile.id, { dailyCap: 10 })).toMatchObject({ ok: false });
      await expect(createJob(db, owner, org.id, jobInput())).rejects.toMatchObject({ code: "suspended" });
      await expect(createSchoolOrder(db, owner, [org.id])).rejects.toMatchObject({ code: "campus_suspended" });
      expect((await listMyCampuses(db, owner.id))[0]).toMatchObject({ name: "Sunshine", suspended: true });

      await reinstate(db, "organization", org.id, admin.id);
      expect(await getMemberAudience(db, owner)).toBe("school");
      expect((await listOpenJobs(db, viewer)).items).toHaveLength(1); // the paid membership and the post were never touched
      expect((await listMyCampuses(db, owner.id))[0]).toMatchObject({ suspended: false });
    });
  });
});
