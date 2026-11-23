/**
 * Builds the map shapes for the one-file demo: every city/county (22) and every town/district/township (368) of
 * Taiwan, from the same source as the real site's map (the `taiwan-atlas` package, which redistributes the Ministry
 * of the Interior's boundaries; see scripts/build-geo.ts). Keys and names come from the real site's generated file,
 * so a district key in the demo is the same key the real site stores.
 *
 * Run:  npx tsx docs/demo/export-map.ts          (then: python3 docs/demo/build.py)
 * Writes: docs/demo/taiwan-districts.json
 *
 * Format (compact, decoded by docs/demo/src/map.js):
 *   arcs   shared border lines, each [x0, y0, dx, dy, dx, dy, ...] in whole grid units (Web Mercator, about 34 m)
 *   c      cities:    [key, anchorX, anchorY, inscribedRadius, polygons]
 *   d      districts: [key, en, zh, anchorX, anchorY, inscribedRadius, polygons]
 *          polygons = [ [ring, ring...], ... ], ring = list of arc numbers (~n means arc n backwards), as in TopoJSON
 *   main / all   [x0, y0, x1, y1]: Taiwan with Penghu (the opening view), and everything (with Kinmen and Matsu)
 * A border between two districts is stored once and used by both, so neighbours never gap or overlap.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import polylabel from "polylabel";
import { presimplify, quantile, simplify } from "topojson-simplify";
import { CITIES } from "../../src/lib/geo/taiwan";
import { ALL_TW_DISTRICTS, TW_BOUNDS, TW_CITY_ANCHORS } from "../../src/lib/geo/tw-centroids.generated";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

/** Share of border detail kept (the real site keeps 0.62). Lower = smaller file, more stylised borders. */
const KEEP = Number(process.env.KEEP ?? 0.3);
/** Grid units per degree of longitude. 3000 is about 34 m: fine enough for the demo's deepest zoom. */
const UNITS = 3000;
/** Islets smaller than this (grid units squared) are dropped, unless they are all a district has. */
const MIN_AREA = 900;

type Ring = number[];
type Poly = Ring[];
interface Geom { type: "Polygon" | "MultiPolygon"; arcs: Poly | Poly[]; properties: Record<string, string> }
interface Topo { type: "Topology"; arcs: number[][][]; objects: Record<string, { geometries: Geom[] }> }

const raw = JSON.parse(readFileSync(resolve(root, "node_modules/taiwan-atlas/towns-10t.json"), "utf8")) as Parameters<typeof presimplify>[0];
const pre = presimplify(raw);
const topo = simplify(pre, quantile(pre, KEEP)) as unknown as Topo;

// ---- project every arc to the whole-number grid (x east, y south) ----
const [W0, , , N0] = TW_BOUNDS.all;
const merc = (lat: number) => (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;
const px = (lng: number) => Math.round((lng - W0) * UNITS);
const py = (lat: number) => Math.round((merc(N0) - merc(lat)) * UNITS);
const arcs: [number, number][][] = topo.arcs.map((a) => {
  const out: [number, number][] = [];
  for (const [lng, lat] of a as unknown as [number, number][]) {
    const p: [number, number] = [px(lng), py(lat)];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length === 1) out.push([out[0]![0], out[0]![1]]);
  return out;
});

const arcPts = (i: number) => (i >= 0 ? arcs[i]! : [...arcs[~i]!].reverse());
function ringPts(ring: Ring): [number, number][] {
  const pts: [number, number][] = [];
  for (const i of ring) {
    const a = arcPts(i);
    for (let k = pts.length ? 1 : 0; k < a.length; k++) pts.push(a[k]!);
  }
  return pts;
}
const ringArea = (pts: [number, number][]) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[(i + 1) % pts.length]!;
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
};
const polysOf = (g: Geom): Poly[] => (g.type === "Polygon" ? [g.arcs as Poly] : (g.arcs as Poly[]));

/** Keep the polygons worth drawing; work out where a label sits (the point furthest from every edge) and how much room it has. */
function shape(g: Geom): { polys: Poly[]; ax: number; ay: number; r: number } {
  const all = polysOf(g).map((p) => ({ p, area: ringArea(ringPts(p[0]!)) })).sort((a, b) => b.area - a.area);
  const kept = all.filter((x, i) => i === 0 || x.area >= MIN_AREA);
  const main = kept[0]!.p.map(ringPts);
  const label = polylabel(main.map((r) => [...r, r[0]!]), 2) as number[] & { distance?: number };
  return { polys: kept.map((x) => x.p), ax: Math.round(label[0]!), ay: Math.round(label[1]!), r: Math.max(1, Math.round(label.distance ?? 1)) };
}

const norm = (s: string) => s.replaceAll("台", "臺").trim();
const cityByZh = new Map(CITIES.map((c) => [c.zh, c.key]));
const distByCode = new Map(ALL_TW_DISTRICTS.map((d) => [d.code, d]));

const cities = topo.objects.counties!.geometries.map((g) => {
  const key = cityByZh.get(norm(g.properties.COUNTYNAME!));
  if (!key) throw new Error(`Unknown county ${g.properties.COUNTYNAME}`);
  const s = shape(g);
  // The real site's anchor (the county seat or urban core), so the demo's city bubbles sit where the real ones do.
  const a = TW_CITY_ANCHORS[key];
  return { key, ...s, ax: a ? px(a[0]) : s.ax, ay: a ? py(a[1]) : s.ay };
});
const districts = topo.objects.towns!.geometries.map((g) => {
  const d = distByCode.get(g.properties.TOWNCODE!);
  if (!d) throw new Error(`Unknown town code ${g.properties.TOWNCODE} (${g.properties.TOWNNAME})`);
  return { key: d.key, en: d.en, zh: d.zh, ...shape(g) };
});
if (districts.length !== ALL_TW_DISTRICTS.length) throw new Error(`Expected ${ALL_TW_DISTRICTS.length} districts, got ${districts.length}`);

// ---- keep only the arcs still in use, renumbered ----
const used = new Map<number, number>();
const remap = (polys: Poly[]): Poly[] =>
  polys.map((p) => p.map((r) => r.map((i) => {
    const a = i >= 0 ? i : ~i;
    if (!used.has(a)) used.set(a, used.size);
    const n = used.get(a)!;
    return i >= 0 ? n : ~n;
  })));
const d = districts.map((x) => [x.key, x.en, x.zh, x.ax, x.ay, x.r, remap(x.polys)]);
const c = cities.map((x) => [x.key, x.ax, x.ay, x.r, remap(x.polys)]);
const outArcs: number[][] = [];
for (const [oldI, newI] of used) {
  const a = arcs[oldI]!;
  const flat = [a[0]![0], a[0]![1]];
  for (let i = 1; i < a.length; i++) flat.push(a[i]![0] - a[i - 1]![0], a[i]![1] - a[i - 1]![1]);
  outArcs[newI] = flat;
}

const box = (b: readonly number[]) => [px(b[0]!), py(b[3]!), px(b[2]!), py(b[1]!)];
const out = { source: "Ministry of the Interior open data, via taiwan-atlas", units: UNITS, main: box(TW_BOUNDS.main), all: box(TW_BOUNDS.all), arcs: outArcs, c, d };
const json = JSON.stringify(out);
writeFileSync(resolve(here, "taiwan-districts.json"), json);
const points = outArcs.reduce((n, a) => n + a.length / 2, 0);
console.log(`taiwan-districts.json  ${(json.length / 1024).toFixed(0)} KB  ·  ${c.length} cities, ${d.length} districts, ${outArcs.length} border lines, ${points} points (KEEP=${KEEP})`);
