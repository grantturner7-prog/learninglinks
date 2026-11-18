/**
 * Builds docs/demo/schools-moe.json for the one-file demo: the Ministry of Education school lists (name, kind,
 * public/private, city, district only) in a compact form. Run after `npm run db:import-moe -- --save-dir <dir>`:
 *   npx tsx docs/demo/export-schools.ts <dir>
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { planMoe, rowsFromMoeCsv } from "../../src/lib/import/moe";
import { MOE_SOURCES } from "../../src/lib/import/moe-fetch";
import { CITIES } from "../../src/lib/geo/taiwan";
import { ALL_TW_DISTRICTS } from "../../src/lib/geo/tw-centroids.generated";

const dir = process.argv[2];
if (!dir) throw new Error("Usage: npx tsx docs/demo/export-schools.ts <dir with moe-<dataset>.csv files>");
const sets = readdirSync(dir).filter((n) => /^moe-\d+\.csv$/.test(n)).sort().map((n) => {
  const s = MOE_SOURCES.find((x) => x.datasetId === Number(/moe-(\d+)/.exec(n)![1]))!;
  return { kind: s.kind, rows: rowsFromMoeCsv(readFileSync(join(dir, n), "utf8").replace(/^﻿/, "")).rows };
});
const plan = planMoe(sets);
const types = [...new Set(plan.records.map((r) => r.type))];
const cities = [...new Set(plan.records.map((r) => r.city))];
const dkeys = [...new Set(plan.records.map((r) => r.district).filter((d): d is string => !!d))];
const out = {
  types,
  cities: cities.map((c) => { const x = CITIES.find((k) => k.key === c)!; return [c, x.en, x.zh]; }),
  dists: dkeys.map((k) => { const d = ALL_TW_DISTRICTS.find((x) => x.key === k)!; return [k, d.en, d.zh]; }),
  rows: plan.records.map((r) => [r.name, types.indexOf(r.type), r.ownership === "public" ? 1 : r.ownership === "private" ? 2 : 0, cities.indexOf(r.city), r.district ? dkeys.indexOf(r.district) : -1]),
};
writeFileSync(join(__dirname, "schools-moe.json"), JSON.stringify(out));
console.log(`${out.rows.length} schools, ${types.length} kinds -> docs/demo/schools-moe.json`);
