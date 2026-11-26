/**
 * Import licensed cram schools (補習班) from the Ministry of Education's open data.
 *
 *   npm run db:import-cram -- --national [--dry-run] [--prune] [--save-dir ./cram-raw] [--allow-partial]
 *       Fetches the whole national table itself (22 files, one per city or county, from data.gov.tw dataset 16461).
 *       The Ministry's server refuses connections from outside Taiwan; when it does, each file is taken from the copy
 *       data.gov.tw keeps itself (the run says how many files and how old the copy is).
 *       --prune also removes unclaimed cram schools that are no longer on the register (closed or renamed).
 *   npm run db:import-cram -- --cities [--dry-run] [--allow-partial]
 *       Fetches the lists that Taipei, New Taipei, Taichung, Tainan and Nantou publish on their own open-data sites
 *       (about 10,100 schools). These sites answer from anywhere, so this works where --national does not.
 *   npm run db:import-cram -- --dir ./cram-raw [--dry-run]
 *       Reads every .json / .csv file in a folder (for example files saved with --save-dir, or downloaded by hand).
 *   npm run db:import-cram -- --file cram-schools.csv [--encoding big5] [--dry-run]
 *       Reads a single CSV or JSON file.
 *
 * Only the name, kind, city and district are kept (and a registration number when the table has one). Addresses, phone
 * numbers, email addresses and owner names are read to find the district and then thrown away. Schools are placed
 * inside their district (approximate pins). Re-running updates existing rows. Nothing is written with --dry-run.
 * See docs/LAUNCH_DATA.md.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { columnsOf, planImport, reconcileExisting, rowsFromCsv, rowsFromObjects, staleListings, withCity, type ExistingCram, type Field, type RawRow } from "../src/lib/import/cram";
import { DATASET_PAGE, fetchCityLists, fetchNational } from "../src/lib/import/cram-fetch";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

type Parsed = { rows: RawRow[]; mapped: Field[]; columns: string[] };

function parseText(text: string): Parsed {
  if (/^\s*[[{]/.test(text)) {
    const json = JSON.parse(text) as unknown;
    const list = (Array.isArray(json) ? json : Object.values(json as Record<string, unknown>).find(Array.isArray) ?? []) as Record<string, unknown>[];
    return { ...rowsFromObjects(list), columns: columnsOf(list) };
  }
  const r = rowsFromCsv(text);
  return { ...r, columns: [] };
}

function merge(parts: Parsed[]): Parsed {
  return { rows: parts.flatMap((p) => p.rows), mapped: [...new Set(parts.flatMap((p) => p.mapped))], columns: [...new Set(parts.flatMap((p) => p.columns))] };
}

async function load(): Promise<Parsed> {
  const encoding = arg("--encoding") ?? "utf-8";
  const decode = (b: Buffer) => new TextDecoder(encoding).decode(b);

  if (process.argv.includes("--national")) {
    console.log(`Fetching the national cram-school table (${DATASET_PAGE}) ...`);
    const res = await fetchNational({ log: console.log });
    const saveDir = arg("--save-dir");
    if (saveDir) {
      await mkdir(saveDir, { recursive: true });
      for (const [i, f] of res.files.entries()) await writeFile(join(saveDir, `cram-${String(i + 1).padStart(2, "0")}.json`), f.raw);
      console.log(`Saved ${res.files.length} raw files to ${saveDir}.`);
    }
    if (res.files.length === 0) {
      throw new Error(`Nothing could be fetched (${res.failed[0]?.error ?? "no files"}). Run this from a network in Taiwan, or download the files in a browser from ${DATASET_PAGE} into a folder and use --dir <folder>.`);
    }
    if (res.failed.length > 0 && !process.argv.includes("--allow-partial")) {
      throw new Error(`${res.failed.length} of ${res.files.length + res.failed.length} files failed (${res.failed.map((f) => f.label).join(", ")}). Nothing was imported. Run it again, or add --allow-partial to import what arrived.`);
    }
    if (res.suspicious.length > 0) console.log(`Row counts that differ from the published figure:\n  ${res.suspicious.join("\n  ")}`);
    if (res.fromPortalCopy > 0) console.log(`${res.fromPortalCopy} of ${res.files.length} files came from data.gov.tw's own copy${res.portalCopyDate ? ` (made on ${res.portalCopyDate})` : ""}, because the Ministry's server does not answer from here.`);
    return merge(res.files.map((f) => ({ ...rowsFromObjects(f.rows), columns: columnsOf(f.rows) })));
  }

  if (process.argv.includes("--cities")) {
    console.log("Fetching the cram-school lists the cities publish themselves ...");
    const res = await fetchCityLists({ log: console.log });
    if (res.files.length === 0) throw new Error(`Nothing could be fetched (${res.failed[0]?.error ?? "no files"}).`);
    if (res.failed.length > 0 && !process.argv.includes("--allow-partial")) {
      throw new Error(`${res.failed.length} of ${res.files.length + res.failed.length} city lists failed (${res.failed.map((f) => f.label).join(", ")}). Nothing was imported. Run it again, or add --allow-partial to import what arrived.`);
    }
    return merge(res.files.map((f) => {
      const p = parseText(f.text);
      console.log(`  ${f.source.label}: ${p.rows.length} rows`);
      // A city's own file does not repeat the city on every row.
      return { ...p, rows: withCity(p.rows, f.source.city) };
    }));
  }

  const dir = arg("--dir");
  if (dir) {
    const names = (await readdir(dir)).filter((n) => /\.(json|csv)$/i.test(n)).sort();
    if (names.length === 0) throw new Error(`No .json or .csv files in ${dir}.`);
    console.log(`Reading ${names.length} files from ${dir}.`);
    return merge(await Promise.all(names.map(async (n) => parseText(decode(await readFile(join(dir, n)))))));
  }

  const file = arg("--file");
  if (!file) throw new Error("Usage: npm run db:import-cram -- --national | --cities | --dir <folder> | --file <csv-or-json>  [--encoding big5] [--dry-run]");
  return parseText(decode(await readFile(file)));
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const parsed = await load();
  console.log(`Read ${parsed.rows.length} rows. Columns recognised: ${parsed.mapped.join(", ") || "none"}.`);
  const seen = parsed.columns.length > 0 ? ` Columns in the data: ${parsed.columns.join(", ")}.` : "";
  if (!parsed.mapped.includes("name")) throw new Error(`No school-name column found. Expected a header such as 補習班名稱.${seen}`);
  if (!parsed.mapped.includes("address") && !(parsed.mapped.includes("city") && parsed.mapped.includes("district"))) throw new Error(`No address (or city and district) columns found. Expected a header such as 地址.${seen}`);

  const plan = planImport(parsed.rows);
  console.log(`Ready to import ${plan.records.length}. Skipped: ${plan.skipped.no_name} without a name, ${plan.skipped.no_area} with no recognisable city and district, ${plan.skipped.duplicate} duplicates.`);
  const top = Object.entries(plan.perCity).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, n]) => `${c} ${n}`).join(", ");
  console.log(`Largest cities: ${top || "none"}`);
  if (plan.unplaced.length > 0) console.log(`Examples that could not be placed:\n  ${plan.unplaced.join("\n  ")}`);
  const db = getDb();
  const existingRows = async (): Promise<ExistingCram[]> =>
    (await db.execute(sql`select o.id, o.name, o.district, o.source_id as "sourceId",
        (o.status <> 'unclaimed' or exists (select 1 from org_claims c where c.organization_id = o.id) or exists (select 1 from jobs j where j.organization_id = o.id)) as locked
      from organizations o where o.source = 'gov_open_data' and o.source_id like 'gov-cram:%'`)).rows as unknown as ExistingCram[];
  const idsIn = (ids: string[]) => sql.join(ids.map((x) => sql`${x}::uuid`), sql`, `);

  // Listings from an earlier run (or from a city's own list) may carry an id made from another spelling of the same
  // school: bring them up to date first, so this run updates them instead of adding the school again.
  const before = await existingRows();
  const fix = reconcileExisting(before);
  const prune = process.argv.includes("--prune");
  // Pruning needs the whole register: never from a single city's file or a partial fetch.
  const whole = Object.keys(plan.perCity).length >= 20 && plan.records.length >= 12_000;
  if (prune && !whole) throw new Error("--prune needs the whole national register in this run (at least 20 cities and counties). Nothing was changed.");
  const current = new Set(plan.records.map((r) => r.sourceId));
  const stale = prune ? staleListings(before.filter((r) => !fix.remove.includes(r.id)).map((r) => ({ ...r, sourceId: fix.reId.find((x) => x.id === r.id)?.sourceId ?? r.sourceId })), current) : [];
  console.log(`Already loaded: ${before.length}. Listed twice under two spellings: ${fix.remove.length}.${prune ? ` No longer on the register: ${stale.length}${stale.length ? ` (for example ${stale.slice(0, 3).map((s) => s.name).join("; ")})` : ""}.` : ""}`);
  if (dry) { console.log("Dry run: nothing was written."); return; }

  await db.transaction(async (tx) => {
    for (let i = 0; i < fix.remove.length; i += 500) await tx.execute(sql`delete from organizations where status = 'unclaimed' and id in (${idsIn(fix.remove.slice(i, i + 500))})`);
    for (let i = 0; i < fix.reId.length; i += 300) {
      const vals = sql.join(fix.reId.slice(i, i + 300).map((r) => sql`(${r.id}::uuid, ${r.sourceId})`), sql`, `);
      await tx.execute(sql`update organizations o set source_id = v.sid from (values ${vals}) as v(id, sid) where o.id = v.id`);
    }
  });

  for (let i = 0; i < plan.records.length; i += 500) {
    await db
      .insert(schema.organizations)
      .values(plan.records.slice(i, i + 500))
      .onConflictDoUpdate({
        target: [schema.organizations.source, schema.organizations.sourceId],
        targetWhere: sql`${schema.organizations.sourceId} is not null`,
        // Never touch status, claim or contact columns: a school that has been claimed stays claimed.
        set: { name: sql`excluded.name`, type: sql`excluded.type`, city: sql`excluded.city`, district: sql`excluded.district`, latitude: sql`excluded.latitude`, longitude: sql`excluded.longitude`, updatedAt: sql`now()` },
      });
  }
  for (let i = 0; i < stale.length; i += 500) await db.execute(sql`delete from organizations where status = 'unclaimed' and id in (${idsIn(stale.slice(i, i + 500).map((s) => s.id))})`);
  console.log(`Imported ${plan.records.length} cram schools.${fix.remove.length ? ` Joined ${fix.remove.length} double listings.` : ""}${stale.length ? ` Removed ${stale.length} that are no longer on the register.` : ""}`);
}

main().then(() => closeDb()).catch(async (err) => { console.error(err instanceof Error ? err.message : err); await closeDb().catch(() => {}); process.exit(1); });
