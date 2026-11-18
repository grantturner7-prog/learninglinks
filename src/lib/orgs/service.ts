import { and, asc, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { AccountType } from "@/lib/db/schema/auth";
import { isCityKey } from "@/lib/geo/taiwan";
import { TW_CITY_ANCHORS, TW_DISTRICT_ANCHORS } from "@/lib/geo/tw-centroids.generated";
import { SCHOOL_TYPES, isOneOf } from "@/lib/taxonomy";
import { getHolderMembership, type HolderMembership } from "@/lib/billing/orders";

const { organizations, orgClaims, orgMembers, auditLog } = schema;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

export type OrgError =
  | "wrong_account_type"
  | "not_found"
  | "already_claimed"
  | "too_many_pending"
  | "invalid_name"
  | "invalid_phone"
  | "invalid_role"
  | "invalid_type"
  | "invalid_city"
  | "invalid_district"
  | "claim_not_pending"
  | "not_a_member";

export class OrgFailure extends Error {
  constructor(public code: OrgError) {
    super(code);
  }
}

/** A person can have this many claims waiting for review at once. */
export const MAX_PENDING_CLAIMS = 10;

export interface OrgSearchHit {
  id: string;
  name: string;
  nameEn: string | null;
  type: string;
  city: string | null;
  district: string | null;
  status: "unclaimed" | "claimed" | "suspended";
}

/** `%` and `_` are wildcards in LIKE; a school name search must treat them as plain characters. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * School and cram-school names, so a school can find its own listing and claim it. Names, types and places are
 * public facts from open data: no contact details are returned. Needs at least 2 characters.
 */
export async function searchOrganizations(db: Db, q: string, f: { city?: string } = {}, limit = 20): Promise<OrgSearchHit[]> {
  const term = q.trim();
  if (term.length < 2) return [];
  const where = [sql`(${ilike(organizations.name, `%${likeEscape(term)}%`)} or ${ilike(organizations.nameEn, `%${likeEscape(term)}%`)})`];
  if (f.city) where.push(eq(organizations.city, f.city));
  return db
    .select({ id: organizations.id, name: organizations.name, nameEn: organizations.nameEn, type: organizations.type, city: organizations.city, district: organizations.district, status: organizations.status })
    .from(organizations)
    .where(and(...where))
    .orderBy(asc(sql`${organizations.status} = 'unclaimed'`), asc(organizations.name))
    .limit(limit);
}

export interface ClaimInput {
  contactName: string;
  contactRole: string;
  contactPhone: string;
  note?: string;
}

function cleanClaim(i: ClaimInput) {
  const contactName = i.contactName.trim();
  const contactRole = i.contactRole.trim();
  const contactPhone = i.contactPhone.replace(/[^\d+]/g, "");
  if (contactName.length < 2 || contactName.length > 80) throw new OrgFailure("invalid_name");
  if (contactRole.length < 2 || contactRole.length > 80) throw new OrgFailure("invalid_role");
  // Taiwan numbers are 8-10 digits (landline with area code or mobile), optionally with +886.
  if (!/^\+?\d{8,14}$/.test(contactPhone)) throw new OrgFailure("invalid_phone");
  return { contactName, contactRole, contactPhone, note: i.note?.trim().slice(0, 500) || null };
}

async function assertClaimRoom(db: Db | Tx, userId: string): Promise<void> {
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(orgClaims).where(and(eq(orgClaims.userId, userId), eq(orgClaims.status, "pending")));
  if (n >= MAX_PENDING_CLAIMS) throw new OrgFailure("too_many_pending");
}

/**
 * A school account says "this campus is mine". Nothing changes until an admin approves: we are not verifying
 * identity, only checking the claim looks reasonable (we cannot and do not verify licences or authority).
 * Claiming twice while one is pending is a no-op that returns the existing claim.
 */
export async function submitClaim(db: Db, user: { id: string; accountType: AccountType }, organizationId: string, input: ClaimInput) {
  if (user.accountType !== "school") throw new OrgFailure("wrong_account_type");
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) throw new OrgFailure("not_found");
  const data = cleanClaim(input);
  return db.transaction(async (tx) => {
    const [org] = await tx.select({ id: organizations.id, status: organizations.status }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
    if (!org) throw new OrgFailure("not_found");
    if (org.status !== "unclaimed") throw new OrgFailure("already_claimed");
    const [existing] = await tx.select().from(orgClaims).where(and(eq(orgClaims.organizationId, organizationId), eq(orgClaims.userId, user.id), eq(orgClaims.status, "pending"))).limit(1);
    if (existing) return existing;
    await assertClaimRoom(tx, user.id);
    const [claim] = await tx.insert(orgClaims).values({ organizationId, userId: user.id, ...data }).returning();
    return claim!;
  });
}

export interface NewCampusInput extends ClaimInput {
  name: string;
  type: string;
  city: string;
  /** District key ("taipei:daan"). Optional; the map pin sits at the district's centre, never at an address. */
  district?: string;
  website?: string;
}

/**
 * A campus that is not in our open data: the school adds it and claims it in one step. It is created unclaimed
 * and goes through the same admin review as any claim, so nothing appears to educators until it is approved.
 * We store the district, never a street address: the pin sits at the centre of the district.
 */
export async function addCampusAndClaim(db: Db, user: { id: string; accountType: AccountType }, input: NewCampusInput) {
  if (user.accountType !== "school") throw new OrgFailure("wrong_account_type");
  const data = cleanClaim(input);
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) throw new OrgFailure("invalid_name");
  if (!isOneOf(SCHOOL_TYPES, input.type)) throw new OrgFailure("invalid_type");
  if (!isCityKey(input.city)) throw new OrgFailure("invalid_city");
  const district = input.district || null;
  if (district && !(district.startsWith(`${input.city}:`) && district in TW_DISTRICT_ANCHORS)) throw new OrgFailure("invalid_district");
  const anchor = (district ? TW_DISTRICT_ANCHORS[district] : undefined) ?? TW_CITY_ANCHORS[input.city];
  let website: string | null = null;
  if (input.website?.trim()) {
    try {
      const u = new URL(input.website.trim());
      if (u.protocol === "https:" || u.protocol === "http:") website = u.toString().slice(0, 300);
    } catch {
      /* ignore an unparseable address: the website is optional */
    }
  }
  return db.transaction(async (tx) => {
    await assertClaimRoom(tx, user.id);
    const [org] = await tx
      .insert(organizations)
      .values({ countryCode: "TW", name, type: input.type, city: input.city, district, latitude: anchor?.[1] ?? null, longitude: anchor?.[0] ?? null, website, source: "manual", status: "unclaimed" })
      .returning();
    const [claim] = await tx.insert(orgClaims).values({ organizationId: org!.id, userId: user.id, ...data }).returning();
    return { organization: org!, claim: claim! };
  });
}

export interface PendingClaim {
  id: string;
  createdAt: Date;
  contactName: string;
  contactRole: string;
  contactPhone: string;
  note: string | null;
  userEmail: string;
  organization: { id: string; name: string; type: string; city: string | null; district: string | null; source: string; website: string | null };
  /** Other claims waiting on the same campus (a reviewer should know there is a competing claim). */
  competing: number;
}

/** Admin queue: claims waiting for review, oldest first. */
export async function listPendingClaims(db: Db): Promise<PendingClaim[]> {
  const rows = await db
    .select({ claim: orgClaims, email: schema.user.email, org: organizations })
    .from(orgClaims)
    .innerJoin(organizations, eq(orgClaims.organizationId, organizations.id))
    .innerJoin(schema.user, eq(orgClaims.userId, schema.user.id))
    .where(eq(orgClaims.status, "pending"))
    .orderBy(asc(orgClaims.createdAt))
    .limit(200);
  return rows.map(({ claim, email, org }) => ({
    id: claim.id,
    createdAt: claim.createdAt,
    contactName: claim.contactName,
    contactRole: claim.contactRole,
    contactPhone: claim.contactPhone,
    note: claim.note,
    userEmail: email,
    organization: { id: org.id, name: org.name, type: org.type, city: org.city, district: org.district, source: org.source, website: org.website },
    competing: rows.filter((r) => r.claim.organizationId === claim.organizationId && r.claim.id !== claim.id).length,
  }));
}

/**
 * Approve: the claimant becomes the owner of the campus. In one transaction (and with the campus row locked, so two
 * admins cannot approve two different claimants) we mark the campus claimed, copy the claimant's contact onto it
 * (private to the campus and admins) and reject the other pending claims for it.
 */
export async function approveClaim(db: Db, claimId: string, adminUserId: string, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const [claim] = await tx.select().from(orgClaims).where(eq(orgClaims.id, claimId)).limit(1);
    if (!claim || claim.status !== "pending") throw new OrgFailure("claim_not_pending");
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, claim.organizationId)).for("update").limit(1);
    if (!org) throw new OrgFailure("not_found");
    if (org.status !== "unclaimed") throw new OrgFailure("already_claimed");
    const [claimant] = await tx.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, claim.userId)).limit(1);
    await tx.update(organizations).set({ status: "claimed", claimedAt: now, contactEmail: claimant?.email ?? null, contactPhone: claim.contactPhone }).where(eq(organizations.id, org.id));
    await tx.insert(orgMembers).values({ organizationId: org.id, userId: claim.userId, role: "owner" }).onConflictDoNothing();
    await tx.update(orgClaims).set({ status: "approved", reviewedBy: adminUserId, reviewedAt: now }).where(eq(orgClaims.id, claim.id));
    await tx
      .update(orgClaims)
      .set({ status: "rejected", reviewedBy: adminUserId, reviewedAt: now })
      .where(and(eq(orgClaims.organizationId, org.id), eq(orgClaims.status, "pending")));
    await tx.insert(auditLog).values({ actorUserId: adminUserId, action: "claim.approved", entityType: "organization", entityId: org.id, meta: { claimId: claim.id, userId: claim.userId } });
  });
}

export async function rejectClaim(db: Db, claimId: string, adminUserId: string, now: Date = new Date()): Promise<void> {
  await db.transaction(async (tx) => {
    const res = await tx.update(orgClaims).set({ status: "rejected", reviewedBy: adminUserId, reviewedAt: now }).where(and(eq(orgClaims.id, claimId), eq(orgClaims.status, "pending"))).returning({ id: orgClaims.id, organizationId: orgClaims.organizationId });
    if (res.length === 0) throw new OrgFailure("claim_not_pending");
    await tx.insert(auditLog).values({ actorUserId: adminUserId, action: "claim.rejected", entityType: "organization", entityId: res[0]!.organizationId, meta: { claimId } });
  });
}

export interface MyCampus {
  id: string;
  name: string;
  type: string;
  city: string | null;
  district: string | null;
  role: "owner" | "member";
  /** True while an admin has suspended the campus after a report. It cannot post, browse or be paid for. */
  suspended: boolean;
  membership: HolderMembership;
}

/** The campuses this school user belongs to, each with where its own 12 months stand. */
export async function listMyCampuses(db: Db, userId: string, now: Date = new Date()): Promise<MyCampus[]> {
  const rows = await db
    .select({ id: organizations.id, name: organizations.name, type: organizations.type, city: organizations.city, district: organizations.district, role: orgMembers.role, status: organizations.status })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.organizationId, organizations.id))
    .where(and(eq(orgMembers.userId, userId), inArray(organizations.status, ["claimed", "suspended"])))
    .orderBy(asc(organizations.name));
  return Promise.all(rows.map(async ({ status, ...r }) => ({ ...r, suspended: status === "suspended", membership: await getHolderMembership(db, "org", r.id, now) })));
}

export interface MyClaim {
  id: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
  organizationName: string;
}

/** The user's own claims that are still waiting or were turned down, so the dashboard can say where each stands. */
export async function listMyOpenClaims(db: Db, userId: string): Promise<MyClaim[]> {
  const rows = await db
    .select({ id: orgClaims.id, status: orgClaims.status, createdAt: orgClaims.createdAt, organizationName: organizations.name })
    .from(orgClaims)
    .innerJoin(organizations, eq(orgClaims.organizationId, organizations.id))
    .where(and(eq(orgClaims.userId, userId), inArray(orgClaims.status, ["pending", "rejected"])))
    .orderBy(desc(orgClaims.createdAt))
    .limit(20);
  return rows;
}

/** True when the user is a member of this campus. Used by every school-side action. */
export async function isOrgMember(db: Db, userId: string, organizationId: string): Promise<boolean> {
  if (!/^[0-9a-f-]{36}$/i.test(organizationId)) return false;
  const [m] = await db.select({ u: orgMembers.userId }).from(orgMembers).where(and(eq(orgMembers.userId, userId), eq(orgMembers.organizationId, organizationId))).limit(1);
  return !!m;
}
