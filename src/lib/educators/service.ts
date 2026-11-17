import { and, desc, eq, isNull } from "drizzle-orm";
import { consentIsValid, sha256, WAIVER_KEY, WAIVER_VERSION } from "@/lib/consent/waiver";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { ProfileStatus } from "@/lib/db/schema/domain";
import { publishBlockers, type PublishBlocker } from "./completeness";
import { CONTACT_CHANNELS, type ContactChannel, type ContactsInput, type ProfileInput } from "./profile-input";

const { educatorProfiles, educatorContacts, educatorConsents, auditLog } = schema;
export type ProfileRow = typeof educatorProfiles.$inferSelect;

/** Map a stored profile (plus its contacts) back to the shape the form edits and the rules check. */
export function rowToInput(row: ProfileRow | null, contacts: ContactsInput): ProfileInput {
  return {
    displayName: row?.displayName ?? "",
    headline: row?.headline ?? null,
    bio: row?.bio ?? null,
    city: row?.city ?? null,
    districts: row?.districts ?? [],
    subjects: row?.subjects ?? [],
    levels: row?.levels ?? [],
    languages: row?.languages ?? [],
    teachingModes: row?.teachingModes ?? [],
    openTo: row?.openTo ?? [],
    workAuthorization: row?.workAuthorization ?? null,
    experienceBand: row?.experienceBand ?? null,
    rateMin: row?.rateMin ?? null,
    rateMax: row?.rateMax ?? null,
    credentials: row?.credentials ?? [],
    contacts,
  };
}

export interface EducatorState {
  profile: ProfileRow | null;
  input: ProfileInput;
  waiverValid: boolean;
  /** The educator has agreed to some version of the waiver (possibly an old one, possibly withdrawn). */
  hasWaiverRecord: boolean;
  blockers: PublishBlocker[];
}

export async function getContacts(db: Db, profileId: string): Promise<ContactsInput> {
  const rows = await db.select().from(educatorContacts).where(eq(educatorContacts.educatorId, profileId));
  const out: ContactsInput = {};
  for (const r of rows) if ((CONTACT_CHANNELS as readonly string[]).includes(r.channel)) out[r.channel as ContactChannel] = r.value;
  return out;
}

export async function hasValidWaiver(db: Db, userId: string): Promise<boolean> {
  const [latest] = await db
    .select()
    .from(educatorConsents)
    .where(and(eq(educatorConsents.userId, userId), eq(educatorConsents.documentKey, WAIVER_KEY)))
    .orderBy(desc(educatorConsents.createdAt))
    .limit(1);
  return !!latest && consentIsValid(latest);
}

export async function getEducatorState(db: Db, userId: string): Promise<EducatorState> {
  const [profile] = await db.select().from(educatorProfiles).where(eq(educatorProfiles.userId, userId)).limit(1);
  const contacts = profile ? await getContacts(db, profile.id) : {};
  const input = rowToInput(profile ?? null, contacts);
  const [anyConsent] = await db.select({ id: educatorConsents.id }).from(educatorConsents).where(eq(educatorConsents.userId, userId)).limit(1);
  const waiverValid = await hasValidWaiver(db, userId);
  return { profile: profile ?? null, input, waiverValid, hasWaiverRecord: !!anyConsent, blockers: publishBlockers(input, waiverValid) };
}

export interface RecordWaiverArgs {
  locale: string;
  items: Record<string, boolean>;
  snapshot: string;
  ipHash: string | null;
}

/** Append-only: a new row each time, never an update, so the history of agreements is preserved. */
export async function recordWaiver(db: Db, userId: string, a: RecordWaiverArgs): Promise<void> {
  await db.insert(educatorConsents).values({
    userId,
    documentKey: WAIVER_KEY,
    documentVersion: WAIVER_VERSION,
    locale: a.locale,
    textHash: sha256(a.snapshot),
    textSnapshot: a.snapshot,
    items: a.items,
    ipHash: a.ipHash,
  });
  await db.insert(auditLog).values({ actorUserId: userId, action: "waiver.accepted", entityType: "user", entityId: userId, meta: { version: WAIVER_VERSION, locale: a.locale } });
}

export interface SaveResult {
  profileId: string;
  status: ProfileStatus;
  /** A published profile that no longer met the rules after the edit was taken down to draft. */
  unpublished: boolean;
}

/** Create or update the profile and replace its contacts, in one transaction. */
export async function saveProfile(db: Db, userId: string, v: ProfileInput): Promise<SaveResult> {
  const waiverValid = await hasValidWaiver(db, userId);
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(educatorProfiles).where(eq(educatorProfiles.userId, userId)).limit(1);
    const fields = {
      displayName: v.displayName,
      headline: v.headline,
      bio: v.bio,
      city: v.city,
      districts: v.districts,
      subjects: v.subjects,
      levels: v.levels,
      languages: v.languages,
      teachingModes: v.teachingModes,
      openTo: v.openTo,
      workAuthorization: v.workAuthorization,
      experienceBand: v.experienceBand,
      rateMin: v.rateMin,
      rateMax: v.rateMax,
      credentials: v.credentials,
      currentCountry: "TW",
      countryCode: "TW",
    };
    let id: string;
    let status: ProfileStatus;
    let unpublished = false;
    if (existing) {
      id = existing.id;
      status = existing.status;
      if (status === "published" && publishBlockers(v, waiverValid).length > 0) {
        status = "draft";
        unpublished = true;
      }
      await tx
        .update(educatorProfiles)
        .set({ ...fields, status, ...(unpublished ? { publishedAt: null } : {}) })
        .where(eq(educatorProfiles.id, id));
    } else {
      const [created] = await tx.insert(educatorProfiles).values({ ...fields, userId, status: "draft" }).returning({ id: educatorProfiles.id });
      id = created!.id;
      status = "draft";
    }
    await tx.delete(educatorContacts).where(eq(educatorContacts.educatorId, id));
    const rows = CONTACT_CHANNELS.flatMap((channel) => (v.contacts[channel] ? [{ educatorId: id, channel, value: v.contacts[channel]! }] : []));
    if (rows.length) await tx.insert(educatorContacts).values(rows);
    return { profileId: id, status, unpublished };
  });
}

export type PublishResult = { ok: true } | { ok: false; blockers: PublishBlocker[]; suspended?: boolean };

export async function publishProfile(db: Db, userId: string): Promise<PublishResult> {
  const state = await getEducatorState(db, userId);
  if (!state.profile) return { ok: false, blockers: ["displayName"] };
  if (state.profile.status === "suspended") return { ok: false, blockers: [], suspended: true };
  if (state.blockers.length > 0) return { ok: false, blockers: state.blockers };
  await db
    .update(educatorProfiles)
    .set({ status: "published", publishedAt: state.profile.publishedAt ?? new Date(), hiddenAt: null })
    .where(eq(educatorProfiles.id, state.profile.id));
  await db.insert(auditLog).values({ actorUserId: userId, action: "profile.published", entityType: "educator_profile", entityId: state.profile.id });
  return { ok: true };
}

/** One click, immediate: the profile disappears from every member's view. */
export async function hideProfile(db: Db, userId: string): Promise<boolean> {
  const [row] = await db
    .update(educatorProfiles)
    .set({ status: "hidden", hiddenAt: new Date() })
    .where(and(eq(educatorProfiles.userId, userId), eq(educatorProfiles.status, "published")))
    .returning({ id: educatorProfiles.id });
  if (row) await db.insert(auditLog).values({ actorUserId: userId, action: "profile.hidden", entityType: "educator_profile", entityId: row.id });
  return !!row;
}

/** Withdraw agreement: marks active consents withdrawn and hides the profile at once. */
export async function withdrawWaiver(db: Db, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(educatorConsents)
      .set({ withdrawnAt: new Date() })
      .where(and(eq(educatorConsents.userId, userId), eq(educatorConsents.documentKey, WAIVER_KEY), isNull(educatorConsents.withdrawnAt)));
    const hidden = await tx
      .update(educatorProfiles)
      .set({ status: "hidden", hiddenAt: new Date() })
      .where(and(eq(educatorProfiles.userId, userId), eq(educatorProfiles.status, "published")))
      .returning({ id: educatorProfiles.id });
    await tx.insert(auditLog).values({ actorUserId: userId, action: "waiver.withdrawn", entityType: "user", entityId: userId, meta: { hiddenProfile: hidden.length > 0 } });
  });
}

/** Remove the profile, its contacts and (via the caller) the photo file. The consent history is kept. */
export async function deleteEducatorData(db: Db, userId: string): Promise<{ photoKey: string | null }> {
  const [row] = await db.delete(educatorProfiles).where(eq(educatorProfiles.userId, userId)).returning({ id: educatorProfiles.id, photoKey: educatorProfiles.photoKey });
  if (row) await db.insert(auditLog).values({ actorUserId: userId, action: "profile.deleted", entityType: "educator_profile", entityId: row.id });
  return { photoKey: row?.photoKey ?? null };
}

/** Point the profile at a new photo and return the old key so the caller can delete that file. */
export async function setPhotoKey(db: Db, userId: string, key: string | null): Promise<{ previous: string | null; updated: boolean }> {
  const [existing] = await db.select({ id: educatorProfiles.id, photoKey: educatorProfiles.photoKey }).from(educatorProfiles).where(eq(educatorProfiles.userId, userId)).limit(1);
  if (!existing) return { previous: null, updated: false };
  await db.update(educatorProfiles).set({ photoKey: key }).where(eq(educatorProfiles.id, existing.id));
  return { previous: existing.photoKey, updated: true };
}
