import { createHash } from "node:crypto";
import { CITIES } from "@/lib/geo/taiwan";
import { ALL_TW_DISTRICTS, TW_CITY_ANCHORS, TW_CITY_BBOX } from "@/lib/geo/tw-centroids.generated";
import { matchArea, parseCsv, placeInDistrict } from "./cram";

/**
 * Import of the Ministry of Education's school directories (全國各級學校名錄, open data, Government Open Data
 * License v1): government and private elementary, junior-high and senior-high schools, universities and colleges,
 * and the schools for international residents. Pure functions: the script and the tests feed them text.
 *
 * Privacy rule, same as the cram-school import: we keep the name, the kind, public/private, the city and district
 * and the school's public website. We read the street address only to find the district, then throw it away. We never
 * keep phone numbers. Pins sit inside the district, never at an address.
 */

export type MoeKind = "kindergarten" | "elementary" | "junior_high" | "senior_high" | "university" | "international";
export type SchoolKind = "kindergarten" | "elementary" | "junior_high" | "senior_high" | "university" | "international_school" | "bilingual_school";

export interface MoeRow {
  year: number | null;
  code: string;
  name: string;
  ownership: "public" | "private" | null;
  cityZh: string;
  /** The kindergarten list names the district in its own column. */
  districtZh: string;
  address: string;
  website: string;
  /** International-school files are in English. */
  english: boolean;
  countyEn: string;
}

const squash = (s: string) => s.replace(/[\s　]/g, "");
const unbracket = (s: string) => s.replace(/^\s*\[[^\]]*\]\s*/, "").trim();

/** Header names the Ministry's files use (the older and newer ones differ a little). */
const COLS = {
  year: ["學年度"],
  code: ["代碼", "學校代碼"],
  name: ["學校名稱", "School name"],
  ownership: ["公/私立"],
  city: ["縣市名稱"],
  district: ["鄉鎮市區名稱"],
  address: ["地址", "Address"],
  website: ["網址", "Website"],
  county: ["county"],
  level: ["學校級別"],
} as const;

function find(header: string[], names: readonly string[]): number {
  const h = header.map(squash);
  return h.findIndex((x) => names.some((n) => squash(n) === x));
}

export function rowsFromMoeCsv(text: string): { rows: MoeRow[]; columns: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], columns: [] };
  const header = table[0]!;
  const ix = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, find(header, v)])) as Record<keyof typeof COLS, number>;
  const cell = (r: string[], i: number) => (i < 0 ? "" : (r[i] ?? "").trim());
  const rows = table.slice(1).map((r): MoeRow => {
    const own = cell(r, ix.ownership);
    const english = ix.county >= 0;
    const yearN = Number(cell(r, ix.year));
    return {
      year: Number.isFinite(yearN) && yearN > 0 ? yearN : null,
      code: cell(r, ix.code),
      name: cell(r, ix.name),
      // The military-academy file has no public/private column: every one of them is a government school.
      ownership: own.startsWith("公") ? "public" : own.startsWith("私") ? "private" : ix.level >= 0 ? "public" : english ? "private" : null,
      cityZh: unbracket(cell(r, ix.city)),
      districtZh: cell(r, ix.district),
      address: unbracket(cell(r, ix.address)),
      website: cell(r, ix.website),
      english,
      countyEn: cell(r, ix.county),
    };
  });
  return { rows: rows.filter((r) => r.name), columns: header };
}

/** Several of the files repeat every school for each school year since 2014: keep only the newest year. */
export function latestYear(rows: MoeRow[]): MoeRow[] {
  const years = rows.map((r) => r.year).filter((y): y is number => y !== null);
  if (years.length === 0) return rows;
  const max = Math.max(...years);
  return rows.filter((r) => r.year === max);
}

/* ---------------- names ---------------- */

const norm = (s: string) => s.replace(/台/g, "臺").replace(/[\s　()（）\-－·．.]/g, "");

const CITY_PREFIX = /^(?:臺北市|新北市|桃園市|臺中市|臺南市|高雄市|基隆市|新竹市|嘉義市|新竹縣|苗栗縣|彰化縣|南投縣|雲林縣|嘉義縣|屏東縣|宜蘭縣|花蓮縣|臺東縣|澎湖縣|金門縣|連江縣)(?!立)/;
const OWNER_PREFIX = /^(?:國立|私立|財團法人|市立|縣立|臺北市立|新北市立|桃園市立|臺中市立|臺南市立|高雄市立|基隆市立|新竹市立|嘉義市立|[^\s]{1,3}[縣市]立)/;
const LEVEL_WORDS: [RegExp, string][] = [[/幼稚園/g, "幼兒園"], [/[（(]委託[^）)]*[）)]/g, ""], [/國民小學/g, "國小"], [/國民中學/g, "國中"], [/國民中小學/g, "國中小"], [/高級中學/g, "高中"], [/高級中等學校/g, "高中"], [/高級職業學校/g, "高職"]];

/**
 * A school's name without who runs it ("市立", "私立"), without the city and district some listings put in front
 * ("高雄市美濃區東門國民小學"), and with the long official level words shortened ("國民小學" = "國小"), so the same
 * school is recognised across the Ministry's list and the map data.
 */
export function coreName(name: string): string {
  let n = norm(name);
  for (const [re, to] of LEVEL_WORDS) n = n.replace(re, to);
  n = n.replace(CITY_PREFIX, "");
  const district = /^[^\s市縣區鄉鎮立]{1,3}[區鄉鎮市](?!立)/.exec(n);
  if (district && n.length - district[0].length >= 3) n = n.slice(district[0].length);
  n = n.replace(OWNER_PREFIX, "").replace(/^(?:國立|私立)/, "");
  return n;
}

/** Names that are a part of a school (a department, a branch campus, a building), not a school of their own. */
export const NOT_A_SCHOOL = /學系|系所|研究所|學位學程|校區|分校|分部|分班|籌備處|圖書館|宿舍|教學大樓|校本部|附設(?!幼)|附屬/;

/** Kind of school, refined from the name: a private bilingual or international school is its own kind. */
export function refineKind(kind: MoeKind, name: string): SchoolKind {
  if (kind === "university") return "university";
  if (kind === "international") return "international_school";
  if (kind === "kindergarten") {
    // Official kindergarten names rarely say "bilingual" (the rules discourage it), so only a few can be recognised. The
    // operator's name ("…股份有限公司附設…", "(委託…學會辦理)") is not the school's name, so it is not looked at.
    const own = name.replace(/[（(][^）)]*[）)]/g, "").replace(/^.*附設/, "");
    return /雙語|美語|英語|國際|bilingual|international|english/i.test(own) ? "bilingual_school" : "kindergarten";
  }
  if (/雙語/.test(name)) return "bilingual_school";
  if (/國際|international/i.test(name)) return "international_school";
  return kind;
}

/* ---------------- places ---------------- */

const cityKeyOfEnglish = (county: string): string | null => {
  const n = county.trim().toLowerCase();
  const exact = CITIES.find((c) => c.en.toLowerCase() === n || c.aliases.includes(n));
  if (exact) return exact.key;
  // The Ministry's file spells some counties with a typo ("Kaohsiun City"): accept a long common start.
  const stem = (x: string) => x.toLowerCase().replace(/\s+(city|county)$/, "");
  const a = stem(n);
  if (a.length < 5) return null;
  return CITIES.find((c) => { const b = stem(c.en); return b.startsWith(a) || a.startsWith(b); })?.key ?? null;
};
const flat = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");

/** District from an English address, only when the romanisation matches exactly. Otherwise null: the pin goes to the city. */
function districtFromEnglish(city: string, address: string): string | null {
  const a = flat(address);
  let best: { key: string; len: number } | null = null;
  for (const d of ALL_TW_DISTRICTS) {
    if (d.city !== city) continue;
    const e = flat(d.en);
    if (e.length < 4 || !new RegExp(`${e}(district|city|township|town)`).test(a)) continue;
    if (!best || e.length > best.len) best = { key: d.key, len: e.length };
  }
  return best?.key ?? null;
}

function unit(seed: string): [number, number] {
  const h = createHash("sha256").update(seed).digest();
  return [h.readUInt32BE(0) / 2 ** 32, h.readUInt32BE(4) / 2 ** 32];
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

/* ---------------- records ---------------- */

export interface MoeRecord {
  countryCode: "TW";
  name: string;
  nameEn: string | null;
  type: SchoolKind;
  ownership: "public" | "private" | null;
  city: string;
  district: string | null;
  latitude: number;
  longitude: number;
  website: string | null;
  source: "moe_open_data";
  sourceId: string;
}

export interface MoePlan {
  records: MoeRecord[];
  skipped: { no_area: number; duplicate: number };
  unplaced: string[];
  perType: Record<string, number>;
  perOwnership: Record<string, number>;
}

const cleanWebsite = (w: string): string | null => {
  if (!w) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(w) ? w : `http://${w}`);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString().slice(0, 300) : null;
  } catch {
    return null;
  }
};

export function planMoe(sets: { kind: MoeKind; rows: MoeRow[] }[]): MoePlan {
  const plan: MoePlan = { records: [], skipped: { no_area: 0, duplicate: 0 }, unplaced: [], perType: {}, perOwnership: {} };
  const seen = new Set<string>();
  for (const { kind, rows } of sets) {
    for (const r of latestYear(rows)) {
      const name = r.name.replace(/[\s　]+/g, " ").trim().slice(0, 200);
      let city: string | null = null;
      let district: string | null = null;
      if (r.english) {
        city = cityKeyOfEnglish(r.countyEn);
        if (city) district = districtFromEnglish(city, r.address);
      } else {
        const area = matchArea({ city: r.cityZh, district: r.districtZh, address: r.address });
        if (area) { city = area.city; district = area.district; }
        else {
          // City known but the district could not be read from the address: keep the school at city level.
          const c = matchArea({ city: r.cityZh, address: "" });
          city = c?.city ?? null;
        }
      }
      if (!city) { plan.skipped.no_area++; if (plan.unplaced.length < 8) plan.unplaced.push(`${name}: ${r.cityZh || r.countyEn} ${r.address}`.slice(0, 80)); continue; }
      const sourceId = `moe:${kind}:${r.code || createHash("sha1").update(`${norm(name)}|${city}`).digest("hex").slice(0, 12)}`;
      const dupKey = `${coreName(name)}|${city}|${district ?? ""}|${kind}`;
      if (seen.has(sourceId) || seen.has(dupKey)) { plan.skipped.duplicate++; continue; }
      seen.add(sourceId); seen.add(dupKey);
      const pos = (district ? placeInDistrict(district, sourceId) : null) ?? placeInCity(city, sourceId);
      if (!pos) { plan.skipped.no_area++; continue; }
      const type = refineKind(kind, name);
      plan.records.push({ countryCode: "TW", name, nameEn: r.english ? name : null, type, ownership: r.ownership, city, district, latitude: pos.lat, longitude: pos.lng, website: cleanWebsite(r.website), source: "moe_open_data", sourceId });
      plan.perType[type] = (plan.perType[type] ?? 0) + 1;
      if (r.ownership) plan.perOwnership[r.ownership] = (plan.perOwnership[r.ownership] ?? 0) + 1;
    }
  }
  return plan;
}
