import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { getEnv } from "@/lib/env";

/** A school picture is shown about 400px wide; this keeps it sharp on a phone without being heavy. */
export const SCHOOL_PHOTO_WIDTH = 960;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const KEY_RE = /^[0-9a-f]{32}\.webp$/;

export interface ProcessedSchoolPhoto {
  webp: Buffer;
  width: number;
  height: number;
}

/**
 * Turn a picture into the one thing we keep: a WebP at most 960px wide. It is decoded and re-encoded, so anything
 * hidden in the original is gone, and all metadata (including where it was taken) is dropped. Very tall or very wide
 * pictures are cropped towards the middle so they fit the card.
 */
export async function processSchoolPhoto(input: Buffer): Promise<ProcessedSchoolPhoto> {
  if (input.length > MAX_INPUT_BYTES) throw new Error("School photo is too large");
  const meta = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" }).metadata();
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw new Error("School photo is not a JPEG, PNG or WebP image");
  if ((meta.width ?? 0) < 320 || (meta.height ?? 0) < 200) throw new Error("School photo is too small");
  const { data, info } = await sharp(input, { limitInputPixels: 40_000_000, failOn: "error" })
    .rotate()
    .resize({ width: SCHOOL_PHOTO_WIDTH, height: Math.round(SCHOOL_PHOTO_WIDTH * 0.75), fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { webp: data, width: info.width, height: info.height };
}

const dir = () => path.resolve(getEnv().UPLOAD_DIR, "schools");

export const isValidSchoolPhotoKey = (key: string): boolean => KEY_RE.test(key);

export async function storeSchoolPhoto(webp: Buffer): Promise<string> {
  const key = `${randomBytes(16).toString("hex")}.webp`;
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), key), webp, { mode: 0o640 });
  return key;
}

export async function readSchoolPhoto(key: string): Promise<Buffer | null> {
  if (!isValidSchoolPhotoKey(key)) return null;
  try {
    return await readFile(path.join(dir(), key));
  } catch {
    return null;
  }
}

/** Remove one stored picture. A missing file is fine: the record is what matters. */
export async function deleteSchoolPhoto(key: string | null | undefined): Promise<void> {
  if (!key || !isValidSchoolPhotoKey(key)) return;
  await unlink(path.join(dir(), key)).catch(() => {});
}
