/**
 * Import school locations for the educator map.
 *
 * Source: the school dataset from the previous site (about 5,500 Taiwanese schools with names and coordinates,
 * originally seeded from OpenStreetMap). It has NO contact details, and we import none.
 * LICENCE: OpenStreetMap data is ODbL. The map shows "© OpenStreetMap contributors", and counsel should confirm
 * the share-alike obligations before launch (docs/MASTER_PLAN.md §7). Phase 1 still needs the ~17,700 licensed
 * cram schools from government open data; this importer is the template for that one too.
 *
 * Usage: npm run db:import-schools            (fetches from SCHOOLS_SOURCE_URL)
 *        npm run db:import-schools -- --file schools.json
 */
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/lib/db";
import { CITIES } from "../src/lib/geo/taiwan";

const SOURCE = process.env.SCHOOLS_SOURCE_URL ?? "https://taiwan-school-connect.replit.app/api/public-schools/map";
const TW = { minLat: 21.5, maxLat: 25.6, minLng: 118.0, maxLng: 122.5 };

interface Item { id: number; name: string; nameEn: string | null; latitude: number; longitude: number; schoolType: string; city: string | null }
interface Box { minLat: number; maxLat: number; minLng: number; maxLng: number }

const TYPE: Record<string, string> = {
  Kindergarten: "kindergarten", "Elementary School": "elementary", "Middle School": "junior_high", "High School": "senior_high",
  University: "university", "International School": "international_school", "Language School": "language_school", Other: "other",
};
const cityKey = (name: string | null) => {
  const n = (name ?? "").trim().toLowerCase();
  return CITIES.find((c) => c.aliases.includes(n) || c.en.toLowerCase() === n)?.key ?? null;
};

/** The API caps a response at 5,000 rows and says so (`truncated`): split the box until nothing is cut off. */
async function fetchBox(b: Box, depth = 0): Promise<Item[]> {
  const url = `${SOURCE}?minLat=${b.minLat}&maxLat=${b.maxLat}&minLng=${b.minLng}&maxLng=${b.maxLng}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  const data = (await res.json()) as { items: Item[]; truncated?: boolean };
  if (!data.truncated || depth > 6) return data.items;
  const midLat = (b.minLat + b.maxLat) / 2;
  return [...(await fetchBox({ ...b, maxLat: midLat }, depth + 1)), ...(await fetchBox({ ...b, minLat: midLat }, depth + 1))];
}

async function main() {
  const fileIdx = process.argv.indexOf("--file");
  const items: Item[] = fileIdx > -1 ? (JSON.parse(await readFile(process.argv[fileIdx + 1]!, "utf8")).items as Item[]) : await fetchBox(TW);
  const unique = [...new Map(items.map((i) => [i.id, i])).values()].filter(
    (i) => i.name && Number.isFinite(i.latitude) && Number.isFinite(i.longitude) && i.latitude > 21 && i.latitude < 27 && i.longitude > 117 && i.longitude < 124,
  );
  const rows = unique.map((i) => ({
    countryCode: "TW", name: i.name.trim().slice(0, 200), nameEn: i.nameEn?.trim().slice(0, 200) || null, type: TYPE[i.schoolType] ?? "other",
    city: cityKey(i.city), latitude: i.latitude, longitude: i.longitude, source: "osm_import", sourceId: `old-site:${i.id}`,
  }));
  const db = getDb();
  let done = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    await db
      .insert(schema.organizations)
      .values(chunk)
      .onConflictDoUpdate({
        target: [schema.organizations.source, schema.organizations.sourceId],
        targetWhere: sql`${schema.organizations.sourceId} is not null`,
        set: { name: sql`excluded.name`, nameEn: sql`excluded.name_en`, type: sql`excluded.type`, city: sql`excluded.city`, latitude: sql`excluded.latitude`, longitude: sql`excluded.longitude`, updatedAt: sql`now()` },
      });
    done += chunk.length;
  }
  const noCity = rows.filter((r) => !r.city).length;
  console.log(`Imported ${done} schools (${noCity} without a recognised city).`);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
