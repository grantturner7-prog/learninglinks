import { CITIES } from "@/lib/geo/taiwan";
import { TW_CITY_BBOX } from "@/lib/geo/tw-centroids.generated";
import { coreName } from "./moe";

/**
 * School pictures: deciding which school a reviewed picture belongs to. Pure functions, fed by the script and the tests.
 *
 * The pictures come from Wikimedia Commons (found through Wikidata), under licences that allow reuse with credit. A
 * person looks at every picture first: it must show the establishment and no people. The reviewed list is
 * data/school-photos.json; each entry carries the fingerprint (SHA-256) of the exact file that was looked at.
 *
 * A wrong picture on a school is worse than no picture, so matching is strict: the same name, and either the same
 * city with only one school of that name in it, or a position within a few hundred metres. Anything unclear is left out.
 */

export interface PhotoEntry {
  /** Wikidata id of the school, e.g. "Q715490". */
  wikidata: string;
  /** The school's Chinese name there, usually with the city in front ("嘉義市東區興安國民小學"). */
  zh: string;
  lat?: number | null;
  lng?: number | null;
  /** "File:…" title on Wikimedia Commons. */
  file: string;
  thumbUrl: string;
  pageUrl: string;
  licence: string;
  licenceUrl: string;
  author: string;
  /** SHA-256 of the reviewed file. The importer refuses a file that differs. */
  sha256: string;
}

export interface SchoolRow {
  id: string;
  name: string;
  city: string | null;
  /** Only positions from the map data are real; Ministry-only schools sit at a made-up spot inside their district. */
  lat: number | null;
  lng: number | null;
  source: string;
}

export type MatchHow = "name and position" | "name and city" | "name, only one in Taiwan";

export interface PhotoMatch {
  entry: PhotoEntry;
  schoolId: string;
  schoolName: string;
  how: MatchHow;
}

export interface PhotoPlan {
  matches: PhotoMatch[];
  /** Entries we could not place, with the reason, for the report. */
  left: { wikidata: string; zh: string; why: "no school of that name" | "several schools of that name" | "school already has a picture in this list" }[];
}

const flat = (s: string) => s.replace(/\s+/g, "").replace(/台/g, "臺");

/** The city a Chinese school name starts with ("臺中市立…", "嘉義市東區…"), if it says. */
export function cityOfChineseName(name: string): string | null {
  const n = flat(name);
  // Longest first, so "嘉義縣" is not mistaken for another city that shares its first characters.
  for (const c of [...CITIES].sort((a, b) => b.zh.length - a.zh.length)) if (n.startsWith(flat(c.zh))) return c.key;
  return null;
}

/** The city whose bounding box holds a position. Boxes overlap near borders, so only an unambiguous answer counts. */
export function cityOfPosition(lat: number, lng: number): string | null {
  const hits = Object.entries(TW_CITY_BBOX).filter(([, b]) => lng >= b[0] && lng <= b[2] && lat >= b[1] && lat <= b[3]);
  return hits.length === 1 ? hits[0]![0] : null;
}

/** Metres between two positions (good enough at this scale). */
export function metresBetween(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dy = (aLat - bLat) * 111_320;
  const dx = (aLng - bLng) * 111_320 * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.hypot(dx, dy);
}

/** A picture and a school are "the same place" when the school's real position is within this distance. */
export const NEAR_METRES = 600;

const REUSABLE = /^(cc0|public domain|pd\b|cc[ -]by(-sa)?[ -]\d)/i;
/** Only licences that allow anyone to reuse the picture: public domain, CC0, CC BY and CC BY-SA. */
export const isReusableLicence = (licence: string): boolean => REUSABLE.test(licence.trim());

export function planSchoolPhotos(entries: readonly PhotoEntry[], schools: readonly SchoolRow[]): PhotoPlan {
  const byCore = new Map<string, SchoolRow[]>();
  for (const s of schools) {
    const k = coreName(s.name);
    byCore.set(k, [...(byCore.get(k) ?? []), s]);
  }
  const plan: PhotoPlan = { matches: [], left: [] };
  const taken = new Set<string>();
  for (const e of entries) {
    const cands = byCore.get(coreName(e.zh)) ?? [];
    if (cands.length === 0) {
      plan.left.push({ wikidata: e.wikidata, zh: e.zh, why: "no school of that name" });
      continue;
    }
    let hit: SchoolRow | undefined;
    let how: MatchHow | undefined;
    const hasPos = typeof e.lat === "number" && typeof e.lng === "number";
    if (hasPos) {
      const near = cands
        .filter((s) => s.source === "osm_import" && s.lat != null && s.lng != null)
        .map((s) => ({ s, d: metresBetween(e.lat!, e.lng!, s.lat!, s.lng!) }))
        .filter((x) => x.d <= NEAR_METRES)
        .sort((a, b) => a.d - b.d);
      if (near.length > 0) {
        hit = near[0]!.s;
        how = "name and position";
      }
    }
    if (!hit) {
      const city = cityOfChineseName(e.zh) ?? (hasPos ? cityOfPosition(e.lat!, e.lng!) : null);
      if (city) {
        const inCity = cands.filter((s) => s.city === city);
        if (inCity.length === 1) {
          hit = inCity[0];
          how = "name and city";
        }
      } else if (cands.length === 1) {
        hit = cands[0];
        how = "name, only one in Taiwan";
      }
    }
    if (!hit || !how) {
      plan.left.push({ wikidata: e.wikidata, zh: e.zh, why: "several schools of that name" });
      continue;
    }
    if (taken.has(hit.id)) {
      plan.left.push({ wikidata: e.wikidata, zh: e.zh, why: "school already has a picture in this list" });
      continue;
    }
    taken.add(hit.id);
    plan.matches.push({ entry: e, schoolId: hit.id, schoolName: hit.name, how });
  }
  return plan;
}
