import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { getEnv } from "@/lib/env";

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_SIZE = 512;
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);
const KEY_RE = /^[0-9a-f]{32}\.webp$/;

export type PhotoErrorCode = "tooLarge" | "notAnImage" | "unsupportedType" | "tooSmall" | "tooManyPixels";
export class PhotoError extends Error {
  constructor(public code: PhotoErrorCode) {
    super(code);
  }
}

/**
 * Turn an uploaded image into the one thing we keep: a 512x512 WebP. The file is decoded and re-encoded, so
 * whatever was hidden in the original (scripts, odd containers, polyglots) is gone, and sharp drops all
 * metadata by default, including GPS location. EXIF orientation is applied first so phone photos stay upright.
 */
export async function processPhoto(input: Buffer): Promise<Buffer> {
  if (input.length > MAX_PHOTO_BYTES) throw new PhotoError("tooLarge");
  let meta: Metadata;
  try {
    meta = await sharp(input, { limitInputPixels: 30_000_000, failOn: "error" }).metadata();
  } catch (err) {
    if (err instanceof Error && /pixel limit/i.test(err.message)) throw new PhotoError("tooManyPixels");
    throw new PhotoError("notAnImage");
  }
  if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) throw new PhotoError("unsupportedType");
  if ((meta.width ?? 0) < 160 || (meta.height ?? 0) < 160) throw new PhotoError("tooSmall");
  try {
    return await sharp(input, { limitInputPixels: 30_000_000, failOn: "error" })
      .rotate()
      .resize(PHOTO_SIZE, PHOTO_SIZE, { fit: "cover", position: sharp.strategy.attention })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new PhotoError("notAnImage");
  }
}

const dir = () => path.resolve(getEnv().UPLOAD_DIR, "photos");

export function isValidPhotoKey(key: string): boolean {
  return KEY_RE.test(key);
}

export async function storePhoto(webp: Buffer): Promise<string> {
  const key = `${randomBytes(16).toString("hex")}.webp`;
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), key), webp, { mode: 0o640 });
  return key;
}

export async function readPhoto(key: string): Promise<Buffer | null> {
  if (!isValidPhotoKey(key)) return null;
  try {
    return await readFile(path.join(dir(), key));
  } catch {
    return null;
  }
}

export async function deletePhoto(key: string | null | undefined): Promise<void> {
  if (!key || !isValidPhotoKey(key)) return;
  await rm(path.join(dir(), key), { force: true });
}
