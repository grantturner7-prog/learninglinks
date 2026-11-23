import { mkdtemp, readdir, unlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { getJobViewer, getSchoolWithJobs } from "@/lib/jobs/service";
import { ModerationFailure, submitReport } from "@/lib/moderation/service";
import { getSchoolPhotoKey, removeSchoolPhoto, setSchoolPhoto, type SchoolPhotoCredit } from "@/lib/orgs/photos";
import { processSchoolPhoto, readSchoolPhoto } from "@/lib/uploads/school-photos";
import { TEST_DB_URL, closeTestDb, makeUser, openTestDb, resetTestDb } from "./helpers";

const credit: SchoolPhotoCredit = { source: "wikimedia_commons", author: "A. Photographer", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0", sourceUrl: "https://commons.wikimedia.org/wiki/File:Gate.jpg", reviewedSha256: "b".repeat(64) };
const picture = (w = 1600, h = 1000) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 180, g: 160, b: 220 } } }).withExif({ IFD0: { Copyright: "secret owner", Artist: "hidden name" } }).jpeg().toBuffer();

describe.skipIf(!TEST_DB_URL)("school pictures (real Postgres)", () => {
  let db: Db;
  let dir: string;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "ll-school-photos-"));
    process.env.UPLOAD_DIR = dir;
    db = await openTestDb();
  });
  const files = async () => (await readdir(path.join(dir, "schools")).catch(() => [])).sort();
  beforeEach(async () => {
    await resetTestDb(db);
    // Each test starts with an empty picture folder, so "no file left behind" means what it says.
    for (const f of await files()) await unlink(path.join(dir, "schools", f));
  });
  afterAll(async () => { await closeTestDb(); });

  async function school(extra: Partial<typeof schema.organizations.$inferInsert> = {}) {
    const [o] = await db.insert(schema.organizations).values({ name: "市立測試國小", type: "elementary", city: "taichung", district: "taichung:xitun", latitude: 24.17, longitude: 120.62, address: "臺中市西屯區測試路1號", ownership: "public", source: "moe_open_data", sourceId: `t:${Math.random()}`, ...extra }).returning();
    return o!;
  }
  async function educatorWithProfile() {
    const u = await makeUser(db, "educator", "Lin");
    await db.insert(schema.educatorProfiles).values({ userId: u.id, displayName: "Lin", status: "published", publishedAt: new Date(), openTo: ["full_time"], city: "taichung", districts: [], subjects: ["phonics"], levels: ["elementary"], languages: ["en"], teachingModes: ["in_person"], workAuthorization: "open_work_rights" });
    return getJobViewer(db, u);
  }

  it("keeps a re-encoded copy no wider than 960px with every hidden detail removed", async () => {
    const out = await processSchoolPhoto(await picture());
    expect(out.width).toBe(960);
    expect(out.height).toBe(600);
    const meta = await sharp(out.webp).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(out.webp.includes(Buffer.from("secret owner"))).toBe(false);
    await expect(processSchoolPhoto(Buffer.from("not a picture"))).rejects.toThrow();
    await expect(processSchoolPhoto(await picture(200, 120))).rejects.toThrow(/too small/);
  });

  it("an educator with a profile sees the picture's credit and the school's address; nobody else gets the school at all", async () => {
    const s = await school();
    const viewer = await educatorWithProfile();
    expect((await getSchoolWithJobs(db, viewer, s.id))!.photo).toBeNull();

    await setSchoolPhoto(db, s.id, await picture(), credit, "system:test");
    const card = (await getSchoolWithJobs(db, viewer, s.id))!;
    expect(card).toMatchObject({ name: "市立測試國小", address: "臺中市西屯區測試路1號", ownership: "public" });
    expect(card.photo).toMatchObject({ source: "wikimedia_commons", author: "A. Photographer", licence: "CC BY-SA 4.0", licenceUrl: credit.licenceUrl, sourceUrl: credit.sourceUrl, width: 960, height: 600 });
    // never the private contact fields
    expect(JSON.stringify(card)).not.toMatch(/contactEmail|contactPhone/);

    const family = await makeUser(db, "family");
    expect(await getSchoolWithJobs(db, await getJobViewer(db, family), s.id)).toBeNull();
    expect(await getSchoolWithJobs(db, null, s.id)).toBeNull();
    const noProfile = await makeUser(db, "educator", "New");
    expect(await getSchoolWithJobs(db, await getJobViewer(db, noProfile), s.id)).toBeNull();
  });

  it("stores one picture per school, replaces it cleanly and writes the record", async () => {
    const s = await school();
    const first = await setSchoolPhoto(db, s.id, await picture(), credit, "system:test");
    expect(await files()).toEqual([first.key]);
    expect(await readSchoolPhoto(first.key)).not.toBeNull();

    const second = await setSchoolPhoto(db, s.id, await picture(1200, 900), { ...credit, reviewedSha256: "c".repeat(64) }, "system:test");
    expect(await files()).toEqual([second.key]); // the old file is gone, not left behind
    expect(await db.select().from(schema.organizationPhotos)).toHaveLength(1);
    expect(await getSchoolPhotoKey(db, s.id)).toBe(second.key);
    const actions = (await db.select().from(schema.auditLog).where(eq(schema.auditLog.entityId, s.id))).map((a) => a.action);
    expect(actions.filter((a) => a === "organization.photo_set")).toHaveLength(2);
  });

  it("only keeps secure links in the credit, and trims an over-long author", async () => {
    const s = await school();
    await setSchoolPhoto(db, s.id, await picture(), { ...credit, licenceUrl: "javascript:alert(1)", sourceUrl: "http://insecure.example/x", author: "x".repeat(400) }, "system:test");
    const [row] = await db.select().from(schema.organizationPhotos);
    expect(row).toMatchObject({ licenceUrl: null, sourceUrl: null });
    expect(row!.author).toHaveLength(120);
  });

  it("refuses a picture for a school that does not exist, and leaves no file behind", async () => {
    await expect(setSchoolPhoto(db, "00000000-0000-4000-8000-000000000000", await picture(), credit, "system:test")).rejects.toThrow();
    await expect(setSchoolPhoto(db, (await school()).id, Buffer.from("junk"), credit, "system:test")).rejects.toThrow();
    expect(await files()).toEqual([]);
    expect(await db.select().from(schema.organizationPhotos)).toHaveLength(0);
  });

  it("an admin can take a picture down: the school stays, the file and the record go, and it is written down", async () => {
    const s = await school();
    const admin = await makeUser(db, "educator", "Admin");
    await setSchoolPhoto(db, s.id, await picture(), credit, "system:test");
    expect(await removeSchoolPhoto(db, s.id, admin.id)).toBe(true);
    expect(await files()).toEqual([]);
    expect(await db.select().from(schema.organizationPhotos)).toHaveLength(0);
    expect(await db.select().from(schema.organizations).where(eq(schema.organizations.id, s.id))).toHaveLength(1);
    const [audit] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "organization.photo_removed"));
    expect(audit).toMatchObject({ actorUserId: admin.id, entityId: s.id });
    expect(await removeSchoolPhoto(db, s.id, admin.id)).toBe(false); // nothing to take down the second time
    expect((await getSchoolWithJobs(db, await educatorWithProfile(), s.id))!.photo).toBeNull();
  });

  it("a school with no published address shows none (only its area is known)", async () => {
    const s = await school({ address: null, source: "gov_open_data" });
    expect((await getSchoolWithJobs(db, await educatorWithProfile(), s.id))!.address).toBeNull();
  });

  describe("reporting a school's picture", () => {
    const code = async (p: Promise<unknown>) => p.then(() => "ok", (e: unknown) => (e instanceof ModerationFailure ? e.code : `threw ${String(e)}`));
    async function educatorUser() {
      const u = await makeUser(db, "educator", "Rep");
      await db.insert(schema.educatorProfiles).values({ userId: u.id, displayName: "Rep", status: "published", publishedAt: new Date(), openTo: ["full_time"], city: "taichung", districts: [], subjects: ["phonics"], levels: ["elementary"], languages: ["en"], teachingModes: ["in_person"], workAuthorization: "open_work_rights" });
      return u;
    }

    it("a school nobody has claimed can be reported for its picture, and for nothing else", async () => {
      const s = await school(); // unclaimed
      const u = await educatorUser();
      await setSchoolPhoto(db, s.id, await picture(), credit, "system:test");
      expect(await code(submitReport(db, u, { targetType: "organization", targetId: s.id, reason: "picture" }))).toBe("ok");
      expect(await code(submitReport(db, u, { targetType: "organization", targetId: s.id, reason: "misleading" }))).toBe("not_found");
      const [rep] = await db.select().from(schema.reports);
      expect(rep).toMatchObject({ reason: "picture", status: "open", targetId: s.id });
      expect((await getSchoolWithJobs(db, await getJobViewer(db, u), s.id))!.claimed).toBe(false);
    });

    it("a picture report needs a picture", async () => {
      const s = await school();
      const u = await educatorUser();
      expect(await code(submitReport(db, u, { targetType: "organization", targetId: s.id, reason: "picture" }))).toBe("not_found");
      expect(await db.select().from(schema.reports)).toHaveLength(0);
    });

    it("a school that has joined can be reported for anything, including its picture", async () => {
      const s = await school({ status: "claimed", claimedAt: new Date() });
      const u = await educatorUser();
      await setSchoolPhoto(db, s.id, await picture(), credit, "system:test");
      expect(await code(submitReport(db, u, { targetType: "organization", targetId: s.id, reason: "misleading" }))).toBe("ok");
      const u2 = await educatorUser();
      expect(await code(submitReport(db, u2, { targetType: "organization", targetId: s.id, reason: "picture" }))).toBe("ok");
      expect((await getSchoolWithJobs(db, await getJobViewer(db, u), s.id))!.claimed).toBe(true);
    });

    it("only people who can see the school card may report: not families, not educators without a profile, never a suspended school", async () => {
      const s = await school();
      await setSchoolPhoto(db, s.id, await picture(), credit, "system:test");
      expect(await code(submitReport(db, await makeUser(db, "family"), { targetType: "organization", targetId: s.id, reason: "picture" }))).toBe("not_allowed");
      expect(await code(submitReport(db, await makeUser(db, "educator", "NoProfile"), { targetType: "organization", targetId: s.id, reason: "picture" }))).toBe("not_allowed");
      await db.update(schema.organizations).set({ status: "suspended" }).where(eq(schema.organizations.id, s.id));
      expect(await code(submitReport(db, await educatorUser(), { targetType: "organization", targetId: s.id, reason: "picture" }))).toBe("not_found");
      // "picture" is not a reason for an educator or a job post
      expect(await code(submitReport(db, await educatorUser(), { targetType: "job", targetId: s.id, reason: "picture" }))).toBe("invalid_reason");
    });
  });
});
