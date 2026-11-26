import { coreName } from "./moe";

/**
 * Finding schools that are listed twice: once from the map data (OpenStreetMap, which knows the exact spot but uses
 * the name on the gate, such as "天主教育仁小學") and once from the Ministry's directory (the official name, such as
 * "私立育仁國小", government or private, and the address, but only an approximate pin).
 * The Ministry import already joins the two when the names agree; this catches the ones whose names differ only in
 * who runs the school or in how the level is written. Pure functions: the script and the tests feed them rows.
 */

const RUN_BY = /^(?:天主教|基督教|佛教|道教|財團法人|私立|國立|市立|縣立)+/;
/** Level words at the end of a name, longest first. What is left in front is the school's own name. */
const LEVEL = /(?:附設)?(?:國民中小學|國中小|完全中學|實驗中學|實驗小學|實驗學校|高級中學|高級工業職業學校|高級商業職業學校|高級職業學校|高中職|高中|高工|高商|高農|高職|家商|工商|商工|工家|國小|國中|小學|中學|幼兒園|幼稚園|科技大學|技術學院|大學|學院|專科學校|學校)$/;

/** "天主教育仁小學" and "私立育仁國小" both become "育仁". */
export function stemName(name: string): string {
  let n = coreName(name);
  for (let i = 0; i < 3; i++) n = n.replace(RUN_BY, "");
  // The Ministry adds the district when a city has two schools of one name ("市立北區中山國小"): that is not part of
  // the school's own name. Only dropped when a real name is left ("新市國小" keeps its "新市").
  const withoutDistrict = n.replace(/^[^\s市縣區鄉鎮立]{1,3}[區鄉鎮市]/, "");
  if ([...withoutDistrict.replace(LEVEL, "")].length >= 2) n = withoutDistrict;
  n = n.replace(LEVEL, "");
  return n;
}

/** Junior and senior high schools are one family: a "…中學" on the map can be either on the Ministry's list. */
export const kindFamily = (type: string): string => (type === "junior_high" || type === "senior_high" ? "secondary" : type);

/**
 * The level a name states: K, E (elementary), EJ (a combined elementary and junior high), J, S (senior or vocational
 * high), U, "M" for a plain "…中學" (which may be junior or senior), or "" when the name states none.
 */
export function levelOf(name: string): string {
  const n = coreName(name);
  if (/幼兒園|幼稚園/.test(n)) return "K";
  if (/國中小|國民中小學/.test(n)) return "EJ";
  if (/國小|小學/.test(n)) return "E";
  if (/國中/.test(n)) return "J";
  if (/高中|高工|高商|高農|高職|家商|工商|商工|工家|職業學校|完全中學/.test(n)) return "S";
  if (/中學/.test(n)) return "M";
  if (/大學|學院|專科/.test(n)) return "U";
  return "";
}
/** Two stated levels agree when they are the same, or when one is the plain "中學" and the other a junior or senior high. */
const levelsAgree = (a: string, b: string) => a === b || (a === "M" && (b === "J" || b === "S")) || (b === "M" && (a === "J" || a === "S"));

/** Who runs the school, when the name on the map says so: "私立…" or "市立…". */
function statedOwnership(name: string): "public" | "private" | null {
  if (/私立/.test(name)) return "private";
  if (/國立|[市縣]立/.test(name)) return "public";
  return null;
}

export interface DedupeRow {
  id: string;
  name: string;
  nameEn: string | null;
  website: string | null;
  type: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  source: string;
  /** Government or private: set only on rows the Ministry's directory confirmed. */
  ownership: string | null;
  /** Claimed, applied for, or with a job post or a picture: such a listing is never removed. */
  locked: boolean;
}

export interface Merge {
  /** The official listing, which is kept. */
  keep: DedupeRow;
  /** The map-data listing with a different spelling of the same school, which is removed. */
  remove: DedupeRow;
  /** The exact spot to move the kept listing to (when it only had an approximate pin). */
  moveTo: { latitude: number; longitude: number } | null;
}

const KINDS = new Set(["kindergarten", "elementary", "junior_high", "senior_high", "university"]);
/** Roughly 25 km: both listings are in the same city, so anything further apart is two different schools. */
const FAR = 0.25;

export function planDedupe(rows: DedupeRow[]): Merge[] {
  const key = (r: DedupeRow) => `${r.city}|${kindFamily(r.type)}|${stemName(r.name)}`;
  const official = new Map<string, DedupeRow[]>();
  for (const r of rows) {
    if (!r.city || !r.ownership || !KINDS.has(r.type)) continue;
    official.set(key(r), [...(official.get(key(r)) ?? []), r]);
  }
  const merges: Merge[] = [];
  for (const r of rows) {
    if (r.source !== "osm_import" || r.ownership || r.locked || !r.city || !KINDS.has(r.type)) continue;
    const stem = stemName(r.name);
    // A stem of one character ("東") or none is too little to go on.
    if ([...stem].length < 2) continue;
    const hits = official.get(key(r)) ?? [];
    // Only when exactly one official school in the city answers to that name: "中山國小" can be several schools.
    if (hits.length !== 1) continue;
    const keep = hits[0]!;
    if (keep.id === r.id) continue;
    // The name on the map must say what level the school is, and it must be the level the official listing states:
    // a bare brand name ("何嘉仁") could be any branch, and "自強國中" is not "自強高工".
    const level = levelOf(r.name);
    if (!level || !levelsAgree(level, levelOf(keep.name))) continue;
    // "私立文山幼兒園" is not "臺北市立文山幼兒園": a private and a government school can share a name.
    const says = statedOwnership(r.name);
    if (says && says !== keep.ownership) continue;
    if (r.latitude != null && r.longitude != null && keep.latitude != null && keep.longitude != null && Math.hypot(r.latitude - keep.latitude, r.longitude - keep.longitude) > FAR) continue;
    // The Ministry-sourced listing has a pin "somewhere in the district"; the map data knows the gate.
    const moveTo = keep.source === "moe_open_data" && r.latitude != null && r.longitude != null ? { latitude: r.latitude, longitude: r.longitude } : null;
    merges.push({ keep, remove: r, moveTo });
  }
  return merges;
}
