import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PhotoError, deletePhoto, isValidPhotoKey, processPhoto, readPhoto, storePhoto } from "@/lib/uploads/photos";

let tmp: string;
beforeAll(async () => {
  tmp = await mkdtemp(path.join(os.tmpdir(), "ll-photos-"));
  process.env.UPLOAD_DIR = tmp;
  process.env.DATABASE_URL ??= "postgres://unused:unused@localhost:5432/unused"; // getEnv() requires it; this test never connects
});
afterAll(async () => { await rm(tmp, { recursive: true, force: true }); });

const jpeg = (w = 800, h = 600) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 120, b: 60 } } }).jpeg().toBuffer();

describe("profile photo pipeline", () => {
  it("outputs a 512x512 WebP", async () => {
    const out = await processPhoto(await jpeg());
    const m = await sharp(out).metadata();
    expect([m.format, m.width, m.height]).toEqual(["webp", 512, 512]);
  });
  it("strips all metadata, including GPS location", async () => {
    const withExif = await sharp(await jpeg()).withExif({ IFD0: { Copyright: "secret-owner" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "24/1 9/1 0/1" } }).jpeg().toBuffer();
    expect((await sharp(withExif).metadata()).exif).toBeDefined();
    const out = await processPhoto(withExif);
    const m = await sharp(out).metadata();
    expect(m.exif).toBeUndefined();
    expect(out.toString("latin1")).not.toContain("secret-owner");
  });
  it("applies EXIF orientation so phone photos stay upright", async () => {
    const rotated = await sharp(await jpeg(800, 400)).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const out = await processPhoto(rotated);
    expect((await sharp(out).metadata()).orientation).toBeUndefined();
  });
  it("rejects files that are not images, including HTML and SVG dressed up as images", async () => {
    await expect(processPhoto(Buffer.from("<html><script>alert(1)</script></html>"))).rejects.toMatchObject({ code: "notAnImage" });
    await expect(processPhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><script>alert(1)</script></svg>'))).rejects.toBeInstanceOf(PhotoError);
    await expect(processPhoto(Buffer.alloc(100, 1))).rejects.toMatchObject({ code: "notAnImage" });
  });
  it("rejects unsupported formats, tiny images and oversized files", async () => {
    const gif = await sharp(await jpeg()).gif().toBuffer();
    await expect(processPhoto(gif)).rejects.toMatchObject({ code: "unsupportedType" });
    await expect(processPhoto(await jpeg(100, 100))).rejects.toMatchObject({ code: "tooSmall" });
    await expect(processPhoto(Buffer.alloc(5 * 1024 * 1024 + 1))).rejects.toMatchObject({ code: "tooLarge" });
  });
  it("stores under a random key, reads it back, and refuses path tricks", async () => {
    const key = await storePhoto(await processPhoto(await jpeg()));
    expect(isValidPhotoKey(key)).toBe(true);
    expect((await readPhoto(key))!.length).toBeGreaterThan(100);
    for (const bad of ["../../etc/passwd", "a.webp", `${key}/../${key}`, "..%2f", ""]) expect(await readPhoto(bad)).toBeNull();
    await deletePhoto(key);
    expect(await readPhoto(key)).toBeNull();
    await deletePhoto("../../etc/passwd");
  });
});
