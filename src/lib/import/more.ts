import { createHash } from "node:crypto";
import { CITIES } from "@/lib/geo/taiwan";
import { matchArea, parseCsv, placeInDistrict, type RawRow } from "./cram";
import { cleanAddress, latestYear, placeInCity, rowsFromMoeCsv } from "./moe";

/**
 * The smaller official lists that the big school directories leave out (found on data.gov.tw, Nov 2026):
 * special-education schools, community colleges, the Mandarin centres attached to universities, religious
 * seminaries, the open universities and the licensed after-school care centres (課後照顧中心, "anqinban").
 * Pure functions: the script and the tests feed them text.
 *
 * Same rules as the other imports. We keep the name, the kind, the city and district, a public website and, for
 * official institutions only, the address the Ministry publishes. We never keep phone numbers, fax numbers, email
 * addresses or people's names. After-school care centres are treated like cram schools: district only, because a
 * small one can be run from a home. Pins sit inside the district, never on an address.
 */

export type MoreKind = "special_education" | "community_college" | "language_school" | "university" | "after_school";

export interface MoreRecord {
  countryCode: "TW";
  name: string;
  type: MoreKind;
  ownership: "public" | "private" | null;
  city: string;
  district: string | null;
  latitude: number;
  longitude: number;
  website: string | null;
  address: string | null;
  source: "moe_open_data" | "gov_open_data";
  sourceId: string;
}

export interface MorePlan {
  records: MoreRecord[];
  skipped: number;
  unplaced: string[];
}

const tidy = (s: string) => s.replace(/[\s　]+/g, " ").trim();
const squash = (s: string) => s.replace(/[\s　]/g, "");
const norm = (s: string) => s.replace(/台/g, "臺").replace(/[\s　()（）\-－·．.]/g, "");
const sha = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 14);

function cleanWebsite(w: string): string | null {
  const t = w.trim();
  if (!t) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `http://${t}`);
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".") ? u.toString().slice(0, 300) : null;
  } catch {
    return null;
  }
}

/** The first city or county named in a text (臺 and 台 are the same), or null. */
export function cityOnly(text: string): string | null {
  const t = text.replace(/台/g, "臺").replace(/[\s　]/g, "");
  let best: { key: string; at: number } | null = null;
  for (const c of CITIES) {
    const at = t.indexOf(c.zh.replace(/台/g, "臺"));
    if (at >= 0 && (!best || at < best.at)) best = { key: c.key, at };
  }
  return best?.key ?? null;
}

/** Government or private, read from the name the Ministry uses ("國立…", "臺北市立…", "私立…"). */
export function ownershipFromName(name: string): "public" | "private" | null {
  const n = squash(name);
  if (/^(?:國立|.{2,3}[市縣]立)|[市縣]立/.test(n)) return "public";
  if (/私立|財團法人/.test(n)) return "private";
  return null;
}

/** Column positions by any of the names a publisher uses. -1 when the column is absent. */
function columns<T extends Record<string, readonly string[]>>(header: string[], names: T): Record<keyof T, number> {
  const h = header.map(squash);
  return Object.fromEntries(Object.entries(names).map(([k, v]) => [k, h.findIndex((x) => v.some((n) => squash(n) === x))])) as Record<keyof T, number>;
}
const cell = (r: string[], i: number) => (i < 0 ? "" : (r[i] ?? "").trim());

interface Draft {
  name: string;
  type: MoreKind;
  ownership: "public" | "private" | null;
  area: Pick<RawRow, "city" | "district" | "address">;
  website: string;
  /** The published address, or "" when it must not be kept (district-level kinds). */
  address: string;
  source: MoreRecord["source"];
  idPrefix: string;
}

function build(drafts: Draft[]): MorePlan {
  const plan: MorePlan = { records: [], skipped: 0, unplaced: [] };
  const seen = new Set<string>();
  for (const d of drafts) {
    const name = tidy(d.name).slice(0, 200);
    if (name.length < 2) { plan.skipped++; continue; }
    const area = matchArea(d.area);
    // An address without a district ("臺北市內湖路一段520號") still says which city: the pin then sits at city level.
    const city = area?.city ?? cityOnly(`${d.area.city ?? ""}${d.area.address ?? ""}`);
    if (!city) {
      plan.skipped++;
      if (plan.unplaced.length < 8) plan.unplaced.push(`${name}: ${[d.area.city, d.area.district, d.area.address].filter(Boolean).join(" ").slice(0, 50)}`);
      continue;
    }
    const district = area?.district ?? null;
    // District-level kinds are told apart by their district; official ones by their city.
    const sourceId = `${d.idPrefix}:${sha(`${norm(name)}|${d.address ? city : district ?? city}`)}`;
    if (seen.has(sourceId)) { plan.skipped++; continue; }
    seen.add(sourceId);
    const pos = (district ? placeInDistrict(district, sourceId) : null) ?? placeInCity(city, sourceId);
    if (!pos) { plan.skipped++; continue; }
    plan.records.push({ countryCode: "TW", name, type: d.type, ownership: d.ownership, city, district, latitude: pos.lat, longitude: pos.lng, website: cleanWebsite(d.website), address: d.address ? cleanAddress(d.address) : null, source: d.source, sourceId });
  }
  return plan;
}

/* ---------------- special-education schools (特殊教育學校名錄, 28 schools) ---------------- */

export function planSpecialEducation(csv: string): MorePlan {
  const t = parseCsv(csv);
  if (t.length < 2) return { records: [], skipped: 0, unplaced: [] };
  const ix = columns(t[0]!, { city: ["縣市"], name: ["學校", "學校名稱"], address: ["地址"], website: ["網址"] });
  if (ix.name < 0) throw new Error(`Special-education list: no school-name column (columns: ${t[0]!.join(", ")})`);
  return build(t.slice(1).map((r) => ({ name: cell(r, ix.name), type: "special_education", ownership: ownershipFromName(cell(r, ix.name)), area: { city: cell(r, ix.city), address: cell(r, ix.address) }, website: cell(r, ix.website), address: cell(r, ix.address), source: "moe_open_data", idPrefix: "moe:special" })));
}

/* ---------------- community colleges (社區大學據點資訊: every teaching site, every term since 2019) ---------------- */

const MAIN_SITE = /校本部|本部|總部|總校|主校區|辦公室/;

/** One record per community college, from its newest year, placed at its main site (or the first site listed). */
export function planCommunityColleges(csv: string): MorePlan {
  const t = parseCsv(csv);
  if (t.length < 2) return { records: [], skipped: 0, unplaced: [] };
  const ix = columns(t[0]!, { year: ["年度"], city: ["縣市別"], name: ["社區大學名稱"], site: ["據點名稱"], address: ["據點地址"] });
  if (ix.name < 0 || ix.address < 0) throw new Error(`Community-college list: columns not recognised (${t[0]!.join(", ")})`);
  const rows = t.slice(1).map((r) => ({ year: Number(cell(r, ix.year)) || 0, city: cell(r, ix.city), name: tidy(cell(r, ix.name)), site: cell(r, ix.site), address: cell(r, ix.address) })).filter((r) => r.name);
  const newest = Math.max(0, ...rows.map((r) => r.year));
  const byName = new Map<string, typeof rows>();
  for (const r of rows) if (r.year === newest) byName.set(norm(r.name), [...(byName.get(norm(r.name)) ?? []), r]);
  return build([...byName.values()].map((sites) => {
    const main = sites.find((s) => MAIN_SITE.test(s.site) && s.address) ?? sites.find((s) => s.address) ?? sites[0]!;
    return { name: main.name, type: "community_college", ownership: null, area: { city: main.city, address: main.address }, website: "", address: main.address, source: "moe_open_data", idPrefix: "moe:community" };
  }));
}

/* ---------------- Mandarin centres at universities (各大學校院附設華語文教學中心一覽表, about 70) ---------------- */

export function planMandarinCentres(csv: string): MorePlan {
  const t = parseCsv(csv);
  if (t.length < 2) return { records: [], skipped: 0, unplaced: [] };
  const ix = columns(t[0]!, { name: ["單位名稱"], website: ["網址"], address: ["通訊地址", "地址"], cityCode: ["縣市別代碼"] });
  if (ix.name < 0) throw new Error(`Mandarin-centre list: no name column (columns: ${t[0]!.join(", ")})`);
  return build(t.slice(1).map((r) => {
    // "國立中央大學⏎語言中心": the university and its centre on two lines.
    const name = cell(r, ix.name).split(/[\r\n]+/).map((x) => x.trim()).filter(Boolean).join("");
    const address = cell(r, ix.address).split(/[\r\n]+/)[0]!.replace(/\s{2,}.*$/, "").trim();
    return { name, type: "language_school", ownership: ownershipFromName(name) ?? "private", area: { address }, website: cell(r, ix.website).split(/\s+/)[0] ?? "", address, source: "moe_open_data", idPrefix: "moe:mandarin" };
  }));
}

/* ---------------- seminaries and open universities (the Ministry's own directory format) ---------------- */

/** Religious seminaries (宗教研修學院名錄): degree-granting, so they are listed with the universities. */
export function planSeminaries(csv: string): MorePlan {
  const rows = latestYear(rowsFromMoeCsv(csv).rows);
  return build(rows.map((r) => ({ name: r.name, type: "university", ownership: r.ownership ?? "private", area: { city: r.cityZh, address: r.address }, website: r.website, address: r.address, source: "moe_open_data", idPrefix: "moe:seminary" })));
}

/**
 * The open universities (空大及大專附設進修學校名錄). The same file lists the evening schools attached to colleges; those
 * share a campus with a college that is already listed, so only the open universities are taken.
 */
export function planOpenUniversities(csv: string): MorePlan {
  const rows = latestYear(rowsFromMoeCsv(csv).rows).filter((r) => /空中大學/.test(r.name) && !/附設|附進修/.test(r.name));
  return build(rows.map((r) => ({ name: r.name, type: "university", ownership: r.ownership ?? "public", area: { city: r.cityZh, address: r.address }, website: r.website, address: r.address, source: "moe_open_data", idPrefix: "moe:openuniv" })));
}

/* ---------------- after-school care centres (課後照顧服務中心) ---------------- */

const AFTER_SCHOOL_COLS = {
  name: ["課照中心名稱", "課後照顧中心名稱", "課後照顧服務中心名稱", "中心名稱", "機構名稱", "名稱"],
  city: ["縣市", "縣市別", "縣市名稱", "所在縣市", "地區縣市"],
  district: ["行政區", "鄉鎮市區", "鄉鎮市區名稱"],
  address: ["地址", "中心地址", "立案地址"],
  state: ["立案狀態"],
} as const;

/**
 * Licensed after-school care centres, from a table (CSV text, or JSON rows turned into a table by the caller).
 * District only: no address is kept. A centre whose licence is marked as ended is left out.
 * `defaultCity` is for a city's own list, which does not repeat the city on every row.
 */
export function planAfterSchool(table: string[][], defaultCity?: string): MorePlan {
  if (table.length < 2) return { records: [], skipped: 0, unplaced: [] };
  const ix = columns(table[0]!, AFTER_SCHOOL_COLS);
  if (ix.name < 0) throw new Error(`After-school list: no name column (columns: ${table[0]!.join(", ")})`);
  const cityZh = defaultCity ? CITIES.find((c) => c.key === defaultCity)?.zh ?? "" : "";
  const live = table.slice(1).filter((r) => !/停辦|撤銷|廢止|歇業/.test(cell(r, ix.state)));
  return build(live.map((r) => ({ name: cell(r, ix.name), type: "after_school", ownership: /公立|公辦/.test(cell(r, ix.name)) ? "public" : "private", area: { city: cell(r, ix.city) || cityZh, district: cell(r, ix.district), address: cell(r, ix.address) }, website: "", address: "", source: "gov_open_data", idPrefix: "gov-afterschool" })));
}

/** JSON rows (objects keyed by column name) as a table with a header row. */
export function tableFromObjects(objs: Record<string, unknown>[]): string[][] {
  const header = [...new Set(objs.flatMap((o) => Object.keys(o)))];
  return [header, ...objs.map((o) => header.map((h) => String(o[h] ?? "")))];
}

/* ---------------- English names for universities (全國大學校院名錄(含學校英文名稱)) ---------------- */

/** Chinese name -> English name, as the Ministry publishes it (a known misspelling of "University" is put right). */
export function universityEnglishNames(csv: string): Map<string, string> {
  const t = parseCsv(csv);
  const out = new Map<string, string>();
  if (t.length < 2) return out;
  const ix = columns(t[0]!, { name: ["學校名稱"], en: ["學校英文名稱"] });
  if (ix.name < 0 || ix.en < 0) return out;
  for (const r of t.slice(1)) {
    const zh = norm(cell(r, ix.name));
    const en = tidy(cell(r, ix.en)).replace(/Univers?e?r?i?s?ity/gi, "University");
    if (zh && /^[A-Za-z][A-Za-z .,'&()-]{5,}$/.test(en)) out.set(zh, en);
  }
  return out;
}
