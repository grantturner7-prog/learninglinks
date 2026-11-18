import { describe, expect, it } from "vitest";
import { columnsOf, mapHeaders, planImport, rowsFromObjects } from "@/lib/import/cram";
import { countLooksOff, DATASET_API, extractObjects, fetchNational, FALLBACK_CITY_CODES, isTrustedSource, listSourceFiles, type FetchFn } from "@/lib/import/cram-fetch";

const noSleep = async () => {};
const ok = (body: string) => ({ ok: true, status: 200, text: async () => body });
const row = (name: string, addr: string) => ({ 地區縣市: "臺中市", 短期補習班名稱: name, 主管機關文件單位代碼: "3", 電子郵件: "a@b.c", 短期補習班類別: "文理補習班", 地址: addr, 立案時間: "1030101" });

const dist = (n: number) => Array.from({ length: n }, (_, i) => ({ resourceDescription: `file ${i}`, resourceFormat: "JSON", resourceAmount: i === 0 ? 2 : 1, resourceDownloadUrl: `https://bsb.kh.edu.tw/afterschool/opendata/afterschool_json.jsp?city=${i}` }));
const meta = (n: number) => JSON.stringify({ success: true, result: { distribution: dist(n) } });

describe("the Ministry's column names", () => {
  it("are recognised, and the authority code is never taken for a registration number", () => {
    const idx = mapHeaders(["地區縣市", "短期補習班名稱", "主管機關文件單位代碼", "電子郵件", "短期補習班類別", "地址", "立案時間", "各地短期補習班數量"]);
    expect(idx).toEqual({ city: 0, name: 1, category: 4, address: 5 });
    expect(idx).not.toHaveProperty("regNo");
  });
  it("turn into a plan that keeps only name, kind, city and district", () => {
    const { rows } = rowsFromObjects([row("陽光美語補習班", "臺中市西屯區台灣大道三段1號"), row("快樂數理班", "臺中市北屯區文心路四段2號")]);
    const plan = planImport(rows);
    expect(plan.records).toHaveLength(2);
    expect(plan.records[0]).toMatchObject({ type: "language_school", city: "taichung", source: "gov_open_data" });
    expect(JSON.stringify(plan.records)).not.toMatch(/a@b\.c|台灣大道|文心路/); // no email, no street
  });
  it("lists the columns found, for a helpful message when one is not recognised", () => {
    expect(columnsOf([{ a: 1 }, { b: 2 }])).toEqual(["a", "b"]);
  });
});

describe("reading the JSON", () => {
  it("accepts an array, or an object wrapping one, but not scalars", () => {
    expect(extractObjects([{ a: 1 }])).toEqual([{ a: 1 }]);
    expect(extractObjects({ data: [{ a: 1 }] })).toEqual([{ a: 1 }]);
    expect(extractObjects({ result: { records: [{ a: 1 }] } })).toEqual([{ a: 1 }]);
    expect(extractObjects("x")).toEqual([]);
    expect(extractObjects([1, 2])).toEqual([]);
  });
  it("only trusts government addresses over https", () => {
    expect(isTrustedSource("https://bsb.kh.edu.tw/x")).toBe(true);
    expect(isTrustedSource("https://data.gov.tw/x")).toBe(true);
    expect(isTrustedSource("http://bsb.kh.edu.tw/x")).toBe(false);
    expect(isTrustedSource("https://evil.example/edu.tw")).toBe(false);
    expect(isTrustedSource("https://edu.tw.evil.example/x")).toBe(false);
    expect(isTrustedSource("nonsense")).toBe(false);
  });
  it("judges a count against the published figure", () => {
    expect(countLooksOff(2630, 2628)).toBe(false);
    expect(countLooksOff(100, 2628)).toBe(true);
    expect(countLooksOff(3, 2)).toBe(false);
    expect(countLooksOff(10, null)).toBe(false);
  });
});

describe("finding the files", () => {
  it("reads the list and the published counts from data.gov.tw", async () => {
    const fetchFn: FetchFn = async (u) => (u === DATASET_API ? ok(meta(12)) : ok("[]"));
    const { files, fromDataset } = await listSourceFiles({ fetchFn, sleep: noSleep });
    expect(fromDataset).toBe(true);
    expect(files).toHaveLength(12);
    expect(files[0]).toMatchObject({ expected: 2 });
  });
  it("ignores links that are not government https addresses", async () => {
    const bad = JSON.stringify({ result: { distribution: [...dist(12), { resourceDownloadUrl: "https://evil.example/x.json", resourceFormat: "JSON" }] } });
    const { files } = await listSourceFiles({ fetchFn: async () => ok(bad), sleep: noSleep });
    expect(files).toHaveLength(12);
  });
  it("falls back to the known 22 files when the page cannot be read or looks wrong", async () => {
    const down: FetchFn = async () => { throw new Error("offline"); };
    const a = await listSourceFiles({ fetchFn: down, sleep: noSleep, attempts: 2 });
    expect(a.fromDataset).toBe(false);
    expect(a.files).toHaveLength(FALLBACK_CITY_CODES.length);
    expect(a.files.every((f) => f.url.startsWith("https://bsb.kh.edu.tw/"))).toBe(true);
    const odd = await listSourceFiles({ fetchFn: async () => ok(meta(3)), sleep: noSleep });
    expect(odd.fromDataset).toBe(false);
  });
});

describe("fetching everything", () => {
  const body = (n: number) => JSON.stringify(Array.from({ length: n }, (_, i) => row(`班${i}`, "臺中市西屯區某路")));

  it("fetches every file, strips a BOM, and reports counts", async () => {
    const calls: string[] = [];
    const fetchFn: FetchFn = async (u) => { calls.push(u); return ok(u === DATASET_API ? meta(12) : "﻿" + body(1)); };
    const lines: string[] = [];
    const res = await fetchNational({ fetchFn, sleep: noSleep, log: (l) => lines.push(l) });
    expect(res.files).toHaveLength(12);
    expect(res.failed).toHaveLength(0);
    expect(res.files[1]!.rows).toHaveLength(1);
    expect(calls.filter((c) => c !== DATASET_API)).toHaveLength(12);
    expect(lines.some((l) => l.includes("data.gov.tw"))).toBe(true);
  });
  it("flags a file whose size is far from the published count, and not one inside the margin", async () => {
    const fetchFn: FetchFn = async (u) => ok(u === DATASET_API ? meta(12) : u.endsWith("city=0") ? body(100) : body(1));
    const res = await fetchNational({ fetchFn, sleep: noSleep });
    expect(res.suspicious).toHaveLength(1);
    expect(res.suspicious[0]).toContain("file 0");
  });
  it("retries a flaky file and then succeeds", async () => {
    let n = 0;
    const fetchFn: FetchFn = async (u) => {
      if (u === DATASET_API) return ok(meta(12));
      if (u.endsWith("city=3") && n++ < 2) throw new Error("reset");
      return ok(body(1));
    };
    const res = await fetchNational({ fetchFn, sleep: noSleep });
    expect(res.failed).toHaveLength(0);
    expect(n).toBe(3);
  });
  it("reports a file that never arrives instead of hiding it", async () => {
    const fetchFn: FetchFn = async (u) => {
      if (u === DATASET_API) return ok(meta(12));
      if (u.endsWith("city=5")) throw Object.assign(new Error("fetch failed"), { cause: new Error("read ECONNRESET") });
      return ok(body(1));
    };
    const res = await fetchNational({ fetchFn, sleep: noSleep });
    expect(res.files).toHaveLength(11);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0]!.error).toContain("ECONNRESET");
  });
  it("counts an HTTP error as a failure, and a page that is not JSON as one too", async () => {
    const fetchFn: FetchFn = async (u) => {
      if (u === DATASET_API) return ok(meta(12));
      if (u.endsWith("city=1")) return { ok: false, status: 503, text: async () => "" };
      if (u.endsWith("city=2")) return ok("<html>maintenance</html>");
      return ok(body(1));
    };
    const res = await fetchNational({ fetchFn, sleep: noSleep });
    expect(res.failed.map((f) => f.label).sort()).toEqual(["file 1", "file 2"]);
  });
});
