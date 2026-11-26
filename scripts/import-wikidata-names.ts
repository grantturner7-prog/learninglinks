/**
 * English names and exact positions for official schools, from Wikidata (CC0).
 *
 *   npm run db:import-wikidata -- --dry-run     fetch and report, write nothing
 *   npm run db:import-wikidata                  fetch and apply
 *   npm run db:import-wikidata -- --file wd-schools.json    use a saved answer instead of asking Wikidata
 *
 * Schools are matched by the Ministry of Education's own school code, which Wikidata records. A school gets an English
 * name only when it has none, and a Ministry-sourced listing is moved from its approximate pin to the school's real
 * position. A claimed listing is never changed. Run it after db:import-moe. See docs/LAUNCH_DATA.md.
 */
import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/lib/db";
import { parseCsv } from "../src/lib/import/cram";
import { planWikidata, type OrgForWikidata, type WikidataSchool } from "../src/lib/import/wikidata";

const QUERY = `SELECT ?code ?zh ?en ?coord WHERE { ?item wdt:P7121 ?code . OPTIONAL { ?item rdfs:label ?en FILTER(LANG(?en) = "en") } OPTIONAL { ?item wdt:P625 ?coord } OPTIONAL { ?item rdfs:label ?zh FILTER(LANG(?zh) = "zh-tw") } }`;

async function fetchSchools(): Promise<WikidataSchool[]> {
  const file = process.argv.includes("--file") ? process.argv[process.argv.indexOf("--file") + 1] : undefined;
  if (file) return (JSON.parse(await readFile(file, "utf8")) as WikidataSchool[]).map((r) => ({ code: r.code ?? "", zh: r.zh ?? "", en: r.en ?? "", coord: r.coord ?? "" }));
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(QUERY)}`, { headers: { Accept: "text/csv", "User-Agent": "LearningLinks-data-import/1.0" }, signal: AbortSignal.timeout(170_000) });
  if (!res.ok) throw new Error(`Wikidata answered HTTP ${res.status}. Try again in a few minutes.`);
  const table = parseCsv(await res.text());
  const h = table[0] ?? [];
  const ix = { code: h.indexOf("code"), zh: h.indexOf("zh"), en: h.indexOf("en"), coord: h.indexOf("coord") };
  if (ix.code < 0) throw new Error("Wikidata's answer was not in the expected shape.");
  return table.slice(1).map((r) => ({ code: r[ix.code] ?? "", zh: r[ix.zh] ?? "", en: r[ix.en] ?? "", coord: r[ix.coord] ?? "" })).filter((r) => r.code);
}

async function main() {
  const dry = process.argv.includes("--dry-run");
  const schools = await fetchSchools();
  console.log(`Wikidata: ${schools.length} schools with a Ministry code, ${schools.filter((s) => s.en).length} with an English name, ${schools.filter((s) => s.coord).length} with a position.`);
  const db = getDb();
  const res = await db.execute(sql`select id, name, name_en as "nameEn", city, latitude, longitude, source, source_id as "sourceId", (status = 'claimed') as claimed from organizations where type in ('kindergarten','elementary','junior_high','senior_high','university','special_education','international_school','bilingual_school')`);
  const plan = planWikidata(res.rows as unknown as OrgForWikidata[], schools);
  console.log(`Ready: ${plan.named} schools get an English name, ${plan.moved} move to their real position.`);
  if (dry) { console.log("Dry run: nothing was written."); return; }
  for (let i = 0; i < plan.updates.length; i += 300) {
    const part = plan.updates.slice(i, i + 300);
    const vals = sql.join(part.map((u) => sql`(${u.id}::uuid, ${u.nameEn ?? null}::text, ${u.latitude ?? null}::float8, ${u.longitude ?? null}::float8)`), sql`, `);
    await db.execute(sql`update organizations o set name_en = coalesce(v.name_en, o.name_en), latitude = coalesce(v.lat, o.latitude), longitude = coalesce(v.lng, o.longitude), updated_at = now() from (values ${vals}) as v(id, name_en, lat, lng) where o.id = v.id and o.status <> 'claimed'`);
  }
  console.log(`Applied ${plan.updates.length} updates.`);
}

main().then(() => closeDb()).catch(async (err) => { console.error(err instanceof Error ? err.message : err); await closeDb().catch(() => {}); process.exit(1); });
