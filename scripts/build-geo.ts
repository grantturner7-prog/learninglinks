/**
 * Builds the self-hosted Taiwan map data from the `taiwan-atlas` package (MIT), which redistributes the
 * Ministry of the Interior's township boundaries (open government data; attribution is shown on the map).
 *
 * Run:  npm run geo:build
 *
 * Writes:
 *   public/geo/tw/districts.geojson        one polygon per town/district/township (368)
 *   public/geo/tw/counties.geojson         one polygon per city/county (22), merged from the same arcs
 *   src/lib/geo/tw-centroids.generated.ts  anchors, bounding boxes, names (do not edit by hand)
 *
 * KEY SCHEME (stable, used for joins between map polygons, DB rows and UI):
 *   city / county key     = the keys in src/lib/geo/taiwan.ts, e.g. "taichung"            (no colon)
 *   district key          = "<cityKey>:<slug>"
 *     - for the four launch metros the slug is the one already listed in src/lib/geo/taiwan.ts
 *       (matched by Chinese name), e.g. "taichung:xitun"
 *     - for every other city the slug is derived from the official English name
 *       ("Xinying District" -> "xinying"); if two districts of one city would collide, the MOI town code
 *       ("t10014020") is used for both. The dataset is pinned in package.json, so keys do not drift.
 *
 * The far South China Sea islands (Pratas, Taiping) are not present in this dataset.
 */
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import polylabel from "polylabel";
import { feature } from "topojson-client";
import { presimplify, quantile, simplify } from "topojson-simplify";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import type { GeometryCollection } from "topojson-specification";
import { CITIES, DISTRICTS } from "../src/lib/geo/taiwan";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = resolve(root, "public/geo/tw");
const genFile = resolve(root, "src/lib/geo/tw-centroids.generated.ts");

/** Share of topology weight kept. Lower = smaller files and a more stylised coastline. */
const KEEP = 0.62;
/** Decimal places kept in coordinates (4 is about 11 m). */
const DECIMALS = 4;
/** Polygons smaller than this many square degrees are dropped unless they are the feature's only polygon (islets). */
const MIN_AREA = 1e-5;

type Props = {
  TOWNCODE: string;
  COUNTYNAME: string;
  TOWNNAME: string;
  TOWNENG: string;
  COUNTYENG: string;
};

const norm = (s: string) => s.replaceAll("台", "臺").trim();
const slugify = (eng: string) =>
  eng
    .replace(/\s+(District|Township|City|Town)$/i, "")
    .toLowerCase()
    .replaceAll(/['’]/g, "")
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
const cleanEn = (eng: string) => eng.replace(/\s+(District|Township|City|Town)$/i, "");

const topoRaw = JSON.parse(readFileSync(resolve(root, "node_modules/taiwan-atlas/towns-10t.json"), "utf8")) as unknown as Parameters<typeof presimplify>[0];
const simplified = simplify(presimplify(topoRaw), quantile(presimplify(topoRaw), KEEP));

const townsFc = feature(simplified, simplified.objects.towns as GeometryCollection<Props>) as FeatureCollection<Polygon | MultiPolygon, Props>;
const countiesFc = feature(simplified, simplified.objects.counties as GeometryCollection<Props>) as FeatureCollection<Polygon | MultiPolygon, Props>;

// ---------- geometry helpers ----------
const round = (n: number) => Number(n.toFixed(DECIMALS));
const polysOf = (g: Polygon | MultiPolygon): Position[][][] => (g.type === "Polygon" ? [g.coordinates] : g.coordinates);

function cleanRing(ring: Position[]): Position[] | null {
  const out: Position[] = [];
  for (const p of ring) {
    const q: Position = [round(p[0] ?? 0), round(p[1] ?? 0)];
    const last = out[out.length - 1];
    if (!last || last[0] !== q[0] || last[1] !== q[1]) out.push(q);
  }
  const a = out[0];
  const z = out[out.length - 1];
  if (a && z && (a[0] !== z[0] || a[1] !== z[1])) out.push([a[0] ?? 0, a[1] ?? 0]);
  return out.length >= 4 ? out : null;
}

/** Signed planar area of a ring in square degrees (good enough to rank polygons of one island group). */
function ringArea(ring: Position[]): number {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const a = ring[i]!;
    const b = ring[i + 1]!;
    s += (a[0]! * b[1]! - b[0]! * a[1]!) / 2;
  }
  return s;
}
const polyArea = (p: Position[][]) => {
  const [outer, ...holes] = p;
  if (!outer) return 0;
  return Math.abs(ringArea(outer)) - holes.reduce((t, h) => t + Math.abs(ringArea(h)), 0);
};

function cleanGeometry(g: Polygon | MultiPolygon): Polygon | MultiPolygon {
  const all = polysOf(g)
    .map((poly) => poly.map(cleanRing).filter((r): r is Position[] => r !== null))
    .filter((poly) => poly.length > 0);
  const biggest = [...all].sort((a, b) => polyArea(b) - polyArea(a))[0];
  const kept = all.filter((poly) => poly === biggest || polyArea(poly) >= MIN_AREA);
  return kept.length === 1 ? { type: "Polygon", coordinates: kept[0]! } : { type: "MultiPolygon", coordinates: kept };
}

type BBox = [number, number, number, number];
function bboxOf(g: Polygon | MultiPolygon): BBox {
  let w = 180, s = 90, e = -180, n = -90;
  for (const poly of polysOf(g)) for (const p of poly[0] ?? []) {
    w = Math.min(w, p[0]!); e = Math.max(e, p[0]!); s = Math.min(s, p[1]!); n = Math.max(n, p[1]!);
  }
  return [round(w), round(s), round(e), round(n)];
}
const mergeBox = (a: BBox | null, b: BBox): BBox => (a ? [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])] : b);

/** Pole of inaccessibility of the largest polygon: always visually inside the shape, even for crescents. */
function anchorOf(g: Polygon | MultiPolygon): [number, number] {
  const biggest = [...polysOf(g)].sort((a, b) => polyArea(b) - polyArea(a))[0]!;
  const p = polylabel(biggest as unknown as [number, number][][], 0.0004);
  return [round(p[0]), round(p[1])];
}

// ---------- names and keys ----------
const cityByZh = new Map(CITIES.map((c) => [c.zh, c]));
const metroDistrict = new Map(DISTRICTS.map((d) => [`${d.city}|${d.zh}`, d]));

const countyKeyOf = (p: Props): string => {
  const c = cityByZh.get(norm(p.COUNTYNAME));
  if (!c) throw new Error(`Unknown county in dataset: ${p.COUNTYNAME}`);
  return c.key;
};

// Slugs per city, with collision detection.
const slugCount = new Map<string, number>();
for (const f of townsFc.features) {
  const city = countyKeyOf(f.properties);
  const k = `${city}:${slugify(f.properties.TOWNENG)}`;
  slugCount.set(k, (slugCount.get(k) ?? 0) + 1);
}

interface DistrictOut {
  key: string;
  city: string;
  zh: string;
  en: string;
  code: string;
}
const districtMeta: DistrictOut[] = [];
const districtFeatures: Feature<Polygon | MultiPolygon, { key: string; city: string; zh: string; en: string }>[] = [];
const districtGeom = new Map<string, Polygon | MultiPolygon>();
const usedKeys = new Set<string>();
const matchedMetro = new Set<string>();

for (const f of townsFc.features) {
  const p = f.properties;
  const city = countyKeyOf(p);
  const zh = norm(p.TOWNNAME);
  const metro = metroDistrict.get(`${city}|${zh}`);
  let key: string;
  if (metro) {
    key = metro.key;
    matchedMetro.add(metro.key);
  } else {
    const slug = slugify(p.TOWNENG);
    key = (slugCount.get(`${city}:${slug}`) ?? 0) > 1 || !slug ? `${city}:t${p.TOWNCODE}` : `${city}:${slug}`;
  }
  if (usedKeys.has(key)) throw new Error(`Duplicate district key ${key} (${zh})`);
  usedKeys.add(key);
  const en = metro?.en ?? cleanEn(p.TOWNENG);
  const geom = cleanGeometry(f.geometry);
  districtGeom.set(key, geom);
  districtMeta.push({ key, city, zh, en, code: p.TOWNCODE });
  districtFeatures.push({ type: "Feature", properties: { key, city, zh, en }, geometry: geom });
}
const missingMetro = DISTRICTS.filter((d) => !matchedMetro.has(d.key));
if (missingMetro.length) throw new Error(`taiwan.ts districts with no polygon: ${missingMetro.map((d) => d.key).join(", ")}`);

const cityOrder = new Map(CITIES.map((c, i) => [c.key, i]));
districtMeta.sort((a, b) => (cityOrder.get(a.city)! - cityOrder.get(b.city)!) || a.code.localeCompare(b.code));

const countyFeatures: Feature<Polygon | MultiPolygon, { key: string; zh: string; en: string }>[] = [];
const cityGeom = new Map<string, Polygon | MultiPolygon>();
for (const f of countiesFc.features) {
  const c = cityByZh.get(norm(f.properties.COUNTYNAME))!;
  const geom = cleanGeometry(f.geometry);
  cityGeom.set(c.key, geom);
  countyFeatures.push({ type: "Feature", properties: { key: c.key, zh: c.zh, en: c.en }, geometry: geom });
}
const missingCities = CITIES.filter((c) => !cityGeom.has(c.key));
if (missingCities.length) throw new Error(`Cities with no polygon: ${missingCities.map((c) => c.key).join(", ")}`);

// ---------- anchors ----------
/**
 * Where a city's bubble sits. For large, lopsided counties the middle of the polygon is often empty mountains,
 * so we anchor on the seat/urban core district instead. Everything else uses the pole of inaccessibility.
 */
const CITY_ANCHOR_ZH: Record<string, string> = {
  "new-taipei": "板橋區", taoyuan: "桃園區", taichung: "西屯區", tainan: "中西區", kaohsiung: "苓雅區",
  "hsinchu-county": "竹北市", miaoli: "苗栗市", changhua: "彰化市", nantou: "南投市", yunlin: "斗六市",
  "chiayi-county": "太保市", pingtung: "屏東市", yilan: "宜蘭市", hualien: "花蓮市", taitung: "臺東市",
  penghu: "馬公市", kinmen: "金城鎮", lienchiang: "南竿鄉",
};

const districtAnchor: Record<string, [number, number]> = {};
const districtBox: Record<string, BBox> = {};
for (const d of districtMeta) {
  const g = districtGeom.get(d.key)!;
  districtAnchor[d.key] = anchorOf(g);
  districtBox[d.key] = bboxOf(g);
}
const cityAnchor: Record<string, [number, number]> = {};
const cityBox: Record<string, BBox> = {};
const warnings: string[] = [];
for (const c of CITIES) {
  const g = cityGeom.get(c.key)!;
  cityBox[c.key] = bboxOf(g);
  const wantZh = CITY_ANCHOR_ZH[c.key];
  const seat = wantZh ? districtMeta.find((d) => d.city === c.key && d.zh === wantZh) : undefined;
  if (wantZh && !seat) warnings.push(`seat district ${wantZh} not found for ${c.key}; using polygon centre`);
  cityAnchor[c.key] = seat ? districtAnchor[seat.key]! : anchorOf(g);
}

// ---------- country bounds ----------
let all: BBox | null = null;
let main: BBox | null = null;
for (const poly of districtFeatures.flatMap((f) => polysOf(f.geometry))) {
  const b = bboxOf({ type: "Polygon", coordinates: poly });
  all = mergeBox(all, b);
  // "main" = Taiwan island plus Penghu; Kinmen and Matsu sit far off the coast and are reached by panning.
  if (b[0] >= 119.2 && b[2] <= 122.2 && b[1] >= 21.7 && b[3] <= 25.4) main = mergeBox(main, b);
}
if (!all || !main) throw new Error("No geometry");

// ---------- write ----------
mkdirSync(outDir, { recursive: true });
const writeJson = (name: string, data: unknown) => {
  const file = resolve(outDir, name);
  writeFileSync(file, JSON.stringify(data));
  return statSync(file).size;
};
const dBytes = writeJson("districts.geojson", { type: "FeatureCollection", features: districtFeatures });
const cBytes = writeJson("counties.geojson", { type: "FeatureCollection", features: countyFeatures });

const tuple = (t: readonly number[]) => `[${t.join(", ")}]`;
const recordLines = (rec: Record<string, readonly number[]>) =>
  Object.entries(rec).map(([k, v]) => `  ${JSON.stringify(k)}: ${tuple(v)},`).join("\n");

const generated = `// GENERATED by scripts/build-geo.ts (npm run geo:build). Do not edit by hand.
// Source: taiwan-atlas ${(JSON.parse(readFileSync(resolve(root, "node_modules/taiwan-atlas/package.json"), "utf8")) as { version: string }).version} (MIT), from Ministry of the Interior township boundaries (open government data).

export type LngLat = readonly [number, number];
/** [west, south, east, north] */
export type BBox = readonly [number, number, number, number];

export interface GeneratedDistrict {
  /** "<cityKey>:<slug>". Matches src/lib/geo/taiwan.ts for the four launch metros. */
  key: string;
  city: string;
  zh: string;
  /** English name derived from the dataset's official romanisation (the metros use taiwan.ts spellings). */
  en: string;
  /** Ministry of the Interior town code. */
  code: string;
}

/** Every town/district/township in Taiwan (368). Offer districts for more cities by promoting these into taiwan.ts. */
export const ALL_TW_DISTRICTS: readonly GeneratedDistrict[] = ${JSON.stringify(districtMeta)};

/** Where a city's bubble sits (seat or urban-core district for large counties, otherwise pole of inaccessibility). */
export const TW_CITY_ANCHORS: Readonly<Record<string, LngLat>> = {
${recordLines(cityAnchor)}
};

/** Visual centre (pole of inaccessibility) of each district's largest polygon. */
export const TW_DISTRICT_ANCHORS: Readonly<Record<string, LngLat>> = {
${recordLines(districtAnchor)}
};

export const TW_CITY_BBOX: Readonly<Record<string, BBox>> = {
${recordLines(cityBox)}
};

export const TW_DISTRICT_BBOX: Readonly<Record<string, BBox>> = {
${recordLines(districtBox)}
};

export const TW_BOUNDS = {
  /** Taiwan island plus Penghu: the default view. */
  main: ${tuple(main)} as BBox,
  /** Everything in the dataset, including Kinmen and Matsu. */
  all: ${tuple(all)} as BBox,
};
`;
writeFileSync(genFile, generated);

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;
console.log(`districts.geojson ${kb(dBytes)} (${districtFeatures.length} features)`);
console.log(`counties.geojson  ${kb(cBytes)} (${countyFeatures.length} features)`);
console.log(`generated.ts      ${kb(statSync(genFile).size)}`);
console.log(`bounds main=${JSON.stringify(main)} all=${JSON.stringify(all)}`);
for (const w of warnings) console.warn("WARN", w);
