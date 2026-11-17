import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getAreaCounts, getEducatorForAudience, getMemberAudience, searchEducators } from "@/lib/directory/service";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { getJobViewer, getSchoolWithJobs, listOpenJobs, listSchoolPoints } from "@/lib/jobs/service";
import { TEST_DB_URL, closeTestDb, makeUser, nowPlus, openTestDb, resetTestDb } from "./helpers";

type Open = "full_time" | "part_time" | "private_tutoring";
async function educator(db: Db, name: string, openTo: Open[], over: Partial<typeof schema.educatorProfiles.$inferInsert> = {}) {
  const u = await makeUser(db, "educator", name);
  const [p] = await db.insert(schema.educatorProfiles).values({
    userId: u.id, displayName: name, status: "published", publishedAt: new Date(), openTo, city: "taichung", districts: ["taichung:xitun"],
    subjects: ["phonics"], levels: ["kindergarten"], languages: ["en"], teachingModes: ["in_person"], workAuthorization: "open_work_rights",
    rateMin: openTo.includes("private_tutoring") ? 600 : null, rateMax: openTo.includes("private_tutoring") ? 900 : null, photoKey: "k.webp", ...over,
  }).returning();
  await db.insert(schema.educatorContacts).values({ educatorId: p!.id, channel: "email", value: `${name}@secret.example` });
  return { user: u, profile: p! };
}

async function payFamily(db: Db, userId: string, startsAt: Date, endsAt: Date) {
  const [o] = await db.insert(schema.orders).values({ holderType: "user", holderId: userId, planCode: "family_tw", amount: 2000, currency: "TWD", countryCode: "TW", status: "paid", provider: "bank_transfer", referenceCode: `R${Math.random()}`, createdByUserId: userId }).returning();
  await db.insert(schema.memberships).values({ holderType: "user", holderId: userId, orderId: o!.id, planCode: "family_tw", startsAt, endsAt });
}
async function paySchool(db: Db, userId: string, startsAt: Date, endsAt: Date) {
  const [org] = await db.insert(schema.organizations).values({ name: "Sunshine", type: "cram_school", city: "taichung", latitude: 24.15, longitude: 120.65 }).returning();
  await db.insert(schema.orgMembers).values({ organizationId: org!.id, userId, role: "owner" });
  const [o] = await db.insert(schema.orders).values({ holderType: "org", holderId: org!.id, planCode: "school_tw", amount: 10000, currency: "TWD", countryCode: "TW", status: "paid", provider: "bank_transfer", referenceCode: `R${Math.random()}`, createdByUserId: userId }).returning();
  await db.insert(schema.memberships).values({ holderType: "org", holderId: org!.id, orderId: o!.id, planCode: "school_tw", startsAt, endsAt });
  return org!;
}

describe.skipIf(!TEST_DB_URL)("who can see which educator (real Postgres)", () => {
  let db: Db;
  beforeAll(async () => { db = await openTestDb(); });
  beforeEach(async () => { await resetTestDb(db); });
  afterAll(async () => { await closeTestDb(); });

  it("lets only a paying member browse: nobody else has an audience", async () => {
    const now = new Date();
    const fam = await makeUser(db, "family");
    const sch = await makeUser(db, "school");
    const edu = await makeUser(db, "educator");
    expect(await getMemberAudience(db, fam, now)).toBeNull();
    expect(await getMemberAudience(db, sch, now)).toBeNull();
    expect(await getMemberAudience(db, edu, now)).toBeNull();
    await payFamily(db, fam.id, nowPlus(-1, now), nowPlus(364, now));
    await paySchool(db, sch.id, nowPlus(-1, now), nowPlus(364, now));
    expect(await getMemberAudience(db, fam, now)).toBe("family");
    expect(await getMemberAudience(db, sch, now)).toBe("school");
    expect(await getMemberAudience(db, edu, now)).toBeNull();
  });

  it("ends access exactly when the 12 months end, and does not start early", async () => {
    const now = new Date();
    const expired = await makeUser(db, "family");
    await payFamily(db, expired.id, nowPlus(-400, now), nowPlus(-35, now));
    const future = await makeUser(db, "family");
    await payFamily(db, future.id, nowPlus(10, now), nowPlus(375, now));
    expect(await getMemberAudience(db, expired, now)).toBeNull();
    expect(await getMemberAudience(db, future, now)).toBeNull();
    expect(await getMemberAudience(db, expired, nowPlus(-100, now))).toBe("family");
  });

  it("does not let a family account act as a school or the reverse", async () => {
    const now = new Date();
    const fam = await makeUser(db, "family");
    await payFamily(db, fam.id, nowPlus(-1, now), nowPlus(364, now));
    expect(await getMemberAudience(db, { id: fam.id, accountType: "school" }, now)).toBeNull();
  });

  it("shows schools only school-side educators, and families only tutors", async () => {
    await educator(db, "SchoolOnly", ["full_time"]);
    await educator(db, "PartTime", ["part_time"]);
    await educator(db, "TutorOnly", ["private_tutoring"]);
    await educator(db, "Both", ["part_time", "private_tutoring"]);
    await educator(db, "Nothing", []);
    const school = (await searchEducators(db, "school", {})).items.map((e) => e.displayName).sort();
    const family = (await searchEducators(db, "family", {})).items.map((e) => e.displayName).sort();
    expect(school).toEqual(["Both", "PartTime", "SchoolOnly"]);
    expect(family).toEqual(["Both", "TutorOnly"]);
  });

  it("never lists draft, hidden or suspended profiles", async () => {
    for (const status of ["draft", "hidden", "suspended"] as const) await educator(db, status, ["full_time", "private_tutoring"], { status });
    expect((await searchEducators(db, "school", {})).total).toBe(0);
    expect((await searchEducators(db, "family", {})).total).toBe(0);
  });

  it("shows an educator in both groups to each audience with only that audience's side", async () => {
    await educator(db, "Both", ["part_time", "private_tutoring"]);
    const school = (await searchEducators(db, "school", {})).items[0]!;
    const family = (await searchEducators(db, "family", {})).items[0]!;
    expect(school.openTo).toEqual(["part_time"]);
    expect(school.rate).toBeNull();
    expect(JSON.stringify(school)).not.toMatch(/tutoring|600|900/);
    expect(family.openTo).toEqual(["private_tutoring"]);
    expect(family.rate).toEqual({ min: 600, max: 900 });
    expect(family.workAuthorization).toBeNull();
    expect(JSON.stringify(family)).not.toMatch(/part_time|full_time/);
  });

  it("never returns contact details or the photo storage key, in lists or on a single card", async () => {
    const { profile } = await educator(db, "Both", ["part_time", "private_tutoring"]);
    for (const a of ["school", "family"] as const) {
      const all = JSON.stringify(await searchEducators(db, a, {})) + JSON.stringify(await getEducatorForAudience(db, a, profile.id));
      expect(all).not.toContain("secret.example");
      expect(all).not.toContain("k.webp");
      expect(all).not.toContain(profile.userId);
    }
  });

  it("gives a single card only to an audience allowed to see that educator", async () => {
    const tutor = await educator(db, "TutorOnly", ["private_tutoring"]);
    expect(await getEducatorForAudience(db, "school", tutor.profile.id)).toBeNull();
    expect((await getEducatorForAudience(db, "family", tutor.profile.id))?.displayName).toBe("TutorOnly");
    expect(await getEducatorForAudience(db, "family", "not-a-uuid")).toBeNull();
    expect(await getEducatorForAudience(db, "family", "00000000-0000-0000-0000-000000000000")).toBeNull();
  });

  it("filters by subject, level, city and district, and paginates", async () => {
    await educator(db, "A", ["full_time"], { subjects: ["phonics"], levels: ["kindergarten"] });
    await educator(db, "B", ["full_time"], { subjects: ["mathematics"], levels: ["senior-high"], city: "taipei", districts: ["taipei:daan"] });
    expect((await searchEducators(db, "school", { subject: "mathematics" })).items.map((e) => e.displayName)).toEqual(["B"]);
    expect((await searchEducators(db, "school", { level: "kindergarten" })).items.map((e) => e.displayName)).toEqual(["A"]);
    expect((await searchEducators(db, "school", { city: "taipei" })).total).toBe(1);
    expect((await searchEducators(db, "school", { district: "taichung:xitun" })).items.map((e) => e.displayName)).toEqual(["A"]);
    for (let i = 0; i < 14; i++) await educator(db, `P${i}`, ["full_time"]);
    const p1 = await searchEducators(db, "school", { page: 1 });
    const p2 = await searchEducators(db, "school", { page: 2 });
    expect(p1.items).toHaveLength(12);
    expect(p2.items).toHaveLength(4);
    expect(p1.total).toBe(16);
    expect(new Set([...p1.items, ...p2.items].map((e) => e.id)).size).toBe(16);
  });

  it("builds map counts from exactly the same visible set, with no names or ids", async () => {
    await educator(db, "A", ["full_time"], { districts: ["taichung:xitun", "taichung:nantun"] });
    await educator(db, "B", ["part_time"], { districts: ["taichung:xitun"] });
    await educator(db, "C", ["full_time"], { districts: [], city: "tainan" });
    await educator(db, "TutorOnly", ["private_tutoring"], { districts: ["taichung:xitun"] });
    const school = await getAreaCounts(db, "school", {});
    expect(school).toEqual([
      { key: "taichung:xitun", level: "district", count: 2 },
      { key: "taichung:nantun", level: "district", count: 1 },
      { key: "tainan", level: "city", count: 1 },
    ]);
    const family = await getAreaCounts(db, "family", {});
    expect(family).toEqual([{ key: "taichung:xitun", level: "district", count: 1 }]);
    expect(JSON.stringify(school)).not.toMatch(/displayName|id"/);
    const list = await searchEducators(db, "school", {});
    expect(list.total).toBe(3);
  });
});

describe.skipIf(!TEST_DB_URL)("job posts and the school map (real Postgres)", () => {
  let db: Db;
  beforeAll(async () => { db = await openTestDb(); });
  beforeEach(async () => { await resetTestDb(db); });
  afterAll(async () => { await closeTestDb(); });

  async function seedJobs() {
    const [org] = await db.insert(schema.organizations).values({ name: "Sunshine English", type: "cram_school", city: "taichung", latitude: 24.15, longitude: 120.65 }).returning();
    await db.insert(schema.organizations).values({ name: "No Coordinates", type: "cram_school", city: "taichung" });
    await db.insert(schema.jobs).values([
      { organizationId: org!.id, title: "Kindergarten teacher", type: "full_time", city: "taichung", subjects: ["phonics"], applyContact: "hr@sunshine.example" },
      { organizationId: org!.id, title: "After-school helper", type: "part_time", city: "taichung" },
      { organizationId: org!.id, title: "Old post", type: "part_time", status: "closed" },
    ]);
    return org!;
  }

  it("shows jobs only to a signed-in educator who has a profile", async () => {
    await seedJobs();
    const withProfile = await educator(db, "Has Profile", ["full_time"]);
    const noProfile = await makeUser(db, "educator");
    const fam = await makeUser(db, "family");
    const sch = await makeUser(db, "school");
    const asEducator = await getJobViewer(db, withProfile.user);
    expect((await listOpenJobs(db, asEducator)).items.map((j) => j.title).sort()).toEqual(["After-school helper", "Kindergarten teacher"]);
    for (const u of [noProfile, fam, sch]) expect((await listOpenJobs(db, await getJobViewer(db, u))).total).toBe(0);
    expect((await listOpenJobs(db, null)).total).toBe(0);
  });

  it("hides jobs from an educator whose profile was suspended", async () => {
    await seedJobs();
    const e = await educator(db, "Suspended", ["full_time"], { status: "suspended" });
    expect((await listOpenJobs(db, await getJobViewer(db, e.user))).total).toBe(0);
  });

  it("filters by type and carries the school's apply contact only to eligible viewers", async () => {
    await seedJobs();
    const e = await educator(db, "E", ["full_time"]);
    const v = await getJobViewer(db, e.user);
    const full = await listOpenJobs(db, v, { type: "full_time" });
    expect(full.items.map((j) => j.title)).toEqual(["Kindergarten teacher"]);
    expect(full.items[0]!.applyContact).toBe("hr@sunshine.example");
    expect(JSON.stringify(await listOpenJobs(db, null))).not.toContain("hr@sunshine.example");
  });

  it("gives a school's detail and open jobs only to eligible educators, and never its private contact fields", async () => {
    const org = await seedJobs();
    await db.update(schema.organizations).set({ contactEmail: "private@school.example", contactPhone: "0422221111" }).where(eq(schema.organizations.id, org.id));
    const e = await educator(db, "E", ["full_time"]);
    const d = await getSchoolWithJobs(db, await getJobViewer(db, e.user), org.id);
    expect(d?.name).toBe("Sunshine English");
    expect(d?.jobs.map((j) => j.title).sort()).toEqual(["After-school helper", "Kindergarten teacher"]);
    expect(JSON.stringify(d)).not.toMatch(/private@school|0422221111/);
    expect(await getSchoolWithJobs(db, null, org.id)).toBeNull();
    expect(await getSchoolWithJobs(db, await getJobViewer(db, await makeUser(db, "school")), org.id)).toBeNull();
    expect(await getSchoolWithJobs(db, await getJobViewer(db, e.user), "not-a-uuid")).toBeNull();
  });

  it("serves school map points (with open-job counts) only to eligible educators", async () => {
    await seedJobs();
    const e = await educator(db, "E", ["full_time"]);
    const pts = await listSchoolPoints(db, await getJobViewer(db, e.user));
    expect(pts).toHaveLength(1);
    expect(pts[0]).toMatchObject({ name: "Sunshine English", jobs: 2, lat: 24.15, lng: 120.65 });
    expect(await listSchoolPoints(db, null)).toEqual([]);
    expect(await listSchoolPoints(db, await getJobViewer(db, await makeUser(db, "family")))).toEqual([]);
  });
});
