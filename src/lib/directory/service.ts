import { and, desc, eq, gt, inArray, lte, sql, arrayContains, arrayOverlaps, type SQL } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { AccountType } from "@/lib/db/schema/auth";
import { AUDIENCE_OPEN_TO, projectEducatorForAudience, type Audience, type EducatorCardDto } from "@/lib/visibility";

const { educatorProfiles, memberships, orgMembers } = schema;

/**
 * Which audience a signed-in user is allowed to browse as: "school" or "family", and only while they hold an
 * active paid membership. Everyone else (signed out, educators, lapsed members) gets null and sees nothing.
 */
export async function getMemberAudience(db: Db, user: { id: string; accountType: AccountType }, now: Date = new Date()): Promise<Audience | null> {
  const active = and(lte(memberships.startsAt, now), gt(memberships.endsAt, now));
  if (user.accountType === "family") {
    const [m] = await db.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.holderType, "user"), eq(memberships.holderId, user.id), active)).limit(1);
    return m ? "family" : null;
  }
  if (user.accountType === "school") {
    const orgs = await db.select({ id: orgMembers.organizationId }).from(orgMembers).where(eq(orgMembers.userId, user.id));
    if (orgs.length === 0) return null;
    const [m] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.holderType, "org"), inArray(memberships.holderId, orgs.map((o) => o.id)), active))
      .limit(1);
    return m ? "school" : null;
  }
  return null;
}

export interface DirectoryFilters {
  subject?: string;
  level?: string;
  city?: string;
  district?: string;
  language?: string;
  mode?: string;
  page?: number;
}

export const PAGE_SIZE = 12;

/** The one WHERE clause every member-facing educator query starts from. */
function audienceWhere(audience: Audience, f: DirectoryFilters): SQL {
  const parts: SQL[] = [
    eq(educatorProfiles.status, "published"),
    eq(educatorProfiles.countryCode, "TW"),
    arrayOverlaps(educatorProfiles.openTo, [...AUDIENCE_OPEN_TO[audience]]),
  ];
  if (f.subject) parts.push(arrayContains(educatorProfiles.subjects, [f.subject]));
  if (f.level) parts.push(arrayContains(educatorProfiles.levels, [f.level]));
  if (f.language) parts.push(arrayContains(educatorProfiles.languages, [f.language]));
  if (f.mode) parts.push(arrayContains(educatorProfiles.teachingModes, [f.mode]));
  if (f.city) parts.push(eq(educatorProfiles.city, f.city));
  if (f.district) parts.push(arrayContains(educatorProfiles.districts, [f.district]));
  return and(...parts)!;
}

const cardColumns = {
  id: educatorProfiles.id,
  status: educatorProfiles.status,
  displayName: educatorProfiles.displayName,
  headline: educatorProfiles.headline,
  bio: educatorProfiles.bio,
  photoKey: educatorProfiles.photoKey,
  city: educatorProfiles.city,
  districts: educatorProfiles.districts,
  subjects: educatorProfiles.subjects,
  levels: educatorProfiles.levels,
  languages: educatorProfiles.languages,
  teachingModes: educatorProfiles.teachingModes,
  openTo: educatorProfiles.openTo,
  workAuthorization: educatorProfiles.workAuthorization,
  experienceBand: educatorProfiles.experienceBand,
  rateMin: educatorProfiles.rateMin,
  rateMax: educatorProfiles.rateMax,
  credentials: educatorProfiles.credentials,
};

export async function searchEducators(db: Db, audience: Audience, f: DirectoryFilters): Promise<{ items: EducatorCardDto[]; total: number; page: number; pageSize: number }> {
  const where = audienceWhere(audience, f);
  const page = Math.max(1, Math.floor(f.page ?? 1));
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(educatorProfiles).where(where);
  const rows = await db.select(cardColumns).from(educatorProfiles).where(where).orderBy(desc(educatorProfiles.publishedAt), educatorProfiles.id).limit(PAGE_SIZE).offset((page - 1) * PAGE_SIZE);
  // Defence in depth: the SQL already filters, and the projection re-checks and strips the other side.
  const items = rows.flatMap((r) => projectEducatorForAudience(r, audience) ?? []);
  return { items, total: n, page, pageSize: PAGE_SIZE };
}

/** One educator for one audience, or null when it does not exist or this audience may not see it. */
export async function getEducatorForAudience(db: Db, audience: Audience, id: string): Promise<EducatorCardDto | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [row] = await db.select(cardColumns).from(educatorProfiles).where(and(eq(educatorProfiles.id, id), audienceWhere(audience, {}))).limit(1);
  return row ? projectEducatorForAudience(row, audience) : null;
}

export interface AreaCount {
  key: string;
  level: "city" | "district";
  count: number;
}

/**
 * Map data: how many educators this audience can see in each area. Educators appear in every district they
 * chose, or at city level when they chose none. No names, no ids: only keys and counts, from the same filtered
 * set the list uses, so the map can never show more than the list.
 */
export async function getAreaCounts(db: Db, audience: Audience, f: DirectoryFilters): Promise<AreaCount[]> {
  const rows = await db.select({ city: educatorProfiles.city, districts: educatorProfiles.districts }).from(educatorProfiles).where(audienceWhere(audience, { ...f, page: undefined }));
  const counts = new Map<string, AreaCount>();
  const bump = (key: string, level: AreaCount["level"]) => {
    const k = `${level}:${key}`;
    const cur = counts.get(k);
    if (cur) cur.count += 1;
    else counts.set(k, { key, level, count: 1 });
  };
  for (const r of rows) {
    if (r.districts.length > 0) for (const d of r.districts) bump(d, "district");
    else if (r.city) bump(r.city, "city");
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
