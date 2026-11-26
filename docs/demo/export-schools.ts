/**
 * Builds docs/demo/schools-moe.json for the one-file demo: every institution on the map (name, English name when
 * there is one, kind, government or private, city and district only) in a compact form. It reads the database, so
 * run it after the imports (docs/LAUNCH_DATA.md):
 *   npx tsx --env-file-if-exists=.env.local docs/demo/export-schools.ts
 * No addresses, coordinates, websites or contact details go into the demo.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../../src/lib/db";
import { CITIES } from "../../src/lib/geo/taiwan";
import { ALL_TW_DISTRICTS } from "../../src/lib/geo/tw-centroids.generated";

interface Row { name: string; nameEn: string | null; type: string; ownership: string | null; city: string; district: string | null }

async function main() {
  const db = getDb();
  const res = await db.execute(sql`select name, nullif(name_en, '') as "nameEn", type, ownership, city, district from organizations
    where status <> 'suspended' and source <> 'demo' and city is not null and latitude is not null order by city, type, name`);
  const rows = (res.rows as unknown as Row[]).filter((r) => CITIES.some((c) => c.key === r.city));
  const types = [...new Set(rows.map((r) => r.type))];
  const cities = [...new Set(rows.map((r) => r.city))];
  const dkeys = [...new Set(rows.map((r) => r.district).filter((d): d is string => !!d && ALL_TW_DISTRICTS.some((x) => x.key === d)))];
  const dIndex = new Map(dkeys.map((k, i) => [k, i]));
  const out = {
    types,
    cities: cities.map((c) => { const x = CITIES.find((k) => k.key === c)!; return [c, x.en, x.zh]; }),
    dists: dkeys.map((k) => { const d = ALL_TW_DISTRICTS.find((x) => x.key === k)!; return [k, d.en, d.zh]; }),
    // [name, kind, 1 government / 2 private / 0 unknown, city, district or -1, English name when there is one]
    rows: rows.map((r) => {
      const base: (string | number)[] = [r.name, types.indexOf(r.type), r.ownership === "public" ? 1 : r.ownership === "private" ? 2 : 0, cities.indexOf(r.city), r.district && dIndex.has(r.district) ? dIndex.get(r.district)! : -1];
      // The international-school list is in English already: no need to repeat the name.
      if (r.nameEn && r.nameEn !== r.name) base.push(r.nameEn);
      return base;
    }),
  };
  writeFileSync(join(__dirname, "schools-moe.json"), JSON.stringify(out));
  console.log(`${out.rows.length} institutions, ${types.length} kinds, ${out.rows.filter((r) => r.length > 5).length} with an English name -> docs/demo/schools-moe.json`);
}

main().then(() => closeDb()).catch(async (err) => { console.error(err instanceof Error ? err.message : err); await closeDb().catch(() => {}); process.exit(1); });
