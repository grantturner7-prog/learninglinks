import { createHash } from "node:crypto";
import { CITIES } from "@/lib/geo/taiwan";
import { ALL_TW_DISTRICTS, TW_CITY_ANCHORS, TW_CITY_BBOX, TW_DISTRICT_ANCHORS, TW_DISTRICT_BBOX } from "@/lib/geo/tw-centroids.generated";

/**
 * Import of licensed cram schools (補習班) from a government open-data table (CSV or JSON rows).
 *
 * Privacy rule: we keep ONLY the school's name, a kind, the city and district, and the registration number as an id.
 * We never store the street address, the phone number or the owner's name that such tables usually contain.
 * The table has no coordinates, so each school is placed inside its district (never at an address), spread out
 * deterministically so pins do not sit on top of each other. Pins for these schools are approximate by design.
 */

/* ---------------- CSV ---------------- */

/** A small RFC 4180 reader: quoted fields, doubled quotes, commas and newlines inside quotes, a UTF-8 BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== "")) rows.push(row);
  return rows;
}

/** Header names different publishers use for the same thing (matched after trimming and removing spaces). */
const ALIASES = {
  // The city portals (Taipei, New Taipei, Taichung, Tainan, Nantou) each name the same columns their own way.
  name: ["補習班名稱", "短期補習班名稱", "補習班中文名稱", "補習班班名", "補習班名", "班名", "機構名稱", "名稱", "c_schoolname", "name"],
  address: ["地址", "補習班地址", "補習班中文住址", "補習班住址", "住址", "班址", "立案地址", "address"],
  city: ["縣市", "縣市別", "縣市名稱", "所在縣市", "地區縣市", "city"],
  district: ["鄉鎮市區", "鄉鎮區", "行政區", "鄉鎮市區名稱", "district"],
  regNo: ["立案字號", "立案證書字號", "立案證號", "許可證號", "證號", "登記字號", "regno"],
  category: ["班別", "班別名稱", "補習班類別", "短期補習班類別", "類別", "科別", "category"],
} as const;
export type Field = keyof typeof ALIASES;

const squash = (s: string) => s.replace(/[\s　]/g, "").toLowerCase();

export function mapHeaders(header: string[]): Partial<Record<Field, number>> {
  const out: Partial<Record<Field, number>> = {};
  const h = header.map(squash);
  for (const [field, names] of Object.entries(ALIASES) as [Field, readonly string[]][]) {
    const i = h.findIndex((x) => names.map(squash).includes(x));
    if (i >= 0) out[field] = i;
  }
  return out;
}

export interface RawRow { name?: string; address?: string; city?: string; district?: string; regNo?: string; category?: string }

export function rowsFromCsv(text: string): { rows: RawRow[]; mapped: Field[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], mapped: [] };
  const idx = mapHeaders(table[0]!);
  const cell = (r: string[], f: Field) => (idx[f] === undefined ? undefined : (r[idx[f]!] ?? "").trim() || undefined);
  const rows = table.slice(1).map((r) => ({ name: cell(r, "name"), address: cell(r, "address"), city: cell(r, "city"), district: cell(r, "district"), regNo: cell(r, "regNo"), category: cell(r, "category") }));
  return { rows, mapped: Object.keys(idx) as Field[] };
}

/* ---------------- area ---------------- */

/** Official texts use 臺; people and some tables write 台. Compare in one form. */
const norm = (s: string) => s.replace(/台/g, "臺").replace(/[\s　]/g, "");

const CITY_BY_ZH = CITIES.map((c) => ({ key: c.key, names: [...new Set([c.zh, ...c.aliases.filter((a) => /[一-鿿]/.test(a))].map(norm))] }));

export interface Area { city: string; district: string }

/**
 * City and district from the separate columns when present, otherwise from the start of the address
 * ("臺中市西屯區…"). A district name is accepted without a city only if it exists in exactly one city.
 */
export function matchArea(r: Pick<RawRow, "city" | "district" | "address">): Area | null {
  const text = norm(`${r.city ?? ""}${r.district ?? ""}${r.address ?? ""}`);
  let city: { key: string; at: number } | null = null;
  for (const c of CITY_BY_ZH) {
    for (const n of c.names) {
      const at = text.indexOf(n);
      if (at >= 0 && (!city || at < city.at)) city = { key: c.key, at };
    }
  }
  const candidates = ALL_TW_DISTRICTS.filter((d) => (city ? d.city === city.key : true));
  let best: { key: string; city: string; at: number; len: number } | null = null;
  for (const d of candidates) {
    const at = text.indexOf(norm(d.zh), city ? city.at : 0);
    if (at >= 0 && (!best || at < best.at || (at === best.at && d.zh.length > best.len))) best = { key: d.key, city: d.city, at, len: d.zh.length };
  }
  if (!best) return null;
  if (!city) {
    // No city written: the district name must be unique in Taiwan.
    const same = ALL_TW_DISTRICTS.filter((d) => norm(d.zh) === norm(ALL_TW_DISTRICTS.find((x) => x.key === best!.key)!.zh));
    if (same.length !== 1) return null;
  }
  return { city: best.city, district: best.key };
}

/**
 * A city's own list does not repeat the city on every row ("110信義區忠孝東路…"): say which city the file is for.
 * A row that already names a city keeps it.
 */
export function withCity(rows: RawRow[], cityKey: string): RawRow[] {
  const zh = CITIES.find((c) => c.key === cityKey)?.zh;
  if (!zh) throw new Error(`Unknown city: ${cityKey}`);
  return rows.map((r) => (r.city ? r : { ...r, city: zh }));
}

/* ---------------- record ---------------- */

export type CramType = "cram_school" | "language_school";
const LANGUAGE = /美語|英語|英文|外語|語文|日語|韓語|法語|德語|西班牙語|多益|english|language/i;

export const inferType = (r: Pick<RawRow, "name" | "category">): CramType => (LANGUAGE.test(`${r.name ?? ""} ${r.category ?? ""}`) ? "language_school" : "cram_school");

/** Two stable numbers in [0, 1) from any text, so the same school always lands on the same spot. */
function unit(seed: string): [number, number] {
  const h = createHash("sha256").update(seed).digest();
  return [h.readUInt32BE(0) / 2 ** 32, h.readUInt32BE(4) / 2 ** 32];
}

/** A point inside the district: its centre plus a stable offset of up to a quarter of the district (at most about 2 km). */
export function placeInDistrict(districtKey: string, seed: string): { lat: number; lng: number } | null {
  const anchor = TW_DISTRICT_ANCHORS[districtKey];
  const box = TW_DISTRICT_BBOX[districtKey];
  if (!anchor || !box) return null;
  const [w, s, e, n] = box;
  const spreadLng = Math.min((e - w) * 0.25, 0.02);
  const spreadLat = Math.min((n - s) * 0.25, 0.02);
  const [u, v] = unit(seed);
  return { lng: Math.round((anchor[0] + (u - 0.5) * 2 * spreadLng) * 1e5) / 1e5, lat: Math.round((anchor[1] + (v - 0.5) * 2 * spreadLat) * 1e5) / 1e5 };
}

/** A stable spot inside a city (used only when the district is unknown): its centre plus an offset of up to about 2 km. */
export function placeInCity(city: string, seed: string): { lat: number; lng: number } | null {
  const a = TW_CITY_ANCHORS[city];
  const box = TW_CITY_BBOX[city];
  if (!a || !box) return null;
  const [w, s, e, n] = box;
  const sl = Math.min((e - w) * 0.1, 0.02), sa = Math.min((n - s) * 0.1, 0.02);
  const [u, v] = unit(seed);
  return { lng: Math.round((a[0] + (u - 0.5) * 2 * sl) * 1e5) / 1e5, lat: Math.round((a[1] + (v - 0.5) * 2 * sa) * 1e5) / 1e5 };
}

/** The city or county a row names, when its address gives no district we know ("新竹市復興路16-5號"). */
export function matchCity(r: Pick<RawRow, "city" | "address">): string | null {
  const text = norm(`${r.city ?? ""}${r.address ?? ""}`);
  let best: { key: string; at: number } | null = null;
  for (const c of CITY_BY_ZH) for (const n of c.names) {
    const at = text.indexOf(n);
    if (at >= 0 && (!best || at < best.at)) best = { key: c.key, at };
  }
  return best?.key ?? null;
}

export interface CramRecord {
  countryCode: "TW";
  name: string;
  type: CramType;
  city: string;
  /** Null for the few whose address names the city but no district: they sit at city level. */
  district: string | null;
  latitude: number;
  longitude: number;
  source: "gov_open_data";
  sourceId: string;
}

const CITY_ZH = CITIES.map((c) => norm(c.zh));

/**
 * A cram school's own name, for telling one school listed twice from two schools. The national register writes
 * "南投縣私立弘勵文理短期補習班" where the county's own list writes "私立弘勵文理短期補習班": the city and "私立" are
 * left out before comparing.
 */
export function cramKey(name: string): string {
  let n = norm(name);
  for (const c of CITY_ZH) n = n.split(c).join("");
  n = n.replace(/私立/g, "");
  return n.length >= 2 ? n : norm(name);
}

/** The id of a cram school that has no registration number: its own name and its district. */
export const cramSourceId = (name: string, district: string): string => `gov-cram:${createHash("sha1").update(`${cramKey(name)}|${district}`).digest("hex").slice(0, 16)}`;

export type SkipReason = "no_name" | "no_area" | "duplicate";

export interface ImportPlan {
  records: CramRecord[];
  skipped: Record<SkipReason, number>;
  /** A few addresses that could not be placed, to help fix the source table. */
  unplaced: string[];
  perCity: Record<string, number>;
}

/** Turn raw rows into records to store. Duplicates (same registration number, or same name in the same district) are dropped. */
export function planImport(rows: RawRow[]): ImportPlan {
  const plan: ImportPlan = { records: [], skipped: { no_name: 0, no_area: 0, duplicate: 0 }, unplaced: [], perCity: {} };
  const seen = new Set<string>();
  for (const r of rows) {
    const name = (r.name ?? "").replace(/[\s　]+/g, " ").trim().slice(0, 200);
    if (name.length < 2) { plan.skipped.no_name++; continue; }
    const found = matchArea(r);
    const cityOnly = found ? null : matchCity(r);
    if (!found && !cityOnly) {
      plan.skipped.no_area++;
      if (plan.unplaced.length < 8) plan.unplaced.push(`${name}: ${[r.city, r.district, r.address].filter(Boolean).join(" ").slice(0, 40)}`);
      continue;
    }
    // District level when the address names one; otherwise the school still appears, at city level.
    const area: { city: string; district: string | null } = found ?? { city: cityOnly!, district: null };
    const place = area.district ?? area.city;
    const regNo = (r.regNo ?? "").replace(/\s+/g, "");
    const sourceId = regNo ? `gov-cram:${regNo}` : cramSourceId(name, place);
    const dupKey = `${cramKey(name)}|${place}`;
    if (seen.has(sourceId) || seen.has(dupKey)) { plan.skipped.duplicate++; continue; }
    seen.add(sourceId);
    seen.add(dupKey);
    const pos = area.district ? placeInDistrict(area.district, sourceId) : placeInCity(area.city, sourceId);
    if (!pos) { plan.skipped.no_area++; continue; }
    plan.records.push({ countryCode: "TW", name, type: inferType({ name, category: r.category }), city: area.city, district: area.district, latitude: pos.lat, longitude: pos.lng, source: "gov_open_data", sourceId });
    plan.perCity[area.city] = (plan.perCity[area.city] ?? 0) + 1;
  }
  return plan;
}

/* ---------------- listings already in the database ---------------- */

export interface ExistingCram {
  id: string;
  name: string;
  district: string | null;
  sourceId: string | null;
  /** Claimed, applied for, or with a job post: never removed. */
  locked: boolean;
}

export interface Reconcile {
  /** Listings whose id was made from an older spelling: give them the id the importer makes today. */
  reId: { id: string; sourceId: string }[];
  /** The same school listed twice (for example from a city's list and from the national register). */
  remove: string[];
}

/**
 * Bring earlier imports in line with today's ids, so a re-run updates a school instead of adding it again.
 * Only listings identified by name and district are touched (never one that has a registration number).
 */
export function reconcileExisting(rows: ExistingCram[]): Reconcile {
  const out: Reconcile = { reId: [], remove: [] };
  const groups = new Map<string, ExistingCram[]>();
  for (const r of rows) {
    if (!r.district || !r.sourceId || !/^gov-cram:[0-9a-f]{16}$/.test(r.sourceId)) continue;
    const id = cramSourceId(r.name, r.district);
    groups.set(id, [...(groups.get(id) ?? []), r]);
  }
  for (const [id, group] of groups) {
    const keep = group.find((r) => r.sourceId === id) ?? group.find((r) => r.locked) ?? group[0]!;
    for (const r of group) if (r !== keep && !r.locked) out.remove.push(r.id);
    // A locked twin keeps its own id; the kept listing only takes the new id when no twin still holds it.
    if (keep.sourceId !== id && !group.some((r) => r !== keep && r.sourceId === id)) out.reId.push({ id: keep.id, sourceId: id });
  }
  return out;
}

/** Listings no longer on the register: closed or renamed schools. Never a locked one. */
export function staleListings(rows: ExistingCram[], current: ReadonlySet<string>): ExistingCram[] {
  return rows.filter((r) => !r.locked && !!r.sourceId && r.sourceId.startsWith("gov-cram:") && !current.has(r.sourceId));
}

/** JSON tables: an array of objects whose keys are the column names. */
export function rowsFromObjects(objs: Record<string, unknown>[]): { rows: RawRow[]; mapped: Field[] } {
  if (objs.length === 0) return { rows: [], mapped: [] };
  const header = [...new Set(objs.flatMap((o) => Object.keys(o)))];
  const idx = mapHeaders(header);
  const cell = (o: Record<string, unknown>, f: Field) => (idx[f] === undefined ? undefined : String(o[header[idx[f]!]!] ?? "").trim() || undefined);
  return { rows: objs.map((o) => ({ name: cell(o, "name"), address: cell(o, "address"), city: cell(o, "city"), district: cell(o, "district"), regNo: cell(o, "regNo"), category: cell(o, "category") })), mapped: Object.keys(idx) as Field[] };
}

/** Column names present in a set of JSON rows (to tell the owner what was found when a column is not recognised). */
export function columnsOf(objs: Record<string, unknown>[]): string[] {
  return [...new Set(objs.slice(0, 200).flatMap((o) => Object.keys(o)))];
}
