import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { AccountType } from "@/lib/db/schema/auth";
import { getEducatorForAudience, getMemberAudience } from "@/lib/directory/service";
import { startOfDayInZone } from "@/lib/time";
import { decideReveal, type RevealDenied } from "./policy";

const { contactReveals, educatorContacts, educatorProfiles, memberships, orgMembers, organizations } = schema;

export const REVEAL_TIME_ZONE = "Asia/Taipei";

export type RevealResult =
  | { ok: true; channels: { channel: string; value: string }[]; alreadyRevealed: boolean }
  | { ok: false; reason: RevealDenied | "no_contacts" | "not_a_member" };

/**
 * A paying member asks for one educator's contact details. This is the ONLY code that reads `educator_contacts`
 * for someone else. In one transaction (serialised per campus or family by an advisory lock, so two requests
 * cannot both slip under the daily cap) it checks: the member's membership is active; the educator is published and
 * open to this audience; the daily cap (counted per campus for schools, per person for families, by Taipei
 * calendar day) allows it. Only then does it log the reveal and return the channels the educator chose to share.
 * Looking at the same educator again the same day is free and logs nothing new.
 */
export async function revealContact(
  db: Db,
  user: { id: string; accountType: AccountType },
  educatorId: string,
  opts: { dailyCap: number; organizationId?: string; now?: Date },
): Promise<RevealResult> {
  const now = opts.now ?? new Date();
  const audience = await getMemberAudience(db, user, now);
  if (!audience) return { ok: false, reason: "no_membership" };
  const card = await getEducatorForAudience(db, audience, educatorId);
  if (!card) return { ok: false, reason: "unavailable" };

  // Which campus is revealing? Families have none.
  let organizationId: string | null = null;
  if (audience === "school") {
    const campuses = await db
      .select({ id: orgMembers.organizationId })
      .from(orgMembers)
      .innerJoin(memberships, and(eq(memberships.holderType, "org"), eq(memberships.holderId, sql`${orgMembers.organizationId}::text`)))
      .where(and(eq(orgMembers.userId, user.id), sql`${memberships.startsAt} <= ${now}`, sql`${memberships.endsAt} > ${now}`));
    const ids = campuses.map((c) => c.id);
    if (opts.organizationId) {
      if (!ids.includes(opts.organizationId)) return { ok: false, reason: "not_a_member" };
      organizationId = opts.organizationId;
    } else {
      organizationId = ids[0] ?? null;
    }
    if (!organizationId) return { ok: false, reason: "no_membership" };
  }

  const dayStart = startOfDayInZone(now, REVEAL_TIME_ZONE);
  const scope = organizationId ? eq(contactReveals.organizationId, organizationId) : and(eq(contactReveals.userId, user.id), eq(contactReveals.audience, "family"));

  return db.transaction(async (tx): Promise<RevealResult> => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`reveal:${organizationId ?? user.id}`}))`);
    const today = await tx.select({ educatorId: contactReveals.educatorId }).from(contactReveals).where(and(scope, gte(contactReveals.createdAt, dayStart)));
    const distinct = new Set(today.map((r) => r.educatorId));
    const decision = decideReveal({
      hasActiveMembership: true,
      educatorAvailable: true,
      alreadyRevealedToday: distinct.has(educatorId),
      distinctRevealedToday: distinct.size,
      dailyCap: opts.dailyCap,
    });
    if (!decision.allowed) return { ok: false, reason: decision.reason };

    const rows = await tx.select({ channel: educatorContacts.channel, value: educatorContacts.value }).from(educatorContacts).where(eq(educatorContacts.educatorId, educatorId));
    if (rows.length === 0) return { ok: false, reason: "no_contacts" };
    if (decision.countsTowardCap) {
      await tx.insert(contactReveals).values({ userId: user.id, organizationId, audience, educatorId, channels: rows.map((r) => r.channel), createdAt: now });
    }
    return { ok: true, channels: rows, alreadyRevealed: !decision.countsTowardCap };
  });
}

export interface ContactedByView {
  id: string;
  at: Date;
  audience: "school" | "family";
  /** Schools are named (public facts about the campus). A family is never identified: it is shown as "a family". */
  school: { name: string; type: string; city: string | null; district: string | null } | null;
  channels: string[];
}

/** "Who asked for my contact details": the educator's own view, newest first. Names the school, never the family. */
export async function listContactsForEducator(db: Db, userId: string, limit = 50): Promise<ContactedByView[]> {
  const rows = await db
    .select({
      id: contactReveals.id, at: contactReveals.createdAt, audience: contactReveals.audience, channels: contactReveals.channels,
      orgName: organizations.name, orgType: organizations.type, orgCity: organizations.city, orgDistrict: organizations.district,
    })
    .from(contactReveals)
    .innerJoin(educatorProfiles, and(eq(contactReveals.educatorId, educatorProfiles.id), eq(educatorProfiles.userId, userId)))
    .leftJoin(organizations, eq(contactReveals.organizationId, organizations.id))
    .orderBy(desc(contactReveals.createdAt))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id, at: r.at, audience: r.audience, channels: r.channels,
    school: r.audience === "school" && r.orgName ? { name: r.orgName, type: r.orgType!, city: r.orgCity, district: r.orgDistrict } : null,
  }));
}

/** How many distinct educators this campus or family has revealed today, and the cap. For the "you have N left" line. */
export async function revealsLeftToday(db: Db, user: { id: string; accountType: AccountType }, dailyCap: number, now: Date = new Date()): Promise<{ used: number; cap: number }> {
  const dayStart = startOfDayInZone(now, REVEAL_TIME_ZONE);
  if (user.accountType === "family") {
    const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(distinct ${contactReveals.educatorId})::int` }).from(contactReveals).where(and(eq(contactReveals.userId, user.id), eq(contactReveals.audience, "family"), gte(contactReveals.createdAt, dayStart)));
    return { used: n, cap: dailyCap };
  }
  const orgs = await db.select({ id: orgMembers.organizationId }).from(orgMembers).where(eq(orgMembers.userId, user.id));
  if (orgs.length === 0) return { used: 0, cap: dailyCap };
  // The busiest campus decides what the school sees (each campus has its own cap).
  const rows = await db
    .select({ org: contactReveals.organizationId, n: sql<number>`count(distinct ${contactReveals.educatorId})::int` })
    .from(contactReveals)
    .where(and(inArray(contactReveals.organizationId, orgs.map((o) => o.id)), gte(contactReveals.createdAt, dayStart)))
    .groupBy(contactReveals.organizationId);
  return { used: Math.max(0, ...rows.map((r) => r.n)), cap: dailyCap };
}
