/**
 * Import licensed cram schools (補習班) from a government open-data table.
 *
 *   npm run db:import-cram -- --file cram-schools.csv [--encoding big5] [--dry-run]
 *
 * The file is a CSV (UTF-8 by default; many government files are Big5, use --encoding big5) or a JSON array of rows,
 * with columns such as 補習班名稱, 立案字號, 班別, 縣市, 地址. Only the name, kind, city, district and registration
 * number are kept. Addresses, phone numbers and owner names are read to find the district and then thrown away.
 * Schools are placed inside their district (approximate pins). Re-running updates existing rows by registration number.
 * See docs/LAUNCH_DATA.md for where to get the file and what to check.
 */
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { planImport, rowsFromCsv, rowsFromObjects, type RawRow } from "../src/lib/import/cram";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const file = arg("--file");
  if (!file) throw new Error("Usage: npm run db:import-cram -- --file <csv-or-json> [--encoding big5] [--dry-run]");
  const dry = process.argv.includes("--dry-run");
  const text = new TextDecoder(arg("--encoding") ?? "utf-8").decode(await readFile(file));

  let parsed: { rows: RawRow[]; mapped: string[] };
  if (/^\s*[[{]/.test(text)) {
    const json = JSON.parse(text) as unknown;
    const list = Array.isArray(json) ? json : Object.values(json as Record<string, unknown>).find(Array.isArray);
    parsed = rowsFromObjects((list ?? []) as Record<string, unknown>[]);
  } else {
    parsed = rowsFromCsv(text);
  }
  console.log(`Read ${parsed.rows.length} rows. Columns recognised: ${parsed.mapped.join(", ") || "none"}.`);
  if (!parsed.mapped.includes("name")) throw new Error("No school-name column found. Expected a header such as 補習班名稱.");
  if (!parsed.mapped.includes("address") && !(parsed.mapped.includes("city") && parsed.mapped.includes("district"))) throw new Error("No address (or city and district) columns found. Expected a header such as 地址.");

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
