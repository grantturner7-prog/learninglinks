import { getText, realSleep, stripBom, type FetchFn, type FetchOptions } from "./cram-fetch";
import type { MoeKind } from "./moe";

/**
 * Fetching the Ministry of Education's school directories straight from open data (data.gov.tw dataset pages point
 * at stats.moe.gov.tw). Nothing to download by hand. The list of files is read from data.gov.tw; if that page cannot
 * be reached the known addresses below are used.
 */

export interface MoeSource {
  kind: MoeKind;
  label: string;
  datasetId: number;
  /** Used when the dataset page cannot be read. */
  fallbackUrl: string;
  /** Datasets that keep one CSV per school year: take the newest year. */
  perYear: boolean;
}

export const MOE_SOURCES: MoeSource[] = [
  { kind: "elementary", label: "國民小學名錄 (elementary)", datasetId: 6087, fallbackUrl: "https://stats.moe.gov.tw/files/school/115/e1_new.csv", perYear: true },
  { kind: "junior_high", label: "國民中學名錄 (junior high)", datasetId: 6088, fallbackUrl: "https://stats.moe.gov.tw/files/opendata/j1_new.csv", perYear: false },
  { kind: "senior_high", label: "一般高級中等學校名錄 (senior high and vocational)", datasetId: 6089, fallbackUrl: "https://stats.moe.gov.tw/files/school/115/high.csv", perYear: true },
  { kind: "senior_high", label: "獨立高級中等進修學校名錄 (independent evening schools)", datasetId: 6090, fallbackUrl: "https://stats.moe.gov.tw/files/opendata/highV.csv", perYear: false },
  { kind: "senior_high", label: "大專附設高級中等進修學校名錄 (evening schools attached to colleges)", datasetId: 24393, fallbackUrl: "https://stats.moe.gov.tw/files/school/115/highT.csv", perYear: true },
  { kind: "university", label: "大專校院名錄 (universities and colleges)", datasetId: 6091, fallbackUrl: "https://stats.moe.gov.tw/files/opendata/u1_new.csv", perYear: false },
  { kind: "university", label: "軍警大專校院名錄 (military and police academies)", datasetId: 28589, fallbackUrl: "https://stats.moe.gov.tw/files/opendata/school08_new.csv", perYear: false },
  { kind: "international", label: "Schools for International Residents in ROC (外國僑民學校)", datasetId: 32958, fallbackUrl: "", perYear: false },
];

export const datasetApi = (id: number) => `https://data.gov.tw/api/v2/rest/dataset/${id}`;

interface Dist { resourceFormat?: string; resourceDownloadUrl?: string }

/** The CSV to read for one dataset: the newest school year for per-year datasets, the only CSV otherwise. */
export function pickCsv(dists: Dist[], perYear: boolean): string | null {
  const csvs = dists.filter((d) => (d.resourceFormat ?? "").toUpperCase() === "CSV" && d.resourceDownloadUrl && isTrustedMoeUrl(d.resourceDownloadUrl)).map((d) => d.resourceDownloadUrl!);
  if (csvs.length === 0) return null;
  if (!perYear) return csvs[csvs.length - 1]!;
  const year = (u: string) => Number(/\/school\/(\d+)\//.exec(u)?.[1] ?? 0);
  return [...csvs].sort((a, b) => year(b) - year(a))[0]!;
}

/** Only https addresses on the Ministry's and the open-data portal's own hosts. */
export const isTrustedMoeUrl = (u: string) => {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && ["stats.moe.gov.tw", "ws.moe.edu.tw", "data.gov.tw"].includes(x.hostname);
  } catch {
    return false;
  }
};

export interface FetchedMoe { source: MoeSource; url: string; text: string }
export interface MoeFetchResult { files: FetchedMoe[]; failed: { label: string; error: string }[] }

export async function fetchMoe(opts: FetchOptions = {}): Promise<MoeFetchResult> {
  const o = { fetchFn: opts.fetchFn ?? (fetch as unknown as FetchFn), sleep: opts.sleep ?? realSleep, attempts: opts.attempts ?? 3, timeoutMs: opts.timeoutMs ?? 90_000 };
  const log = opts.log ?? (() => {});
  const out: MoeFetchResult = { files: [], failed: [] };
  for (const s of MOE_SOURCES) {
    try {
      let url: string | null = null;
      try {
        const meta = JSON.parse(stripBom(await getText(datasetApi(s.datasetId), { ...o, attempts: 2, timeoutMs: 30_000 }))) as { result?: { distribution?: Dist[] } };
        url = pickCsv(meta.result?.distribution ?? [], s.perYear);
      } catch {
        /* fall back to the known address */
      }
      url = url ?? (s.fallbackUrl || null);
      if (!url) throw new Error("no download address found");
      const text = stripBom(await getText(url, o));
      out.files.push({ source: s, url, text });
      log(`  ${s.label}: ${text.length.toLocaleString("en-US")} characters`);
    } catch (err) {
      out.failed.push({ label: s.label, error: err instanceof Error ? err.message : String(err) });
      log(`  ${s.label}: FAILED (${err instanceof Error ? err.message : err})`);
    }
    await o.sleep(opts.pauseMs ?? 400);
  }
  return out;
}
