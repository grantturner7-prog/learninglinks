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

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const HEADERS = { "User-Agent": "LearningLinks-data-import/1.0", Accept: "application/json" };

/** Only government hosts over https: the file list comes from a web page, so do not follow it anywhere else. */
export const isTrustedSource = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && /(^|\.)(edu|gov)\.tw$/.test(x.hostname);
  } catch {
    return false;
  }
};

async function getText(url: string, o: Required<Pick<FetchOptions, "fetchFn" | "sleep" | "attempts" | "timeoutMs">>): Promise<string> {
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

const stripBom = (s: string) => s.replace(/^﻿/, "");

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
}

/** Counts that differ by more than a tenth (and more than 5 rows) from the published figure deserve a look. */
export const countLooksOff = (got: number, expected: number | null) => expected !== null && Math.abs(got - expected) > Math.max(5, expected * 0.1);

export async function fetchNational(opts: FetchOptions = {}): Promise<NationalResult> {
  const o = { fetchFn: opts.fetchFn ?? (fetch as unknown as FetchFn), sleep: opts.sleep ?? realSleep, attempts: opts.attempts ?? 3, timeoutMs: opts.timeoutMs ?? 60_000 };
  const log = opts.log ?? (() => {});
  const pause = opts.pauseMs ?? 500;
  const { files: list, fromDataset } = await listSourceFiles({ ...opts, ...o });
  log(fromDataset ? `Dataset list read from data.gov.tw: ${list.length} files.` : `Could not read the dataset list from data.gov.tw; using the known list of ${list.length} files.`);
  const result: NationalResult = { files: [], failed: [], suspicious: [], fromDataset };
  for (const f of list) {
    try {
      const raw = stripBom(await getText(f.url, o));
      const rows = extractObjects(JSON.parse(raw));
      result.files.push({ ...f, rows, raw });
      const off = countLooksOff(rows.length, f.expected);
      if (off) result.suspicious.push(`${f.label}: ${rows.length} rows, data.gov.tw says ${f.expected}`);
      log(`  ${f.label}: ${rows.length} rows${f.expected !== null ? ` (published count ${f.expected})` : ""}${off ? "  <-- check" : ""}`);
    } catch (err) {
      result.failed.push({ url: f.url, label: f.label, error: err instanceof Error ? err.message : String(err) });
      log(`  ${f.label}: FAILED (${err instanceof Error ? err.message : err})`);
    }
    await o.sleep(pause);
  }
  return result;
}
