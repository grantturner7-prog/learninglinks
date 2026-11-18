/**
 * Import licensed cram schools (補習班) from the Ministry of Education's open data.
 *
 *   npm run db:import-cram -- --national [--dry-run] [--save-dir ./cram-raw] [--allow-partial]
 *       Fetches the whole national table itself (22 files, one per city or county, from data.gov.tw dataset 16461).
 *       Run it from a network in Taiwan: the Ministry's server refuses some foreign and cloud addresses.
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
import { columnsOf, planImport, rowsFromCsv, rowsFromObjects, type Field, type RawRow } from "../src/lib/import/cram";
import { DATASET_PAGE, fetchNational } from "../src/lib/import/cram-fetch";

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
    return merge(res.files.map((f) => ({ ...rowsFromObjects(f.rows), columns: columnsOf(f.rows) })));
  }

  const dir = arg("--dir");
  if (dir) {
    const names = (await readdir(dir)).filter((n) => /\.(json|csv)$/i.test(n)).sort();
    if (names.length === 0) throw new Error(`No .json or .csv files in ${dir}.`);
    console.log(`Reading ${names.length} files from ${dir}.`);
    return merge(await Promise.all(names.map(async (n) => parseText(decode(await readFile(join(dir, n)))))));
  }

  const file = arg("--file");
  if (!file) throw new Error("Usage: npm run db:import-cram -- --national | --dir <folder> | --file <csv-or-json>  [--encoding big5] [--dry-run]");
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
  if (dry) { console.log("Dry run: nothing was written."); return; }

  const db = getDb();
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
  console.log(`Imported ${plan.records.length} cram schools.`);
}

main().then(() => closeDb()).catch(async (err) => { console.error(err instanceof Error ? err.message : err); await closeDb().catch(() => {}); process.exit(1); });
