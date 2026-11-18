import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { AccountType } from "@/lib/db/schema/auth";
import { getHolderMembership } from "@/lib/billing/orders";
import { isOrgMember } from "@/lib/orgs/service";
import { MAX_OPEN_JOBS_PER_ORG, type JobInput } from "./input";

const { jobs, organizations, auditLog } = schema;

export type JobManageError = "wrong_account_type" | "not_a_member" | "no_membership" | "too_many_open" | "not_found" | "suspended";

export class JobFailure extends Error {
  constructor(public code: JobManageError) {
    super(code);
  }
}

async function assertCanManage(db: Db, user: { id: string; accountType: AccountType }, organizationId: string): Promise<void> {
  if (user.accountType !== "school") throw new JobFailure("wrong_account_type");
  if (!(await isOrgMember(db, user.id, organizationId))) throw new JobFailure("not_a_member");
}

/**
 * A school posts a full-time or part-time job. The campus must have an ACTIVE membership: a lapsed or unpaid
 * campus cannot post. The place defaults to the campus's own city and district when the form leaves them out.
 */
export async function createJob(db: Db, user: { id: string; accountType: AccountType }, organizationId: string, input: JobInput, now: Date = new Date()) {
  await assertCanManage(db, user, organizationId);
  if (!(await getHolderMembership(db, "org", organizationId, now)).active) throw new JobFailure("no_membership");
  return db.transaction(async (tx) => {
    // Lock the campus row so two simultaneous posts cannot both slip under the cap.
    const [org] = await tx.select({ id: organizations.id, status: organizations.status }).from(organizations).where(eq(organizations.id, organizationId)).for("update").limit(1);
    if (!org) throw new JobFailure("not_found");
    if (org.status === "suspended") throw new JobFailure("suspended");
    const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(jobs).where(and(eq(jobs.organizationId, organizationId), eq(jobs.status, "open")));
    if (n >= MAX_OPEN_JOBS_PER_ORG) throw new JobFailure("too_many_open");
    const [job] = await tx
      .insert(jobs)
      .values({
        organizationId, title: input.title, type: input.type, description: input.description, subjects: input.subjects, levels: input.levels,
        city: input.city, district: input.district, salaryMin: input.salaryMin, salaryMax: input.salaryMax, salaryUnit: input.salaryUnit,
        startsOn: input.startsOn, applyContact: input.applyContact, status: "open",
      })
      .returning();
    await tx.insert(auditLog).values({ actorUserId: user.id, action: "job.created", entityType: "job", entityId: job!.id, meta: { organizationId } });
    return job!;
  });
}

/** Close a post (it disappears from the educator job board and map straight away). Closing twice is harmless. */
export async function closeJob(db: Db, user: { id: string; accountType: AccountType }, jobId: string): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) throw new JobFailure("not_found");
  const [job] = await db.select({ organizationId: jobs.organizationId }).from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) throw new JobFailure("not_found");
  await assertCanManage(db, user, job.organizationId);
  await db.update(jobs).set({ status: "closed" }).where(eq(jobs.id, jobId));
  await db.insert(auditLog).values({ actorUserId: user.id, action: "job.closed", entityType: "job", entityId: jobId });
}

export interface ManagedJob {
  id: string;
  organizationId: string;
  organizationName: string;
  title: string;
  type: "full_time" | "part_time";
  status: "open" | "closed";
  city: string | null;
  createdAt: Date;
}

/** Every post of every campus the school user belongs to, open ones first. */
export async function listJobsForUser(db: Db, userId: string): Promise<ManagedJob[]> {
  const rows = await db
    .select({ id: jobs.id, organizationId: jobs.organizationId, organizationName: organizations.name, title: jobs.title, type: jobs.type, status: jobs.status, city: jobs.city, createdAt: jobs.createdAt })
    .from(jobs)
    .innerJoin(organizations, eq(jobs.organizationId, organizations.id))
    .innerJoin(schema.orgMembers, and(eq(schema.orgMembers.organizationId, organizations.id), eq(schema.orgMembers.userId, userId)))
    .orderBy(sql`${jobs.status} = 'closed'`, desc(jobs.createdAt))
    .limit(100);
  return rows;
}
