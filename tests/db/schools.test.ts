import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { addCampusAndClaim, OrgFailure, searchOrganizations } from "@/lib/orgs/service";
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
});
