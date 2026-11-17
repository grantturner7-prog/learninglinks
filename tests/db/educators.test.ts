import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { WAIVER_VERSION, waiverSnapshot } from "@/lib/consent/waiver";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { parseProfileForm } from "@/lib/educators/profile-input";
import {
  deleteEducatorData, getEducatorState, hideProfile, publishProfile, recordWaiver, saveProfile, setPhotoKey, withdrawWaiver,
} from "@/lib/educators/service";
import { TEST_DB_URL, closeTestDb, makeUser, openTestDb, resetTestDb } from "./helpers";

const FORM: Array<[string, string]> = [
  ["displayName", "Emily R."], ["headline", "Kindergarten teacher"], ["bio", "I teach kindergarten classes using phonics, songs and picture books."],
  ["city", "taichung"], ["districts", "taichung:xitun"], ["subjects", "phonics"], ["levels", "kindergarten"], ["languages", "en"],
  ["teachingModes", "in_person"], ["openTo", "part_time"], ["contact_email", "emily@example.com"],
];
const parse = (extra: Array<[string, string]> = [], drop: string[] = []) => {
  const fd = new FormData();
  for (const [k, v] of [...FORM.filter(([k]) => !drop.includes(k)), ...extra]) fd.append(k, v);
  const r = parseProfileForm(fd);
  expect(r.errors).toEqual({});
  return r.values;
};
const waiver = (db: Db, userId: string) =>
  recordWaiver(db, userId, { locale: "zh-TW", items: { terms_privacy: true, publish_to_members: true, contact_on_request: true, truthful: true, notice: true }, snapshot: waiverSnapshot("zh-TW", ["x"]), ipHash: "h" });

describe.skipIf(!TEST_DB_URL)("educator profile lifecycle (real Postgres)", () => {
  let db: Db;
  beforeAll(async () => { db = await openTestDb(); });
  beforeEach(async () => { await resetTestDb(db); });
  afterAll(async () => { await closeTestDb(); });

  it("saves a draft, which is not visible and cannot be published without the waiver", async () => {
    const u = await makeUser(db, "educator");
    const r = await saveProfile(db, u.id, parse());
    expect(r.status).toBe("draft");
    const state = await getEducatorState(db, u.id);
    expect(state.blockers).toEqual(["waiver"]);
    expect(await publishProfile(db, u.id)).toEqual({ ok: false, blockers: ["waiver"] });
  });

  it("records the waiver append-only with the exact wording and publishes", async () => {
    const u = await makeUser(db, "educator");
    await saveProfile(db, u.id, parse());
    await waiver(db, u.id);
    await waiver(db, u.id);
    const rows = await db.select().from(schema.educatorConsents).where(eq(schema.educatorConsents.userId, u.id));
    expect(rows).toHaveLength(2);
    expect(rows[0]!.documentVersion).toBe(WAIVER_VERSION);
    expect(rows[0]!.textHash).toHaveLength(64);
    expect(rows[0]!.textSnapshot).toContain("locale:zh-TW");
    expect(rows[0]!.ipHash).toBe("h");
    expect(await publishProfile(db, u.id)).toEqual({ ok: true });
    expect((await getEducatorState(db, u.id)).profile!.status).toBe("published");
  });

  it("stores contacts separately and replaces them on save", async () => {
    const u = await makeUser(db, "educator");
    await saveProfile(db, u.id, parse([["contact_line", "emily_t"]]));
    expect((await getEducatorState(db, u.id)).input.contacts).toEqual({ email: "emily@example.com", line: "emily_t" });
    await saveProfile(db, u.id, parse([], ["contact_email"]));
    expect((await getEducatorState(db, u.id)).input.contacts).toEqual({});
  });

  it("takes a published profile back to draft when an edit removes something required", async () => {
    const u = await makeUser(db, "educator");
    await saveProfile(db, u.id, parse());
    await waiver(db, u.id);
    await publishProfile(db, u.id);
    const r = await saveProfile(db, u.id, parse([], ["contact_email"]));
    expect(r).toMatchObject({ status: "draft", unpublished: true });
  });

  it("hides at once and can publish again", async () => {
    const u = await makeUser(db, "educator");
    await saveProfile(db, u.id, parse());
    await waiver(db, u.id);
    await publishProfile(db, u.id);
    expect(await hideProfile(db, u.id)).toBe(true);
    expect((await getEducatorState(db, u.id)).profile!.status).toBe("hidden");
    expect(await hideProfile(db, u.id)).toBe(false);
    expect(await publishProfile(db, u.id)).toEqual({ ok: true });
  });

  it("withdrawing the waiver hides the profile and blocks re-publishing until they agree again", async () => {
    const u = await makeUser(db, "educator");
    await saveProfile(db, u.id, parse());
    await waiver(db, u.id);
    await publishProfile(db, u.id);
    await withdrawWaiver(db, u.id);
    const s = await getEducatorState(db, u.id);
    expect(s.profile!.status).toBe("hidden");
    expect(s.waiverValid).toBe(false);
    expect(await publishProfile(db, u.id)).toEqual({ ok: false, blockers: ["waiver"] });
    await waiver(db, u.id);
    expect(await publishProfile(db, u.id)).toEqual({ ok: true });
  });

  it("never lets a suspended profile be published", async () => {
    const u = await makeUser(db, "educator");
    const { profileId } = await saveProfile(db, u.id, parse());
    await waiver(db, u.id);
    await db.update(schema.educatorProfiles).set({ status: "suspended" }).where(eq(schema.educatorProfiles.id, profileId));
    expect(await publishProfile(db, u.id)).toMatchObject({ ok: false, suspended: true });
  });

  it("deletes the profile and contacts but keeps the consent history, and returns the photo key", async () => {
    const u = await makeUser(db, "educator");
    await saveProfile(db, u.id, parse());
    await setPhotoKey(db, u.id, "abc.webp");
    await waiver(db, u.id);
    expect(await deleteEducatorData(db, u.id)).toEqual({ photoKey: "abc.webp" });
    expect((await getEducatorState(db, u.id)).profile).toBeNull();
    expect(await db.select().from(schema.educatorContacts)).toHaveLength(0);
    expect(await db.select().from(schema.educatorConsents)).toHaveLength(1);
  });

  it("deleting the account removes everything it owned", async () => {
    const u = await makeUser(db, "educator");
    await saveProfile(db, u.id, parse());
    await waiver(db, u.id);
    await db.delete(schema.user).where(eq(schema.user.id, u.id));
    expect(await db.select().from(schema.educatorProfiles)).toHaveLength(0);
    expect(await db.select().from(schema.educatorConsents)).toHaveLength(0);
  });
});
