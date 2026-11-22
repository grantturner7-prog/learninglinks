import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { addCampusAndClaim, approveClaim, listMyCampuses, listPendingClaims, OrgFailure, searchOrganizations, setCampusBilingual, submitClaim } from "@/lib/orgs/service";
import { TEST_DB_URL, closeTestDb, makeUser, openTestDb, resetTestDb } from "./helpers";

describe.skipIf(!TEST_DB_URL)("finding a school: browse by kind and city, add a missing one (real Postgres)", () => {
  let db: Db;
  beforeAll(async () => { db = await openTestDb(); });
  beforeEach(async () => { await resetTestDb(db); });
  afterAll(async () => { await closeTestDb(); });

  const row = (name: string, type: string, ownership: "public" | "private" | null, city: string, source = "moe_open_data") => ({ name, type, ownership, city, source, sourceId: `${source}:${name}` });
  async function seed() {
    await db.insert(schema.organizations).values([
      row("市立中山國小", "elementary", "public", "taichung"),
      row("私立育才國小", "elementary", "private", "new-taipei"),
      row("國立臺灣大學", "university", "public", "taipei"),
      row("東海大學", "university", "private", "taichung"),
      row("Taipei American School", "international_school", "private", "taipei"),
      row("私立玉秀雙語國小", "bilingual_school", "private", "new-taipei"),
      row("Little Moon Kindergarten", "kindergarten", null, "taichung", "osm_import"),
      row("Sunshine English Cram School", "cram_school", null, "taichung", "gov_open_data"),
    ]);
  }
  const names = async (q: string, f: Parameters<typeof searchOrganizations>[2] = {}) => (await searchOrganizations(db, q, f)).map((o) => o.name).sort();

  it("lists every government school, or every private one, with no name typed", async () => {
    await seed();
    expect(await names("", { group: "public" })).toEqual(["市立中山國小", "國立臺灣大學"].sort());
    expect(await names("", { group: "private" })).toEqual(["Taipei American School", "東海大學", "私立玉秀雙語國小", "私立育才國小"].sort());
  });
  it("lists universities, international and bilingual schools, kindergartens, cram and language schools", async () => {
    await seed();
    expect(await names("", { group: "university" })).toEqual(["國立臺灣大學", "東海大學"].sort());
    expect(await names("", { group: "international" })).toEqual(["Taipei American School", "私立玉秀雙語國小"].sort());
    expect(await names("", { group: "kindergarten" })).toEqual(["Little Moon Kindergarten"]);
    expect(await names("", { group: "cram" })).toEqual(["Sunshine English Cram School"]);
  });
  it("narrows by city and by name together", async () => {
    await seed();
    expect(await names("", { group: "university", city: "taichung" })).toEqual(["東海大學"]);
    expect(await names("中山", { city: "taichung" })).toEqual(["市立中山國小"]);
    expect(await names("", { city: "taipei" })).toEqual(["Taipei American School", "國立臺灣大學"].sort());
  });
  it("tells government from private in each hit", async () => {
    await seed();
    const hits = await searchOrganizations(db, "", { group: "university" });
    expect(Object.fromEntries(hits.map((h) => [h.name, h.ownership]))).toEqual({ 國立臺灣大學: "public", 東海大學: "private" });
  });
  it("still needs a real name when nothing is picked, and treats % and _ as plain characters", async () => {
    await seed();
    expect(await names("")).toEqual([]);
    expect(await names("s")).toEqual([]);
    expect(await names("%%")).toEqual([]);
    expect(await names("taipei american")).toEqual(["Taipei American School"]);
  });
  it("lets a school add a campus the lists do not have, including a bilingual school", async () => {
    const user = await makeUser(db, "school");
    const { organization, claim } = await addCampusAndClaim(db, user, { name: "My New Bilingual School", type: "bilingual_school", city: "taichung", district: "taichung:xitun", contactName: "Lin", contactRole: "owner", contactPhone: "0912345678" });
    expect(organization).toMatchObject({ type: "bilingual_school", source: "manual", status: "unclaimed", city: "taichung", ownership: null });
    expect(claim.status).toBe("pending");
    expect((await searchOrganizations(db, "new bilingual")).map((o) => o.name)).toEqual(["My New Bilingual School"]);
    await expect(addCampusAndClaim(db, user, { name: "Nope School", type: "not_a_type", city: "taichung", contactName: "Lin", contactRole: "owner", contactPhone: "0912345678" })).rejects.toBeInstanceOf(OrgFailure);
  });

  describe("the bilingual tick box (the school's own statement)", () => {
    const who = { contactName: "Lin", contactRole: "owner", contactPhone: "0912345678" };
    async function oneSchool(name = "Maple Cram School") {
      const [o] = await db.insert(schema.organizations).values({ name, type: "cram_school", city: "taichung", source: "gov_open_data", sourceId: `t:${name}` }).returning();
      return o!;
    }
    const orgOf = async (id: string) => (await db.select().from(schema.organizations).where(eq(schema.organizations.id, id)))[0]!;

    it("is stored on the claim and reaches the school only when an administrator approves", async () => {
      const user = await makeUser(db, "school");
      const admin = await makeUser(db, "educator", "Admin");
      const org = await oneSchool();
      const claim = await submitClaim(db, user, org.id, { ...who, bilingual: true });
      expect(claim.bilingual).toBe(true);
      expect((await orgOf(org.id)).bilingual).toBe(false); // nothing changes before approval
      expect((await listPendingClaims(db))[0]).toMatchObject({ bilingual: true });
      await approveClaim(db, claim.id, admin.id);
      expect((await orgOf(org.id)).bilingual).toBe(true);
      expect((await listMyCampuses(db, user.id))[0]).toMatchObject({ bilingual: true });
    });
    it("is off unless ticked, and a pending claim leaves the school untouched", async () => {
      const user = await makeUser(db, "school");
      const org = await oneSchool("Quiet School");
      const claim = await submitClaim(db, user, org.id, who);
      expect(claim.bilingual).toBe(false);
      const user2 = await makeUser(db, "school");
      const org2 = await oneSchool("Rejected School");
      await submitClaim(db, user2, org2.id, { ...who, bilingual: true });
      expect((await orgOf(org2.id)).bilingual).toBe(false);
    });
    it("can be ticked while adding a campus that is not on the list", async () => {
      const user = await makeUser(db, "school");
      const admin = await makeUser(db, "educator", "Admin");
      const { organization, claim } = await addCampusAndClaim(db, user, { ...who, name: "Maple Bilingual Kindergarten", type: "kindergarten", city: "taichung", bilingual: true });
      await approveClaim(db, claim.id, admin.id);
      expect(await orgOf(organization.id)).toMatchObject({ type: "kindergarten", bilingual: true, status: "claimed" });
    });
    it("lists a ticked school under International and bilingual, whatever kind it is, and shows the badge in search", async () => {
      const user = await makeUser(db, "school");
      const admin = await makeUser(db, "educator", "Admin");
      const org = await oneSchool("Sunny English Cram");
      await db.insert(schema.organizations).values({ name: "Plain Cram", type: "cram_school", city: "taichung", source: "gov_open_data", sourceId: "t:plain" });
      expect(await names("", { group: "international" })).toEqual([]);
      await approveClaim(db, (await submitClaim(db, user, org.id, { ...who, bilingual: true })).id, admin.id);
      expect(await names("", { group: "international" })).toEqual(["Sunny English Cram"]);
      expect((await searchOrganizations(db, "sunny"))[0]).toMatchObject({ bilingual: true });
      expect((await searchOrganizations(db, "plain"))[0]).toMatchObject({ bilingual: false });
    });
    it("can be turned off and on again by a member of the campus, and is logged", async () => {
      const user = await makeUser(db, "school");
      const admin = await makeUser(db, "educator", "Admin");
      const org = await oneSchool("Toggle School");
      await approveClaim(db, (await submitClaim(db, user, org.id, { ...who, bilingual: true })).id, admin.id);
      await setCampusBilingual(db, user.id, org.id, false);
      expect((await orgOf(org.id)).bilingual).toBe(false);
      await setCampusBilingual(db, user.id, org.id, true);
      expect((await orgOf(org.id)).bilingual).toBe(true);
      const log = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "campus.bilingual_set"));
      expect(log).toHaveLength(2);
      expect(log.map((l) => (l.meta as { value: boolean }).value)).toEqual([false, true]);
    });
    it("cannot be changed by someone who does not belong to the campus, or on a campus nobody has claimed", async () => {
      const owner = await makeUser(db, "school");
      const stranger = await makeUser(db, "school");
      const admin = await makeUser(db, "educator", "Admin");
      const org = await oneSchool("Guarded School");
      await expect(setCampusBilingual(db, owner.id, org.id, true)).rejects.toMatchObject({ code: "not_yours" }); // not a member yet
      await approveClaim(db, (await submitClaim(db, owner, org.id, who)).id, admin.id);
      await expect(setCampusBilingual(db, stranger.id, org.id, true)).rejects.toMatchObject({ code: "not_yours" });
      expect((await orgOf(org.id)).bilingual).toBe(false);
      await expect(setCampusBilingual(db, owner.id, "not-an-id", true)).rejects.toBeInstanceOf(OrgFailure);
    });
  });
});
