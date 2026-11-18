/**
 * Import the Ministry of Education's school directories: government and private elementary, junior-high and
 * senior-high schools, universities and colleges, and the schools for international residents.
 *
 *   npm run db:import-moe -- --dry-run          fetch and report, write nothing
 *   npm run db:import-moe                       fetch and load
 *   npm run db:import-moe -- --prune            also remove map-data entries that are not schools (departments, branch campuses, buildings)
 *   npm run db:import-moe -- --dir ./moe-raw    read .csv files from a folder instead (names as in --save-dir)
 *   npm run db:import-moe -- --save-dir ./moe-raw   also keep the downloaded files
 *
 * Source: data.gov.tw datasets 6087, 6088, 6089, 6090, 24393, 6091, 28589 and 32958 (Government Open Data License v1).
 * Only the name, kind, public/private, city, district and the school's public website are kept; no addresses and no
 * phone numbers. Schools already in the database from the OpenStreetMap import are recognised by name and city and
 * updated (they keep their exact map position and any claim); the rest are added. Re-running is safe.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq, ne, sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { coreName, NOT_A_SCHOOL, planMoe, rowsFromMoeCsv, type MoeKind, type MoeRecord } from "../src/lib/import/moe";
import { fetchMoe, MOE_SOURCES } from "../src/lib/import/moe-fetch";

const arg = (n: string) => { const i = process.argv.indexOf(n); return i > -1 ? process.argv[i + 1] : undefined; };
const has = (n: string) => process.argv.includes(n);

async function load(): Promise<{ kind: MoeKind; text: string; label: string }[]> {
  const dir = arg("--dir");
  if (dir) {
    const names = (await readdir(dir)).filter((n) => /^moe-\d+\.csv$/.test(n)).sort();
    if (names.length === 0) throw new Error(`No moe-<dataset>.csv files in ${dir} (save them with --save-dir).`);
    return Promise.all(names.map(async (n) => { const id = Number(/moe-(\d+)\.csv/.exec(n)![1]); const s = MOE_SOURCES.find((x) => x.datasetId === id); if (!s) throw new Error(`Unknown file ${n}`); return { kind: s.kind, label: s.label, text: (await readFile(join(dir, n), "utf8")).replace(/^﻿/, "") }; }));
  }
  console.log("Fetching the Ministry of Education school lists from data.gov.tw ...");
  const res = await fetchMoe({ log: console.log });
  if (res.files.length === 0) throw new Error(`Nothing could be fetched (${res.failed[0]?.error ?? "no files"}). The Ministry's host (stats.moe.gov.tw) may be blocked from here.`);
  if (res.failed.length > 0 && !has("--allow-partial")) throw new Error(`${res.failed.length} list(s) failed (${res.failed.map((f) => f.label).join("; ")}). Nothing was imported. Run it again, or add --allow-partial.`);
  const save = arg("--save-dir");
  if (save) { await mkdir(save, { recursive: true }); for (const f of res.files) await writeFile(join(save, `moe-${f.source.datasetId}.csv`), f.text); console.log(`Saved ${res.files.length} raw files to ${save}.`); }
  return res.files.map((f) => ({ kind: f.source.kind, label: f.source.label, text: f.text }));
}

async function main() {
  const dry = has("--dry-run");
  const sets = (await load()).map((f) => { const { rows, columns } = rowsFromMoeCsv(f.text); if (rows.length === 0 || !columns.some((c) => /學校名稱|School name/.test(c))) throw new Error(`${f.label}: no school-name column found (columns: ${columns.join(", ")})`); return { kind: f.kind, rows }; });
  const plan = planMoe(sets);
  console.log(`\nReady: ${plan.records.length} schools. Skipped: ${plan.skipped.no_area} with no recognisable city, ${plan.skipped.duplicate} duplicates.`);
  console.log("By kind:", Object.entries(plan.perType).map(([k, n]) => `${k} ${n}`).join(", "));
  console.log("By ownership:", Object.entries(plan.perOwnership).map(([k, n]) => `${k} ${n}`).join(", "));
  if (plan.unplaced.length) console.log(`Examples that could not be placed:\n  ${plan.unplaced.join("\n  ")}`);

  let db: ReturnType<typeof getDb> | null = null;
  try { db = getDb(); await db.select({ n: sql`1` }).from(schema.organizations).limit(1); } catch { db = null; }
  if (!db) { console.log("No database reachable: skipped the match against existing listings."); if (dry) return; throw new Error("DATABASE_URL is not reachable."); }

  // Match schools already listed (OpenStreetMap import, added by hand): the same core name in the same city. When a name
  // appears more than once in a city (there are many "中山國小"), each Ministry school takes the nearest listing.
  const existing = await db.select({ id: schema.organizations.id, name: schema.organizations.name, city: schema.organizations.city, lat: schema.organizations.latitude, lng: schema.organizations.longitude }).from(schema.organizations).where(ne(schema.organizations.source, "moe_open_data"));
  const already = new Set((await db.select({ sid: schema.organizations.sourceId }).from(schema.organizations).where(eq(schema.organizations.source, "moe_open_data"))).map((r) => r.sid));
  const key = (name: string, city: string | null) => `${coreName(name)}|${city ?? ""}`;
  const pool = new Map<string, typeof existing>();
  for (const e of existing) pool.set(key(e.name, e.city), [...(pool.get(key(e.name, e.city)) ?? []), e]);
  const matched: { id: string; r: MoeRecord }[] = [];
  const fresh: MoeRecord[] = [];
  for (const r of plan.records) {
    const cands = already.has(r.sourceId) ? undefined : pool.get(key(r.name, r.city));
    if (!cands || cands.length === 0) { fresh.push(r); continue; }
    let bi = 0, bd = Infinity;
    cands.forEach((c, i) => { const d = c.lat == null || c.lng == null ? 1e6 : (c.lat - r.latitude) ** 2 + (c.lng - r.longitude) ** 2; if (d < bd) { bd = d; bi = i; } });
    const [hit] = cands.splice(bi, 1);
    matched.push({ id: hit!.id, r });
  }
  console.log(`Already listed from other sources and recognised: ${matched.length}. New to add: ${fresh.length}.`);
  if (dry) { console.log("Dry run: nothing was written."); return; }

  for (let i = 0; i < matched.length; i += 400) {
    const part = matched.slice(i, i + 400);
    const vals = sql.join(part.map(({ id, r }) => sql`(${id}::uuid, ${r.ownership}, ${r.type}, ${r.website})`), sql`, `);
    // Keep the exact position, any claim and any website the school already has; add public/private, the kind and a website.
    await db.execute(sql`update organizations o set ownership = v.ownership, type = v.type, website = coalesce(o.website, v.website), updated_at = now() from (values ${vals}) as v(id, ownership, type, website) where o.id = v.id`);
  }
  for (let i = 0; i < fresh.length; i += 500) {
    await db.insert(schema.organizations).values(fresh.slice(i, i + 500)).onConflictDoUpdate({
      target: [schema.organizations.source, schema.organizations.sourceId],
      targetWhere: sql`${schema.organizations.sourceId} is not null`,
      // Never touch status, claim or contact columns: a school that has been claimed stays claimed.
      set: { name: sql`excluded.name`, nameEn: sql`excluded.name_en`, type: sql`excluded.type`, ownership: sql`excluded.ownership`, city: sql`excluded.city`, district: sql`excluded.district`, latitude: sql`excluded.latitude`, longitude: sql`excluded.longitude`, website: sql`excluded.website`, updatedAt: sql`now()` },
    });
  }
  console.log(`Imported: ${matched.length} existing listings updated, ${fresh.length} schools added.`);

  if (has("--prune")) {
    // Entries from the map data that the Ministry lists do not recognise and whose names say they are a part of a school
    // ("土木工程學系", "…校區", "…分校"). Never touches a listing that anyone has claimed or applied to claim.
    const junk = await db.execute(sql`select id, name from organizations o where source = 'osm_import' and status = 'unclaimed' and ownership is null and type in ('elementary','junior_high','senior_high','university') and not exists (select 1 from org_claims c where c.organization_id = o.id) and not exists (select 1 from org_members m where m.organization_id = o.id)`);
    const ids = (junk.rows as { id: string; name: string }[]).filter((r) => NOT_A_SCHOOL.test(r.name)).map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) await db.delete(schema.organizations).where(sql`${schema.organizations.id} in (${sql.join(ids.slice(i, i + 500).map((x) => sql`${x}::uuid`), sql`, `)})`);
    console.log(`Removed ${ids.length} entries that are parts of schools, not schools.`);
  }
}

main().then(() => closeDb()).catch(async (err) => { console.error(err instanceof Error ? err.message : err); await closeDb().catch(() => {}); process.exit(1); });
