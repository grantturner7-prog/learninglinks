import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Feature, FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { anchorOf, bboxOfKey, getCountryMap, levelOfKey, requireCountryMap } from "@/lib/geo";
import { CITIES, DISTRICTS } from "@/lib/geo/taiwan";
import { ALL_TW_DISTRICTS, TW_BOUNDS } from "@/lib/geo/tw-centroids.generated";

type Fc = FeatureCollection<Polygon | MultiPolygon, { key: string; city?: string; zh: string; en: string }>;
const load = (name: string) => JSON.parse(readFileSync(resolve(__dirname, "../public/geo/tw", name), "utf8")) as Fc;
const districts = load("districts.geojson");
const counties = load("counties.geojson");

function inRing(pt: Position, ring: Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi! > pt[1]! !== yj! > pt[1]! && pt[0]! < ((xj! - xi!) * (pt[1]! - yi!)) / (yj! - yi!) + xi!) inside = !inside;
  }
  return inside;
}
function inFeature(pt: Position, f: Feature<Polygon | MultiPolygon>): boolean {
  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  return polys.some(([outer, ...holes]) => outer && inRing(pt, outer) && !holes.some((h) => inRing(pt, h)));
}

describe("Taiwan map data", () => {
  it("has a polygon for every one of the 22 cities and counties", () => {
    expect(counties.features).toHaveLength(22);
    for (const c of CITIES) {
      const hits = counties.features.filter((f) => f.properties.key === c.key);
      expect(hits, c.key).toHaveLength(1);
    }
  });

  it("has exactly one polygon for every district listed in taiwan.ts", () => {
    for (const d of DISTRICTS) {
      const hits = districts.features.filter((f) => f.properties.key === d.key);
      expect(hits, d.key).toHaveLength(1);
      expect(hits[0]!.properties.city).toBe(d.city);
    }
  });

  it("has unique keys and covers all 368 towns", () => {
    const keys = districts.features.map((f) => f.properties.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toHaveLength(368);
    expect(ALL_TW_DISTRICTS).toHaveLength(368);
    for (const d of ALL_TW_DISTRICTS) {
      expect(levelOfKey(d.key)).toBe("district");
      expect(CITIES.some((c) => c.key === d.city)).toBe(true);
      expect(d.key.startsWith(`${d.city}:`)).toBe(true);
    }
  });

  it("puts every anchor inside Taiwan's bounds and inside its own polygon", () => {
    const cfg = requireCountryMap("TW");
    const [w, s, e, n] = TW_BOUNDS.all;
    for (const f of counties.features) {
      const a = anchorOf(cfg, f.properties.key)!;
      expect(a, f.properties.key).toBeTruthy();
      expect(a[0] >= w && a[0] <= e && a[1] >= s && a[1] <= n, f.properties.key).toBe(true);
      expect(inFeature([a[0], a[1]], f), `${f.properties.key} anchor inside polygon`).toBe(true);
    }
    for (const f of districts.features) {
      const a = anchorOf(cfg, f.properties.key)!;
      expect(a, f.properties.key).toBeTruthy();
      expect(inFeature([a[0], a[1]], f), `${f.properties.key} anchor inside polygon`).toBe(true);
    }
  });

  it("gives every key a bounding box that contains its anchor", () => {
    const cfg = requireCountryMap("TW");
    for (const key of [...CITIES.map((c) => c.key), ...DISTRICTS.map((d) => d.key)]) {
      const b = bboxOfKey(cfg, key)!;
      const a = anchorOf(cfg, key)!;
      expect(a[0] >= b[0] && a[0] <= b[2] && a[1] >= b[1] && a[1] <= b[3], key).toBe(true);
    }
  });

  it("keeps the web payload small and the default view on the main island", () => {
    const total = statSync(resolve(__dirname, "../public/geo/tw/districts.geojson")).size + statSync(resolve(__dirname, "../public/geo/tw/counties.geojson")).size;
    expect(total).toBeLessThan(1.5 * 1024 * 1024);
    const [w, s, e, n] = TW_BOUNDS.main;
    expect(w).toBeGreaterThan(119);
    expect(e).toBeLessThan(122.5);
    expect(s).toBeGreaterThan(21.5);
    expect(n).toBeLessThan(25.6);
  });

  it("is configured per country so other markets can be added", () => {
    expect(getCountryMap("TW")?.districtsUrl).toBe("/geo/tw/districts.geojson");
    expect(getCountryMap("TH")).toBeUndefined();
    expect(() => requireCountryMap("TH")).toThrow();
    const cfg = requireCountryMap("TW");
    expect(cfg.label("taichung:xitun", "zh-TW")).toBe("西屯區");
    expect(cfg.label("taichung:xitun", "en-TW")).toBe("Xitun");
    expect(cfg.label("taichung", "en-TW")).toBe("Taichung City");
    expect(cfg.label("nope", "en-TW")).toBe("nope");
  });

  it("serves a MapLibre worker that matches the installed version (run `npm run sync:map-worker` after upgrading)", () => {
    const vendored = readFileSync(resolve(__dirname, "../public/vendor/maplibre/maplibre-gl-worker.mjs"));
    const installed = readFileSync(resolve(__dirname, "../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs"));
    expect(vendored.equals(installed)).toBe(true);
  });
});

describe("full area names", () => {
  it("adds what kind of place it is in English, because several cities have an East or a Xinyi", async () => {
    const { requireCountryMap } = await import("@/lib/geo");
    const tw = requireCountryMap("TW");
    expect(tw.label("taichung:xitun", "en-TW")).toBe("Xitun");
    expect(tw.longLabel("taichung:xitun", "en-TW")).toBe("Xitun District");
    expect(tw.longLabel("taichung:east", "en-TW")).toBe("East District");
    expect(tw.longLabel("changhua:shetou", "en-TW")).toBe("Shetou Township");
    expect(tw.longLabel("changhua:changhua", "en-TW")).toBe("Changhua City");
  });

  it("leaves Chinese names and city names as they are", async () => {
    const { requireCountryMap } = await import("@/lib/geo");
    const tw = requireCountryMap("TW");
    expect(tw.longLabel("taichung:xitun", "zh-TW")).toBe("西屯區");
    expect(tw.longLabel("taichung", "en-TW")).toBe("Taichung City");
    expect(tw.longLabel("taichung", "zh-TW")).toBe("臺中市");
    expect(tw.longLabel("nowhere:at-all", "en-TW")).toBe("nowhere:at-all");
  });

  it("gives every one of the 368 districts a full English name that says what it is", async () => {
    const { ALL_TW_DISTRICTS, requireCountryMap } = await import("@/lib/geo");
    const tw = requireCountryMap("TW");
    expect(ALL_TW_DISTRICTS).toHaveLength(368);
    for (const d of ALL_TW_DISTRICTS) expect(tw.longLabel(d.key, "en-TW"), d.key).toMatch(/ (District|Township|City)$/);
  });
});
