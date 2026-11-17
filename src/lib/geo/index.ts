/**
 * Country-driven map configuration. A market's map is data (boundary files, anchors, default view) plus a few
 * tuning numbers, so adding Thailand or Vietnam in Phase 2 means generating its boundary files and registering
 * a config here: no component changes.
 */
import { CITIES, DISTRICTS } from "./taiwan";
import {
  ALL_TW_DISTRICTS,
  TW_BOUNDS,
  TW_CITY_ANCHORS,
  TW_CITY_BBOX,
  TW_DISTRICT_ANCHORS,
  TW_DISTRICT_BBOX,
  type BBox,
  type LngLat,
} from "./tw-centroids.generated";

export type { BBox, LngLat } from "./tw-centroids.generated";
export { ALL_TW_DISTRICTS } from "./tw-centroids.generated";

/** "city" = a city or county (area level 1); "district" = a town, district or township (level 2). */
export type AreaLevel = "city" | "district";

/** District keys are "<cityKey>:<slug>"; city keys contain no colon. */
export const levelOfKey = (key: string): AreaLevel => (key.includes(":") ? "district" : "city");
export const cityOfKey = (key: string): string => key.split(":")[0] ?? key;

export interface CountryMapConfig {
  code: string;
  /** Public, same-origin GeoJSON files (nothing is fetched from a third party). */
  districtsUrl: string;
  countiesUrl: string;
  /** Default view and the full extent. [west, south, east, north] */
  bounds: { main: BBox; all: BBox };
  cityAnchors: Readonly<Record<string, LngLat>>;
  districtAnchors: Readonly<Record<string, LngLat>>;
  cityBbox: Readonly<Record<string, BBox>>;
  districtBbox: Readonly<Record<string, BBox>>;
  /** Zoom at which area bubbles switch from cities to districts. */
  districtZoom: number;
  /** Zoom at which the supercluster point map starts showing individual pins at the latest. */
  pointMaxZoom: number;
  /** Localised name for a city or district key (any "xx-CC" locale; Chinese locales get Chinese). */
  label(key: string, locale: string): string;
}

const twNames = new Map<string, { zh: string; en: string }>();
for (const d of ALL_TW_DISTRICTS) twNames.set(d.key, { zh: d.zh, en: d.en });
for (const d of DISTRICTS) twNames.set(d.key, { zh: d.zh, en: d.en });
for (const c of CITIES) twNames.set(c.key, { zh: c.zh, en: c.en });

const TW: CountryMapConfig = {
  code: "TW",
  districtsUrl: "/geo/tw/districts.geojson",
  countiesUrl: "/geo/tw/counties.geojson",
  bounds: TW_BOUNDS,
  cityAnchors: TW_CITY_ANCHORS,
  districtAnchors: TW_DISTRICT_ANCHORS,
  cityBbox: TW_CITY_BBOX,
  districtBbox: TW_DISTRICT_BBOX,
  districtZoom: 8.4,
  pointMaxZoom: 14,
  label(key, locale) {
    const n = twNames.get(key);
    if (!n) return key;
    return locale.startsWith("zh") ? n.zh : n.en;
  },
};

const REGISTRY: Record<string, CountryMapConfig> = { TW };

export function getCountryMap(code: string): CountryMapConfig | undefined {
  return REGISTRY[code];
}

export function requireCountryMap(code: string): CountryMapConfig {
  const c = REGISTRY[code];
  if (!c) throw new Error(`No map configured for country ${code}`);
  return c;
}

/** Where to centre on an area key, or null if the key is unknown. */
export function anchorOf(cfg: CountryMapConfig, key: string): LngLat | null {
  return (levelOfKey(key) === "city" ? cfg.cityAnchors[key] : cfg.districtAnchors[key]) ?? null;
}

export function bboxOfKey(cfg: CountryMapConfig, key: string): BBox | null {
  return (levelOfKey(key) === "city" ? cfg.cityBbox[key] : cfg.districtBbox[key]) ?? null;
}
