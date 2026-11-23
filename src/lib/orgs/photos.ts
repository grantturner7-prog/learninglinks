import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import type { SchoolPhotoSource } from "@/lib/db/schema/domain";
import { deleteSchoolPhoto, processSchoolPhoto, storeSchoolPhoto } from "@/lib/uploads/school-photos";

const { organizationPhotos, organizations, auditLog } = schema;

export interface SchoolPhotoCredit {
  source: SchoolPhotoSource;
  author: string | null;
  licence: string | null;
  licenceUrl: string | null;
  sourceUrl: string | null;
  /** SHA-256 of the exact file a person looked at (no people in it, and it shows the school). */
  reviewedSha256: string | null;
}

const clip = (s: string | null, n: number) => (s ? s.trim().slice(0, n) || null : null);
const httpsOnly = (u: string | null) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u.slice(0, 500) : null);

/**
 * Give a school its picture (replacing any it had). The file is re-encoded and its metadata dropped before it is
 * stored. Callers are responsible for the rule that matters most: a person has looked at the picture, it shows the
 * establishment, and there are no people in it.
 */
export async function setSchoolPhoto(db: Db, organizationId: string, image: Buffer, credit: SchoolPhotoCredit, actor: string): Promise<{ key: string; width: number; height: number }> {
  const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!org) throw new Error(`No school ${organizationId}`);
  const { webp, width, height } = await processSchoolPhoto(image);
  const key = await storeSchoolPhoto(webp);
  const values = { photoKey: key, width, height, source: credit.source, author: clip(credit.author, 120), licence: clip(credit.licence, 60), licenceUrl: httpsOnly(credit.licenceUrl), sourceUrl: httpsOnly(credit.sourceUrl), reviewedSha256: credit.reviewedSha256 };
  let old: string | null = null;
  try {
    await db.transaction(async (tx) => {
      const [prev] = await tx.select({ photoKey: organizationPhotos.photoKey }).from(organizationPhotos).where(eq(organizationPhotos.organizationId, organizationId)).for("update").limit(1);
      old = prev?.photoKey ?? null;
      await tx.insert(organizationPhotos).values({ organizationId, ...values }).onConflictDoUpdate({ target: organizationPhotos.organizationId, set: { ...values, createdAt: new Date() } });
      await tx.insert(auditLog).values({ actorUserId: actor, action: "organization.photo_set", entityType: "organization", entityId: organizationId, meta: { source: credit.source, sourceUrl: values.sourceUrl, licence: values.licence, replaced: !!old } });
    });
  } catch (err) {
    await deleteSchoolPhoto(key); // nothing was recorded, so do not leave the file behind
    throw err;
  }
  await deleteSchoolPhoto(old);
  return { key, width, height };
}

/** Take a school's picture down (an admin decided it should not be shown). Returns false when there was none. */
export async function removeSchoolPhoto(db: Db, organizationId: string, actor: string): Promise<boolean> {
  const removed = await db.transaction(async (tx) => {
    const [row] = await tx.delete(organizationPhotos).where(eq(organizationPhotos.organizationId, organizationId)).returning({ photoKey: organizationPhotos.photoKey, sourceUrl: organizationPhotos.sourceUrl });
    if (!row) return null;
    await tx.insert(auditLog).values({ actorUserId: actor, action: "organization.photo_removed", entityType: "organization", entityId: organizationId, meta: { sourceUrl: row.sourceUrl } });
    return row.photoKey;
  });
  if (!removed) return false;
  await deleteSchoolPhoto(removed);
  return true;
}

export async function getSchoolPhotoKey(db: Db, organizationId: string): Promise<string | null> {
  const [row] = await db.select({ photoKey: organizationPhotos.photoKey }).from(organizationPhotos).where(eq(organizationPhotos.organizationId, organizationId)).limit(1);
  return row?.photoKey ?? null;
}
