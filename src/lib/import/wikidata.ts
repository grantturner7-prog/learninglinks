import { cityOnly } from "./more";
import { coreName } from "./moe";

/**
 * English names and exact positions for official schools, from Wikidata (CC0: free to reuse, no credit required).
 * Wikidata lists Taiwan's schools with the Ministry of Education's own school code (property P7121), so a school is
 * matched by that code, never by a guess. About 1,400 of them carry an English name and about 2,000 a position.
 * Pure functions: the script and the tests feed them rows.
 */

export interface WikidataSchool {
  code: string;
  zh: string;
  en: string;
  /** "Point(120.68 24.15)" as Wikidata writes it: longitude first. */
  coord: string;
}

export interface OrgForWikidata {
  id: string;
  name: string;
  nameEn: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  sourceId: string | null;
  /** Claimed listings keep whatever the school entered itself. */
  claimed: boolean;
}

export interface WikidataUpdate {
  id: string;
  nameEn?: string;
  latitude?: number;
  longitude?: number;
}

/** Taiwan and its islands, generously. Anything outside is a mistake in the source. */
const inTaiwan = (lng: number, lat: number) => lng > 117.9 && lng < 122.2 && lat > 21.7 && lat < 26.5;

export function parsePoint(s: string): { lng: number; lat: number } | null {
  const m = /^Point\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/.exec(s.trim());
  if (!m) return null;
  const lng = Number(m[1]), lat = Number(m[2]);
  return inTaiwan(lng, lat) ? { lng: Math.round(lng * 1e5) / 1e5, lat: Math.round(lat * 1e5) / 1e5 } : null;
}

/** A usable English name: Latin letters, a sensible length, and not just a copy of the code or a single word. */
export function cleanEnglishName(s: string): string | null {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length < 6 || t.length > 140) return null;
  if (!/^[A-Za-z][A-Za-z0-9 .,'’&()\-\/]+$/.test(t)) return null;
  if (!/\s/.test(t)) return null;
  return t;
}

/** The Ministry's code from our own id for a Ministry-sourced listing ("moe:elementary:191602" -> "191602"). */
export const codeOfSourceId = (sourceId: string | null): string | null => (sourceId && /^moe:[a-z_]+:[0-9A-Za-z]{4,9}$/.test(sourceId) ? sourceId.split(":")[2]! : null);

/** About 30 km: a position further than this from where the school's district is cannot be the same school. */
const TOO_FAR = 0.3;

export function planWikidata(orgs: OrgForWikidata[], schools: WikidataSchool[]): { updates: WikidataUpdate[]; named: number; moved: number } {
  const byCode = new Map<string, WikidataSchool>();
  const byName = new Map<string, WikidataSchool[]>();
  for (const s of schools) {
    // One code can sit on a school and on the junior-high division attached to it: prefer the one that has more to give.
    const had = byCode.get(s.code);
    if (!had || (!had.en && s.en) || (!had.coord && s.coord)) byCode.set(s.code, s);
    const key = `${coreName(s.zh)}|${cityOnly(s.zh) ?? ""}`;
    byName.set(key, [...(byName.get(key) ?? []), s]);
  }
  const updates: WikidataUpdate[] = [];
  let named = 0, moved = 0;
  for (const o of orgs) {
    const code = codeOfSourceId(o.sourceId);
    let hit = code ? byCode.get(code) : undefined;
    if (!hit && !code && o.city) {
      // A listing that came from the map data has no code: accept Wikidata's school of the same name in the same city,
      // only when there is exactly one.
      const cands = byName.get(`${coreName(o.name)}|${o.city}`) ?? [];
      if (cands.length === 1) hit = cands[0];
    }
    if (!hit) continue;
    const u: WikidataUpdate = { id: o.id };
    const en = cleanEnglishName(hit.en);
    if (en && !o.nameEn?.trim() && !o.claimed) { u.nameEn = en; named++; }
    const p = parsePoint(hit.coord);
    // Only a Ministry-sourced listing has an approximate pin ("somewhere in the district"); map-data listings are exact.
    if (p && o.source === "moe_open_data" && !o.claimed && o.latitude != null && o.longitude != null && Math.hypot(p.lat - o.latitude, p.lng - o.longitude) < TOO_FAR) {
      if (Math.abs(p.lat - o.latitude) > 1e-5 || Math.abs(p.lng - o.longitude) > 1e-5) { u.latitude = p.lat; u.longitude = p.lng; moved++; }
    }
    if (u.nameEn || u.latitude !== undefined) updates.push(u);
  }
  return { updates, named, moved };
}
