/**
 * Load the reviewed school pictures (data/school-photos.json) and attach each one to its school.
 *
 *   npm run db:import-school-photos                    download each reviewed picture from Wikimedia Commons
 *   npm run db:import-school-photos -- --dir ./thumbs  read <wikidata id>.jpg files from a folder instead
 *   npm run db:import-school-photos -- --dry-run       show what would be attached, change nothing
 *
 * Every entry in the list was looked at by a person: it shows the establishment and no people. The list keeps the
 * fingerprint (SHA-256) of the exact file that was looked at, and a file that differs is refused, so a picture that was
 * changed at the source after the review can never slip in. Only licences that allow reuse are accepted, and the credit
 * each licence requires (author, licence, link) is stored and shown under the picture.
 *
 * Matching is strict (same name, and the same city or a position within a few hundred metres): a wrong picture on a
 * school is worse than none. Re-running is safe: a school that already has that exact picture is skipped, and a
 * picture a school uploaded itself is never replaced.
 *
 * Run it after `npm run db:import-schools` and `npm run db:import-moe`. Needs network access to upload.wikimedia.org
 * unless --dir is given. In this project's cloud workspace add NODE_USE_ENV_PROXY=1.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { isReusableLicence, planSchoolPhotos, type PhotoEntry } from "../src/lib/import/school-photos";
import { setSchoolPhoto } from "../src/lib/orgs/photos";

const args = process.argv.slice(2);
const has = (f: string) => args.includes(f);
const val = (f: string) => (args.includes(f) ? args[args.indexOf(f) + 1] : undefined);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const UA = "school-photo-import/1.0 (reviewed open-licence pictures)";

async function download(url: string): Promise<Buffer> {
  if (!/^https:\/\/upload\.wikimedia\.org\//.test(url)) throw new Error("not a Wikimedia Commons file address");
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA }, redirect: "error" });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status !== 429 && res.status < 500) throw new Error(`HTTP ${res.status}`);
    await sleep(Math.min(300_000, 65_000 * (attempt + 1))); // the library asked us to wait
  }
  throw new Error("still refused after waiting");
}

async function main() {
  const dry = has("--dry-run");
  const dir = val("--dir");
  const file = val("--file") ?? "data/school-photos.json";
  const list = JSON.parse(await readFile(file, "utf8")) as { reviewedOn: string; entries: PhotoEntry[] };
  const entries = list.entries.filter((e) => isReusableLicence(e.licence) && /^[0-9a-f]{64}$/.test(e.sha256));
  console.log(`${list.entries.length} reviewed pictures in ${file} (reviewed ${list.reviewedOn}); ${entries.length} usable.`);

  const db = getDb();
  const o = schema.organizations;
  const schools = await db.select({ id: o.id, name: o.name, city: o.city, lat: o.latitude, lng: o.longitude, source: o.source }).from(o);
  const plan = planSchoolPhotos(entries, schools);
  const how: Record<string, number> = {};
  for (const m of plan.matches) how[m.how] = (how[m.how] ?? 0) + 1;
  const why: Record<string, number> = {};
  for (const l of plan.left) why[l.why] = (why[l.why] ?? 0) + 1;
  console.log(`Matched to a school: ${plan.matches.length}`, how);
  console.log(`Left out: ${plan.left.length}`, why);
  if (dry) {
    for (const m of plan.matches.slice(0, 12)) console.log(`  ${m.entry.zh}  ->  ${m.schoolName}  (${m.how})`);
    console.log("Dry run: nothing was written.");
    return;
  }

  const existing = new Map((await db.select().from(schema.organizationPhotos)).map((p) => [p.organizationId, p]));
  let added = 0, same = 0, kept = 0, changed = 0, failed = 0;
  for (const m of plan.matches) {
    const have = existing.get(m.schoolId);
    if (have?.source === "school_upload") { kept++; continue; } // the school's own picture always wins
    if (have?.reviewedSha256 === m.entry.sha256) { same++; continue; }
    try {
      const bytes = dir ? await readFile(path.join(dir, `${m.entry.wikidata}.jpg`)) : await download(m.entry.thumbUrl);
      if (createHash("sha256").update(bytes).digest("hex") !== m.entry.sha256) {
        changed++;
        console.warn(`  skipped ${m.entry.zh}: the file is not the one that was looked at`);
        continue;
      }
      await setSchoolPhoto(db, m.schoolId, bytes, { source: "wikimedia_commons", author: m.entry.author || null, licence: m.entry.licence, licenceUrl: m.entry.licenceUrl || null, sourceUrl: m.entry.pageUrl || null, reviewedSha256: m.entry.sha256 }, "system:school-photos");
      added++;
      if (!dir) await sleep(2000);
    } catch (err) {
      failed++;
      console.warn(`  could not load ${m.entry.zh}: ${err instanceof Error ? err.message : err}`);
    }
  }
  const [{ n } = { n: 0 }] = (await db.execute<{ n: number }>(sql`select count(*)::int as n from organization_photos`)).rows;
  console.log(`Pictures added: ${added}. Already there: ${same}. School's own picture kept: ${kept}. Changed since review (skipped): ${changed}. Failed: ${failed}.`);
  console.log(`Schools with a picture now: ${n}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
