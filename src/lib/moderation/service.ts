import { and, asc, count, desc, eq, gte, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { AccountType } from "@/lib/db/schema/auth";
import { getEducatorForAudience, getMemberAudience } from "@/lib/directory/service";
import { getJobViewer, jobIsLive } from "@/lib/jobs/service";
import { canSeeJobs } from "@/lib/visibility";
import { MAX_REPORTS_PER_DAY, REPORT_DETAILS_MAX, REPORT_REASONS, REPORT_TARGETS, reasonsFor, type ReportReason, type ReportTargetType } from "./reasons";

const { reports, educatorProfiles, organizations, jobs, orgMembers, auditLog } = schema;

export type ModerationError = "not_allowed" | "not_found" | "invalid_reason" | "details_required" | "too_many" | "report_not_open" | "wrong_state";

export class ModerationFailure extends Error {
  constructor(public code: ModerationError) {
    super(code);
  }
}

const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export interface ReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details?: string;
}

/**
 * Someone reports an educator, a school or a job post. Only people who can actually see the target may report it
 * (a paying member of the right audience for an educator; a signed-in educator with a profile for a school or a job),
 * so reports cannot be used to probe for ids. The reporter's identity is never shown to the reported party.
 * Reporting the same thing twice while the first is still open is a quiet no-op.
 */
export async function submitReport(db: Db, user: { id: string; accountType: AccountType }, input: ReportInput, now: Date = new Date()): Promise<{ created: boolean }> {
  if (!REPORT_TARGETS.includes(input.targetType) || !isUuid(input.targetId)) throw new ModerationFailure("not_found");
  if (!(REPORT_REASONS as readonly string[]).includes(input.reason) || !reasonsFor(input.targetType).includes(input.reason as ReportReason)) throw new ModerationFailure("invalid_reason");
  const details = (input.details ?? "").replace(CONTROL, "").replace(/\s+/g, " ").trim().slice(0, REPORT_DETAILS_MAX);
  if (input.reason === "other" && details.length < 5) throw new ModerationFailure("details_required");

  // Can this person see the target at all?
  if (input.targetType === "educator") {
    const audience = await getMemberAudience(db, user, now);
    if (!audience) throw new ModerationFailure("not_allowed");
    if (!(await getEducatorForAudience(db, audience, input.targetId))) throw new ModerationFailure("not_found");
  } else {
    const viewer = await getJobViewer(db, user);
    if (!canSeeJobs(viewer)) throw new ModerationFailure("not_allowed");
    if (input.targetType === "job") {
      const [j] = await db.select({ id: jobs.id }).from(jobs).where(and(eq(jobs.id, input.targetId), eq(jobs.status, "open"), jobIsLive(now))).limit(1);
      if (!j) throw new ModerationFailure("not_found");
    } else {
      // A school someone runs (claimed) can be reported for anything. A school nobody has claimed yet has only one
      // thing of ours to complain about: the picture we show for it. A picture report always needs a picture.
      const [o] = await db.select({ id: organizations.id, status: organizations.status }).from(organizations).where(eq(organizations.id, input.targetId)).limit(1);
      if (!o || o.status === "suspended") throw new ModerationFailure("not_found");
      if (input.reason === "picture") {
        const [ph] = await db.select({ id: schema.organizationPhotos.organizationId }).from(schema.organizationPhotos).where(eq(schema.organizationPhotos.organizationId, input.targetId)).limit(1);
        if (!ph) throw new ModerationFailure("not_found");
      } else if (o.status !== "claimed") throw new ModerationFailure("not_found");
    }
  }

  const since = new Date(now.getTime() - 86_400_000);
  const [{ n } = { n: 0 }] = await db.select({ n: count() }).from(reports).where(and(eq(reports.reporterUserId, user.id), gte(reports.createdAt, since)));
  if (n >= MAX_REPORTS_PER_DAY) throw new ModerationFailure("too_many");

  const res = await db
    .insert(reports)
    .values({ reporterUserId: user.id, targetType: input.targetType, targetId: input.targetId, reason: input.reason, details: details || null, createdAt: now })
    .onConflictDoNothing()
    .returning({ id: reports.id });
  return { created: res.length > 0 };
}

export interface OpenReport {
  id: string;
  createdAt: Date;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  details: string | null;
  reporterEmail: string;
  /** Other open reports about the same target (a reviewer should see a pile-up). */
  alsoReported: number;
  /** `pictureVersion` is set when the target is a school that has a picture (so the desk can show it and take it down). */
  target: { label: string; sub: string; state: string; exists: boolean; pictureVersion?: string };
}

async function describeTarget(db: Db, type: ReportTargetType, id: string): Promise<OpenReport["target"]> {
  if (type === "educator") {
    const [e] = await db.select({ name: educatorProfiles.displayName, headline: educatorProfiles.headline, status: educatorProfiles.status }).from(educatorProfiles).where(eq(educatorProfiles.id, id)).limit(1);
    return e ? { label: e.name, sub: e.headline ?? "", state: e.status, exists: true } : { label: "(deleted profile)", sub: "", state: "gone", exists: false };
  }
  if (type === "organization") {
    const [o] = await db.select({ name: organizations.name, type: organizations.type, status: organizations.status }).from(organizations).where(eq(organizations.id, id)).limit(1);
    const [ph] = o ? await db.select({ key: schema.organizationPhotos.photoKey }).from(schema.organizationPhotos).where(eq(schema.organizationPhotos.organizationId, id)).limit(1) : [];
    return o ? { label: o.name, sub: o.type, state: o.status, exists: true, pictureVersion: ph?.key.slice(0, 8) } : { label: "(missing school)", sub: "", state: "gone", exists: false };
  }
  const [j] = await db.select({ title: jobs.title, org: organizations.name, status: jobs.status, removedAt: jobs.removedAt }).from(jobs).innerJoin(organizations, eq(jobs.organizationId, organizations.id)).where(eq(jobs.id, id)).limit(1);
  return j ? { label: j.title, sub: j.org, state: j.removedAt ? "removed" : j.status, exists: true } : { label: "(missing job)", sub: "", state: "gone", exists: false };
}

/** Admin queue: open reports, oldest first. */
export async function listOpenReports(db: Db): Promise<OpenReport[]> {
  const rows = await db
    .select({ r: reports, email: schema.user.email })
    .from(reports)
    .innerJoin(schema.user, eq(schema.user.id, reports.reporterUserId))
    .where(eq(reports.status, "open"))
    .orderBy(asc(reports.createdAt))
    .limit(200);
  return Promise.all(
    rows.map(async ({ r, email }) => ({
      id: r.id, createdAt: r.createdAt, targetType: r.targetType, targetId: r.targetId, reason: r.reason, details: r.details, reporterEmail: email,
      alsoReported: rows.filter((x) => x.r.targetType === r.targetType && x.r.targetId === r.targetId && x.r.id !== r.id).length,
      target: await describeTarget(db, r.targetType, r.targetId),
    })),
  );
}

export type Decision = "dismiss" | "action";

export interface ActionResult {
  /** Who should be told (educator or school owners), if anything was hidden. */
  notify: { name: string; emails: string[]; what: "profile" | "school" | "job" } | null;
}

/**
 * Close a report. "dismiss" changes nothing but the report. "action" applies the measure for that kind of target in
 * one transaction (suspend the educator's profile, suspend the school, or remove the job post), marks every open
 * report about the same target as actioned and writes the audit trail.
 */
export async function resolveReport(db: Db, reportId: string, adminUserId: string, decision: Decision, now: Date = new Date()): Promise<ActionResult> {
  return db.transaction(async (tx) => {
    const [rep] = await tx.select().from(reports).where(eq(reports.id, reportId)).for("update").limit(1);
    if (!rep || rep.status !== "open") throw new ModerationFailure("report_not_open");
    if (decision === "dismiss") {
      await tx.update(reports).set({ status: "dismissed", resolvedBy: adminUserId, resolvedAt: now }).where(eq(reports.id, rep.id));
      await tx.insert(auditLog).values({ actorUserId: adminUserId, action: "report.dismissed", entityType: rep.targetType, entityId: rep.targetId, meta: { reportId: rep.id } });
      return { notify: null };
    }
    let notify: ActionResult["notify"] = null;
    if (rep.targetType === "educator") {
      const [p] = await tx.update(educatorProfiles).set({ status: "suspended", publishedAt: null }).where(eq(educatorProfiles.id, rep.targetId)).returning({ userId: educatorProfiles.userId, name: educatorProfiles.displayName });
      if (p) {
        const [u] = await tx.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, p.userId)).limit(1);
        notify = { name: p.name, emails: u ? [u.email] : [], what: "profile" };
      }
    } else if (rep.targetType === "organization") {
      const [o] = await tx.update(organizations).set({ status: "suspended" }).where(eq(organizations.id, rep.targetId)).returning({ name: organizations.name });
      if (o) {
        const owners = await tx.select({ email: schema.user.email }).from(orgMembers).innerJoin(schema.user, eq(orgMembers.userId, schema.user.id)).where(and(eq(orgMembers.organizationId, rep.targetId), eq(orgMembers.role, "owner")));
        notify = { name: o.name, emails: [...new Set(owners.map((x) => x.email))], what: "school" };
      }
    } else {
      const [j] = await tx.update(jobs).set({ status: "closed", removedAt: now }).where(eq(jobs.id, rep.targetId)).returning({ title: jobs.title, orgId: jobs.organizationId });
      if (j) {
        const owners = await tx.select({ email: schema.user.email }).from(orgMembers).innerJoin(schema.user, eq(orgMembers.userId, schema.user.id)).where(and(eq(orgMembers.organizationId, j.orgId), eq(orgMembers.role, "owner")));
        notify = { name: j.title, emails: [...new Set(owners.map((x) => x.email))], what: "job" };
      }
    }
    await tx.update(reports).set({ status: "actioned", resolvedBy: adminUserId, resolvedAt: now }).where(and(eq(reports.targetType, rep.targetType), eq(reports.targetId, rep.targetId), eq(reports.status, "open")));
    await tx.insert(auditLog).values({ actorUserId: adminUserId, action: `moderation.${rep.targetType}.actioned`, entityType: rep.targetType, entityId: rep.targetId, meta: { reportId: rep.id, reason: rep.reason } });
    return { notify };
  });
}

export interface SuspendedItem {
  type: "educator" | "organization";
  id: string;
  label: string;
  sub: string;
}

/** What is hidden by moderation right now, so an admin can reinstate it. */
export async function listSuspended(db: Db): Promise<SuspendedItem[]> {
  const e = await db.select({ id: educatorProfiles.id, name: educatorProfiles.displayName, headline: educatorProfiles.headline }).from(educatorProfiles).where(eq(educatorProfiles.status, "suspended")).orderBy(desc(educatorProfiles.updatedAt)).limit(100);
  const o = await db.select({ id: organizations.id, name: organizations.name, type: organizations.type }).from(organizations).where(eq(organizations.status, "suspended")).limit(100);
  return [
    ...e.map((x) => ({ type: "educator" as const, id: x.id, label: x.name, sub: x.headline ?? "" })),
    ...o.map((x) => ({ type: "organization" as const, id: x.id, label: x.name, sub: x.type })),
  ];
}

/**
 * Undo a suspension. An educator's profile comes back as HIDDEN (private): the educator decides when to publish
 * again. A school comes back as claimed, with its membership and owners untouched.
 */
export async function reinstate(db: Db, type: "educator" | "organization", id: string, adminUserId: string): Promise<void> {
  if (!isUuid(id)) throw new ModerationFailure("not_found");
  await db.transaction(async (tx) => {
    const res = type === "educator"
      ? await tx.update(educatorProfiles).set({ status: "hidden", hiddenAt: new Date() }).where(and(eq(educatorProfiles.id, id), eq(educatorProfiles.status, "suspended"))).returning({ id: educatorProfiles.id })
      : await tx.update(organizations).set({ status: "claimed" }).where(and(eq(organizations.id, id), eq(organizations.status, "suspended"))).returning({ id: organizations.id });
    if (res.length === 0) throw new ModerationFailure("wrong_state");
    await tx.insert(auditLog).values({ actorUserId: adminUserId, action: `moderation.${type}.reinstated`, entityType: type, entityId: id });
  });
}

/** Reports the person made that are still waiting, so the button can say "already reported". */
export async function myOpenReportTargets(db: Db, userId: string, type: ReportTargetType, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await db.select({ id: reports.targetId }).from(reports).where(and(eq(reports.reporterUserId, userId), eq(reports.targetType, type), eq(reports.status, "open"), inArray(reports.targetId, ids)));
  return new Set(rows.map((r) => r.id));
}

