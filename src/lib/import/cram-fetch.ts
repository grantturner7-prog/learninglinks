/**
 * Fetching the national cram-school (補習班) table straight from the Ministry of Education's open data, so nobody has
 * to download and paste it. The dataset is "全國立案短期補習班基本資料" on data.gov.tw (dataset 16461, Government Open
 * Data License v1). It is published as one JSON file per city or county. We read the list of files from data.gov.tw and
 * fall back to the known list if that page cannot be reached.
 *
 * Pure of side effects except the network: `fetch` and `sleep` are passed in so the tests run without internet.
 */

export const DATASET_PAGE = "https://data.gov.tw/dataset/16461";
export const DATASET_API = "https://data.gov.tw/api/v2/rest/dataset/16461";
export const fileUrl = (code: string) => `https://bsb.kh.edu.tw/afterschool/opendata/afterschool_json.jsp?city=${code}`;

/**
 * Cities that also publish their own list on their own open-data site (found on data.gov.tw, Nov 2026). These sites
 * answer from anywhere, unlike the Ministry's national server, so they are the way to load the big cities when the
 * national file cannot be reached. Together they hold about 10,100 of Taiwan's roughly 17,800 cram schools. A school
 * loaded from a city list and later from the national file is the same record (same name and district).
 */
export interface CitySource {
  city: string;
  label: string;
  datasetId: number;
  fallbackUrl: string;
}
export const CITY_SOURCES: readonly CitySource[] = [
  { city: "taipei", label: "臺北市立案補習班資訊 (Taipei)", datasetId: 130907, fallbackUrl: "https://data.taipei/api/dataset/b124a967-fc88-4c45-bea8-41b4ef158a15/resource/4c2d87de-a09b-4636-8a7d-7eec71dc873d/download" },
  { city: "new-taipei", label: "新北市短期補習班立案資訊 (New Taipei)", datasetId: 124223, fallbackUrl: "https://data.ntpc.gov.tw/api/datasets/a3716c81-3652-4450-897d-3574b875888b/csv/file" },
  { city: "taichung", label: "臺中市立案補習班資料 (Taichung)", datasetId: 83903, fallbackUrl: "https://newdatacenter.taichung.gov.tw/api/v1/no-auth/resource.download?rid=c2c3e17b-99e4-464e-8899-f40946d5da9c" },
  { city: "tainan", label: "臺南市立案補習班資訊 (Tainan)", datasetId: 179130, fallbackUrl: "https://data.tainan.gov.tw/File/ResourceCsvDownload/068ce90f-5e63-4031-bb66-dd68ce9c42d2" },
  { city: "nantou", label: "南投縣補習班 (Nantou)", datasetId: 38307, fallbackUrl: "https://data.nantou.gov.tw/dataset/3b0a0b70-711f-4ddb-8b46-47f9ff2176da/resource/e0510896-0de9-437f-a855-be9ae1d0b73b/download/afterschool1.csv" },
];
/** The cities' own open-data hosts. The link comes from a web page, so nothing else is followed. */
const CITY_HOSTS = new Set(["data.taipei", "data.ntpc.gov.tw", "newdatacenter.taichung.gov.tw", "data.tainan.gov.tw", "data.nantou.gov.tw"]);
export const isCityListSource = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && CITY_HOSTS.has(x.hostname);
  } catch {
    return false;
  }
};

/** The 22 city and county codes seen on data.gov.tw (Sept 2026), used only if the dataset page cannot be read. */
export const FALLBACK_CITY_CODES = ["24", "20", "21", "33", "35", "36", "37", "42", "47", "55", "49", "52", "53", "62", "70", "87", "39", "38", "89", "69", "82", "83"] as const;

export interface SourceFile {
  url: string;
  label: string;
  /** How many schools data.gov.tw says the file holds (null when unknown). */
  expected: number | null;
}

export type FetchFn = (url: string, init?: { signal?: AbortSignal; headers?: Record<string, string> }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface FetchOptions {
  fetchFn?: FetchFn;
  sleep?: (ms: number) => Promise<void>;
  /** Tries per file before giving up. */
  attempts?: number;
  timeoutMs?: number;
  /** Pause between files, so we are polite to a public server. */
  pauseMs?: number;
  log?: (line: string) => void;
}

export const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const HEADERS = { "User-Agent": "LearningLinks-data-import/1.0", Accept: "*/*" };

/** Only government hosts over https: the file list comes from a web page, so do not follow it anywhere else. */
export const isTrustedSource = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && /(^|\.)(edu|gov)\.tw$/.test(x.hostname);
  } catch {
    return false;
  }
};

export async function getText(url: string, o: Required<Pick<FetchOptions, "fetchFn" | "sleep" | "attempts" | "timeoutMs">>): Promise<string> {
  let last: unknown;
  for (let i = 1; i <= o.attempts; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), o.timeoutMs);
    try {
      const res = await o.fetchFn(url, { signal: ctl.signal, headers: HEADERS });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      last = err;
      if (i < o.attempts) await o.sleep(1000 * 2 ** (i - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  const cause = last instanceof Error ? (last.cause instanceof Error ? `${last.message}: ${last.cause.message}` : last.message) : String(last);
  throw new Error(`Could not fetch ${url} (${cause})`);
}

/** The list of files from data.gov.tw, or the known list when that page is unreachable or looks wrong. */
export async function listSourceFiles(opts: FetchOptions = {}): Promise<{ files: SourceFile[]; fromDataset: boolean }> {
  const o = { fetchFn: opts.fetchFn ?? (fetch as unknown as FetchFn), sleep: opts.sleep ?? realSleep, attempts: opts.attempts ?? 2, timeoutMs: opts.timeoutMs ?? 30_000 };
  try {
    const json = JSON.parse(stripBom(await getText(DATASET_API, o))) as { result?: { distribution?: { resourceDescription?: string; resourceDownloadUrl?: string; resourceAmount?: number | string; resourceFormat?: string }[] } };
    const files = (json.result?.distribution ?? [])
      .filter((d) => d.resourceDownloadUrl && isTrustedSource(d.resourceDownloadUrl) && (d.resourceFormat ?? "JSON").toUpperCase() === "JSON")
      .map((d) => ({ url: d.resourceDownloadUrl!, label: d.resourceDescription ?? d.resourceDownloadUrl!, expected: Number.isFinite(Number(d.resourceAmount)) && Number(d.resourceAmount) > 0 ? Number(d.resourceAmount) : null }));
    if (files.length >= 10) return { files, fromDataset: true };
  } catch {
    /* fall through to the known list */
  }
  return { files: FALLBACK_CITY_CODES.map((c) => ({ url: fileUrl(c), label: `city ${c}`, expected: null })), fromDataset: false };
}

export const stripBom = (s: string) => s.replace(/^﻿/, "");

/** Rows out of a JSON document: an array of objects, or an object that wraps one (at most two levels down). */
export function extractObjects(json: unknown): Record<string, unknown>[] {
  const isRows = (v: unknown): v is Record<string, unknown>[] => Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "object" && x !== null && !Array.isArray(x));
  if (isRows(json)) return json;
  if (typeof json === "object" && json !== null) {
    for (const v of Object.values(json)) {
      if (isRows(v)) return v;
      if (typeof v === "object" && v !== null) for (const w of Object.values(v)) if (isRows(w)) return w;
    }
  }
  return [];
}

export interface FetchedFile extends SourceFile {
  rows: Record<string, unknown>[];
  raw: string;
}

export interface NationalResult {
  files: FetchedFile[];
  failed: { url: string; label: string; error: string }[];
  /** Files whose row count is far from what data.gov.tw says they hold. */
  suspicious: string[];
  fromDataset: boolean;
  /** How many files came from data.gov.tw's own copy because the Ministry's server did not answer. */
  fromPortalCopy: number;
  /** The oldest date among those copies (YYYY-MM-DD), so the owner knows how fresh the data is. */
  portalCopyDate: string | null;
}

/** Counts that differ by more than a tenth (and more than 5 rows) from the published figure deserve a look. */
export const countLooksOff = (got: number, expected: number | null) => expected !== null && Math.abs(got - expected) > Math.max(5, expected * 0.1);

export async function fetchNational(opts: FetchOptions = {}): Promise<NationalResult> {
  const o = { fetchFn: opts.fetchFn ?? (fetch as unknown as FetchFn), sleep: opts.sleep ?? realSleep, attempts: opts.attempts ?? 3, timeoutMs: opts.timeoutMs ?? 60_000 };
  const log = opts.log ?? (() => {});
  const pause = opts.pauseMs ?? 500;
  const { files: list, fromDataset } = await listSourceFiles({ ...opts, ...o });
  log(fromDataset ? `Dataset list read from data.gov.tw: ${list.length} files.` : `Could not read the dataset list from data.gov.tw; using the known list of ${list.length} files.`);
  const result: NationalResult = { files: [], failed: [], suspicious: [], fromDataset, fromPortalCopy: 0, portalCopyDate: null };
  // The Ministry's server refuses connections from outside Taiwan. data.gov.tw keeps its own copy of every file; it is
  // looked up only when a file cannot be fetched, and once the Ministry's server has failed twice it is not tried again.
  let copies: Map<string, PortalCopy> | null = null;
  let originFailures = 0;
  const take = (f: SourceFile, raw: string) => {
    const rows = extractObjects(JSON.parse(raw));
    result.files.push({ ...f, rows, raw });
    const off = countLooksOff(rows.length, f.expected);
    if (off) result.suspicious.push(`${f.label}: ${rows.length} rows, data.gov.tw says ${f.expected}`);
    return `${rows.length} rows${f.expected !== null ? ` (published count ${f.expected})` : ""}${off ? "  <-- check" : ""}`;
  };
  for (const f of list) {
    let originError: unknown = null;
    // After two failures in a row, go straight to the copy for the files that have one.
    if (!(originFailures >= 2 && copies?.has(f.url))) {
      try {
        log(`  ${f.label}: ${take(f, stripBom(await getText(f.url, o)))}`);
        originFailures = 0;
        await o.sleep(pause);
        continue;
      } catch (err) {
        originError = err;
        originFailures++;
      }
    }
    copies ??= await portalCopies(NATIONAL_DATASET_ID, { ...o, attempts: 2 });
    const copy = copies.get(f.url);
    try {
      if (!copy) throw originError ?? new Error("the Ministry's server is not answering and data.gov.tw has no copy of this file");
      const said = take(f, stripBom(await getText(copy.json, o)));
      result.fromPortalCopy++;
      if (copy.checked && (!result.portalCopyDate || copy.checked < result.portalCopyDate)) result.portalCopyDate = copy.checked;
      log(`  ${f.label}: ${said}, from data.gov.tw's own copy${copy.checked ? ` of ${copy.checked}` : ""}`);
    } catch (err) {
      // Say why the Ministry's server failed when that is what we know; otherwise why the copy failed.
      const shown = originError ?? err;
      result.failed.push({ url: f.url, label: f.label, error: shown instanceof Error ? shown.message : String(shown) });
      log(`  ${f.label}: FAILED (${shown instanceof Error ? shown.message : shown})`);
    }
    await o.sleep(pause);
  }
  return result;
}

/* ---------------- data.gov.tw's own copy of a dataset's files ---------------- */

export const NATIONAL_DATASET_ID = 16461;
export const datasetDetailApi = (id: number) => `https://data.gov.tw/api/front/dataset/detail?nid=${id}`;

export interface PortalCopy {
  /** The copy as JSON rows, on quality.data.gov.tw. */
  json: string;
  /** The day data.gov.tw last fetched the file (YYYY-MM-DD), when it says so. */
  checked: string | null;
}

/**
 * data.gov.tw fetches every published file for its quality check and keeps the result on quality.data.gov.tw, which
 * answers from anywhere. Returns those copies keyed by the file's own address. Empty when the page cannot be read.
 */
export async function portalCopies(datasetId: number, o: Required<Pick<FetchOptions, "fetchFn" | "sleep" | "attempts" | "timeoutMs">>): Promise<Map<string, PortalCopy>> {
  const out = new Map<string, PortalCopy>();
  try {
    const json = JSON.parse(stripBom(await getText(datasetDetailApi(datasetId), o))) as { payload?: { resources?: { url?: string; quality_download?: { json?: string }; quality_check_time?: { date?: string } }[] } };
    for (const r of json.payload?.resources ?? []) {
      const copy = r.quality_download?.json;
      if (!r.url || !copy) continue;
      let host = "";
      try { host = new URL(copy).hostname; } catch { continue; }
      if (!copy.startsWith("https://") || host !== "quality.data.gov.tw") continue;
      out.set(r.url, { json: copy, checked: /^\d{4}-\d{2}-\d{2}/.exec(r.quality_check_time?.date ?? "")?.[0] ?? null });
    }
  } catch {
    /* no copies known */
  }
  return out;
}

/* ---------------- the cities' own lists ---------------- */

export interface CityFile {
  source: CitySource;
  /** The file as text (CSV, or JSON), with any BOM removed. */
  text: string;
  url: string;
}
export interface CityResult {
  files: CityFile[];
  failed: { label: string; url: string; error: string }[];
}

/** Where a city's file is today: the JSON or CSV link on its data.gov.tw page, or the address we last saw. */
async function cityFileUrl(s: CitySource, o: Required<Pick<FetchOptions, "fetchFn" | "sleep" | "attempts" | "timeoutMs">>): Promise<string> {
  try {
    const json = JSON.parse(stripBom(await getText(`https://data.gov.tw/api/v2/rest/dataset/${s.datasetId}`, { ...o, attempts: 2 }))) as { result?: { distribution?: { resourceDownloadUrl?: string; resourceFormat?: string }[] } };
    const usable = (json.result?.distribution ?? []).filter((d) => d.resourceDownloadUrl && isCityListSource(d.resourceDownloadUrl));
    const pick = usable.find((d) => (d.resourceFormat ?? "").toUpperCase() === "JSON") ?? usable.find((d) => (d.resourceFormat ?? "").toUpperCase() === "CSV");
    if (pick?.resourceDownloadUrl) return pick.resourceDownloadUrl;
  } catch {
    /* fall through to the address we last saw */
  }
  return s.fallbackUrl;
}

/** Fetch the lists the cities publish themselves. A city that fails is reported, never hidden. */
export async function fetchCityLists(opts: FetchOptions = {}, sources: readonly CitySource[] = CITY_SOURCES): Promise<CityResult> {
  const o = { fetchFn: opts.fetchFn ?? (fetch as unknown as FetchFn), sleep: opts.sleep ?? realSleep, attempts: opts.attempts ?? 3, timeoutMs: opts.timeoutMs ?? 90_000 };
  const log = opts.log ?? (() => {});
  const result: CityResult = { files: [], failed: [] };
  for (const s of sources) {
    const url = await cityFileUrl(s, o);
    try {
      const text = stripBom(await getText(url, o));
      if (text.trim().length < 20) throw new Error("the file is empty");
      result.files.push({ source: s, text, url });
      log(`  ${s.label}: fetched`);
    } catch (err) {
      result.failed.push({ label: s.label, url, error: err instanceof Error ? err.message : String(err) });
      log(`  ${s.label}: FAILED (${err instanceof Error ? err.message : err})`);
    }
    await o.sleep(opts.pauseMs ?? 500);
  }
  return result;
}
