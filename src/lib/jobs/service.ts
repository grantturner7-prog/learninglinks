import { and, desc, eq, isNotNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { AccountType } from "@/lib/db/schema/auth";
import { canSeeJobs, type JobViewer } from "@/lib/visibility";

const { jobs, organizations, educatorProfiles, memberships } = schema;

/**
 * A post is live only while its campus holds an ACTIVE membership. When the 12 months end the posts stop showing
 * (they are not deleted: renewing brings them back). Every educator-facing job query includes this.
 */
export function jobIsLive(now: Date = new Date()): SQL {
  return sql`exists (select 1 from ${memberships} where ${memberships.holderType} = 'org' and ${memberships.holderId} = ${jobs.organizationId}::text and ${memberships.startsAt} <= ${now} and ${memberships.endsAt} > ${now})`;
}

/** Build the viewer description the visibility rule needs from a signed-in user. */
export async function getJobViewer(db: Db, user: { id: string; accountType: AccountType }): Promise<JobViewer> {
  const [p] = await db.select({ status: educatorProfiles.status }).from(educatorProfiles).where(eq(educatorProfiles.userId, user.id)).limit(1);
  return { accountType: user.accountType, hasProfile: !!p, profileSuspended: p?.status === "suspended" };
}

export interface JobFilters {
  type?: "full_time" | "part_time";
  city?: string;
  subject?: string;
  page?: number;
}

export interface JobDto {
  id: string;
  title: string;
  type: "full_time" | "part_time";
  description: string | null;
  subjects: string[];
  levels: string[];
  city: string | null;
  district: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryUnit: "month" | "hour" | null;
  startsOn: string | null;
  applyContact: string | null;
  postedAt: Date;
  school: { id: string; name: string; type: string };
}

export const JOB_PAGE_SIZE = 12;

/** Open job posts, for signed-in educators with a profile ONLY. Anyone else gets an empty result. */
export async function listOpenJobs(db: Db, viewer: JobViewer | null, f: JobFilters = {}, now: Date = new Date()): Promise<{ items: JobDto[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, Math.floor(f.page ?? 1));
  if (!canSeeJobs(viewer)) return { items: [], total: 0, page, pageSize: JOB_PAGE_SIZE };
  const conds = [eq(jobs.status, "open"), jobIsLive(now)];
  if (f.type) conds.push(eq(jobs.type, f.type));
  if (f.city) conds.push(eq(jobs.city, f.city));
  if (f.subject) conds.push(sql`${jobs.subjects} @> ARRAY[${f.subject}]::text[]`);
  const where = and(...conds);
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(where);
  const rows = await db
    .select({ job: jobs, orgId: organizations.id, orgName: organizations.name, orgType: organizations.type })
    .from(jobs)
    .innerJoin(organizations, eq(jobs.organizationId, organizations.id))
    .where(where)
    .orderBy(desc(jobs.createdAt), jobs.id)
    .limit(JOB_PAGE_SIZE)
    .offset((page - 1) * JOB_PAGE_SIZE);
  const items: JobDto[] = rows.map(({ job, orgId, orgName, orgType }) => ({
    id: job.id, title: job.title, type: job.type, description: job.description, subjects: job.subjects, levels: job.levels,
    city: job.city, district: job.district, salaryMin: job.salaryMin, salaryMax: job.salaryMax, salaryUnit: job.salaryUnit,
    startsOn: job.startsOn, applyContact: job.applyContact, postedAt: job.createdAt, school: { id: orgId, name: orgName, type: orgType },
  }));
  return { items, total: n, page, pageSize: JOB_PAGE_SIZE };
}

export interface SchoolPoint {
  id: string;
  name: string;
  type: string;
  city: string | null;
  district: string | null;
  lat: number;
  lng: number;
  jobs: number;
}

/** Schools for the educator map. Same gate as job posts: signed-in educators with a profile only. */
export async function listSchoolPoints(db: Db, viewer: JobViewer | null, f: { city?: string; type?: string } = {}, now: Date = new Date()): Promise<SchoolPoint[]> {
  if (!canSeeJobs(viewer)) return [];
  const conds = [isNotNull(organizations.latitude), isNotNull(organizations.longitude)];
  if (f.city) conds.push(eq(organizations.city, f.city));
  if (f.type) conds.push(eq(organizations.type, f.type));
  const openJobs = db
    .select({ orgId: jobs.organizationId, n: sql<number>`count(*)::int`.as("n") })
    .from(jobs)
    .where(and(eq(jobs.status, "open"), jobIsLive(now)))
    .groupBy(jobs.organizationId)
    .as("open_jobs");
  const rows = await db
    .select({ id: organizations.id, name: organizations.name, type: organizations.type, city: organizations.city, district: organizations.district, lat: organizations.latitude, lng: organizations.longitude, jobs: sql<number>`coalesce(${openJobs.n}, 0)::int` })
    .from(organizations)
    .leftJoin(openJobs, eq(openJobs.orgId, organizations.id))
    .where(and(...conds));
  return rows.map((r) => ({ ...r, lat: r.lat!, lng: r.lng! }));
}

export interface SchoolDetail {
  id: string;
  name: string;
  nameEn: string | null;
  type: string;
  city: string | null;
  district: string | null;
  website: string | null;
  jobs: JobDto[];
}

/**
 * One school with its open job posts, for the educator map's side card. Same gate as everything else about
 * jobs. We expose the public facts about the school (name, type, place, website) and never its private
 * contact fields.
 */
export async function getSchoolWithJobs(db: Db, viewer: JobViewer | null, id: string, now: Date = new Date()): Promise<SchoolDetail | null> {
  if (!canSeeJobs(viewer) || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [org] = await db
    .select({ id: organizations.id, name: organizations.name, nameEn: organizations.nameEn, type: organizations.type, city: organizations.city, district: organizations.district, website: organizations.website })
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  if (!org) return null;
  const rows = await db.select().from(jobs).where(and(eq(jobs.organizationId, id), eq(jobs.status, "open"), jobIsLive(now))).orderBy(desc(jobs.createdAt));
  return {
    ...org,
    jobs: rows.map((job) => ({
      id: job.id, title: job.title, type: job.type, description: job.description, subjects: job.subjects, levels: job.levels,
      city: job.city, district: job.district, salaryMin: job.salaryMin, salaryMax: job.salaryMax, salaryUnit: job.salaryUnit,
      startsOn: job.startsOn, applyContact: job.applyContact, postedAt: job.createdAt, school: { id: org.id, name: org.name, type: org.type },
    })),
  };
}
