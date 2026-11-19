import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TW_CITY_BBOX } from "@/lib/geo/tw-centroids.generated";
import { coreName, latestYear, NOT_A_SCHOOL, placeInCity, planMoe, refineKind, rowsFromMoeCsv } from "@/lib/import/moe";
import { isTrustedMoeUrl, pickCsv } from "@/lib/import/moe-fetch";

const f = (n: string) => readFileSync(`tests/fixtures/${n}`, "utf8");

describe("Ministry of Education school lists: reading", () => {
  it("reads the columns the Ministry uses and strips the [code] prefixes", () => {
    const { rows } = rowsFromMoeCsv(f("moe-university.csv"));
    const ntu = rows.find((r) => r.name === "國立臺灣大學")!;
    expect(ntu).toMatchObject({ code: "0003", ownership: "public", cityZh: "臺北市", website: "http://www.ntu.edu.tw" });
    expect(ntu.address.startsWith("臺北市大安區")).toBe(true);
    expect(rows.find((r) => r.name === "東海大學")!.ownership).toBe("private");
  });
  it("keeps only the newest school year when a file repeats every year", () => {
    const { rows } = rowsFromMoeCsv(f("moe-university.csv"));
    expect(new Set(rows.map((r) => r.year)).size).toBeGreaterThan(1);
    expect(new Set(latestYear(rows).map((r) => r.year)).size).toBe(1);
  });
  it("reads the English file for schools for international residents", () => {
    const { rows } = rowsFromMoeCsv(f("moe-international.csv"));
    expect(rows[0]).toMatchObject({ english: true, ownership: "private" });
    expect(rows[0]!.countyEn).toBe("Taipei City");
  });
});

describe("Ministry of Education school lists: kinds, places, privacy", () => {
  const plan = planMoe([
    { kind: "university", rows: rowsFromMoeCsv(f("moe-university.csv")).rows },
    { kind: "junior_high", rows: rowsFromMoeCsv(f("moe-junior.csv")).rows },
    { kind: "elementary", rows: rowsFromMoeCsv(f("moe-elementary.csv")).rows },
    { kind: "international", rows: rowsFromMoeCsv(f("moe-international.csv")).rows },
  ]);
  const get = (n: string) => plan.records.find((r) => r.name === n)!;

  it("marks universities and says whether they are government or private", () => {
    expect(get("國立臺灣大學")).toMatchObject({ type: "university", ownership: "public", city: "taipei", district: "taipei:daan" });
    expect(get("東海大學")).toMatchObject({ type: "university", ownership: "private" });
    expect(get("輔仁大學")).toMatchObject({ ownership: "private" });
  });
  it("lists government and private schools by their level", () => {
    expect(get("市立板橋國中")).toMatchObject({ type: "junior_high", ownership: "public", city: "new-taipei", district: "new-taipei:banqiao" });
    expect(get("私立育才國小")).toMatchObject({ type: "elementary", ownership: "private" });
  });
  it("recognises bilingual and international schools by name", () => {
    expect(get("私立玉秀雙語國小").type).toBe("bilingual_school");
    expect(get("縣立鹿江國際國中(小)").type).toBe("international_school");
    expect(refineKind("senior_high", "國立南科國際實驗高級中學")).toBe("international_school");
    expect(refineKind("university", "國際大學")).toBe("university");
  });
  it("puts the schools for international residents in their city, tolerating the file's spelling slips", () => {
    const tas = get("Taipei American School");
    expect(tas).toMatchObject({ type: "international_school", ownership: "private", city: "taipei", nameEn: "Taipei American School" });
    expect(get("Kaohsiung Test School")).toMatchObject({ city: "kaohsiung", district: "kaohsiung:zuoying" }); // "Kaohsiun City" and "Zuoying District"
  });
  it("keeps no street address and no phone number, only a place inside the district", () => {
    const json = JSON.stringify(plan.records);
    expect(json).not.toMatch(/指南路|羅斯福路|\(02\)|\(07\)|\d{4}-?\d{4}/);
    for (const r of plan.records) expect(Object.keys(r).sort()).toEqual(["city", "countryCode", "district", "latitude", "longitude", "name", "nameEn", "ownership", "source", "sourceId", "type", "website"].sort());
  });
  it("gives every school a stable id so a second run updates instead of duplicating", () => {
    const again = planMoe([{ kind: "university", rows: rowsFromMoeCsv(f("moe-university.csv")).rows }]);
    expect(again.records.map((r) => r.sourceId)).toEqual(plan.records.filter((r) => r.type === "university").map((r) => r.sourceId));
    expect(new Set(plan.records.map((r) => r.sourceId)).size).toBe(plan.records.length);
  });
  it("tells the owner how many it kept by kind and by government/private", () => {
    expect(plan.perOwnership.public).toBeGreaterThan(0);
    expect(plan.perOwnership.private).toBeGreaterThan(0);
    expect(plan.perType.university).toBe(5);
  });
});

describe("kindergartens: the Ministry's national kindergarten list", () => {
  const { rows } = rowsFromMoeCsv(f("moe-kindergarten.csv"));
  const plan = planMoe([{ kind: "kindergarten", rows }]);
  const get = (needle: string) => plan.records.find((r) => r.name.includes(needle))!;
  it("reads the district from its own column and keeps only the newest year", () => {
    expect(rows.some((r) => r.districtZh === "中和區" || r.districtZh.endsWith("區"))).toBe(true);
    expect(new Set(latestYear(rows).map((r) => r.year)).size).toBe(1);
    expect(get("溫特爾")).toMatchObject({ type: "kindergarten", ownership: "private", city: "new-taipei" });
    expect(get("溫特爾").district?.startsWith("new-taipei:")).toBe(true);
  });
  it("lists public kindergartens attached to government schools too", () => {
    const pub = plan.records.find((r) => r.ownership === "public");
    expect(pub?.type).toBe("kindergarten");
  });
  it("calls a kindergarten bilingual or international only when its own name says so, not its operator's", () => {
    expect(get("愛妮爾國際").type).toBe("bilingual_school");
    expect(get("林口康橋國際").type).toBe("bilingual_school");
    expect(get("大觀非營利").type).toBe("kindergarten"); // "…中華國際嬰幼兒發展學會" is the operator
    expect(get("中信高級中等學校附設幼兒園").type).toBe("kindergarten"); // "中信國際學校財團法人" is the foundation
    expect(refineKind("kindergarten", "私立Sunny English幼兒園")).toBe("bilingual_school");
  });
  it("recognises 幼稚園 and 幼兒園 as the same, and keeps no address or phone", () => {
    expect(coreName("私立小太陽幼稚園")).toBe(coreName("小太陽幼兒園"));
    expect(JSON.stringify(plan.records)).not.toMatch(/連城路|三樹路|\(02\)|平河里/);
  });
});

describe("recognising the same school in two lists", () => {
  it("ignores who runs it, spaces, and 台 against 臺", () => {
    expect(coreName("市立板橋國中")).toBe(coreName("板橋國中"));
    expect(coreName("臺北市立大安國中")).toBe(coreName("台北市立大安國中"));
    expect(coreName("國立臺灣大學")).toBe(coreName("臺灣大學"));
    expect(coreName("私立育才國小")).toBe("育才國小");
    // the map data writes the long official name with the city and district in front
    expect(coreName("高雄市美濃區東門國民小學")).toBe(coreName("市立東門國小"));
    expect(coreName("高雄市立光華國民中學")).toBe(coreName("市立光華國中"));
    expect(coreName("新竹市中山國小")).not.toBe(coreName("苗栗縣大湖國小"));
  });
});

describe("telling a school from a part of one", () => {
  it("flags departments, branch campuses and buildings, not schools", () => {
    for (const n of ["土木與水資源工程學系", "國立聯合大學二坪山校區", "屈尺國小廣興分校", "私立長春藤高中彰化分校籌備處", "葳格高中附設小學"]) expect(NOT_A_SCHOOL.test(n), n).toBe(true);
    for (const n of ["國立臺灣大學", "市立板橋國中", "私立玉秀雙語國小", "唯心聖教學院"]) expect(NOT_A_SCHOOL.test(n), n).toBe(false);
  });
});

describe("finding the files", () => {
  it("takes the newest school year for per-year datasets and the only file otherwise", () => {
    const d = [
      { resourceFormat: "CSV", resourceDownloadUrl: "https://stats.moe.gov.tw/files/school/103/e1_new.csv" },
      { resourceFormat: "JSON", resourceDownloadUrl: "https://stats.moe.gov.tw/files/school/115/e1_new.json" },
      { resourceFormat: "CSV", resourceDownloadUrl: "https://stats.moe.gov.tw/files/school/115/e1_new.csv" },
      { resourceFormat: "CSV", resourceDownloadUrl: "https://stats.moe.gov.tw/files/school/114/e1_new.csv" },
    ];
    expect(pickCsv(d, true)).toBe("https://stats.moe.gov.tw/files/school/115/e1_new.csv");
    expect(pickCsv([{ resourceFormat: "CSV", resourceDownloadUrl: "https://stats.moe.gov.tw/files/opendata/u1_new.csv" }], false)).toBe("https://stats.moe.gov.tw/files/opendata/u1_new.csv");
    expect(pickCsv([{ resourceFormat: "CSV", resourceDownloadUrl: "https://evil.example/x.csv" }], false)).toBeNull();
  });
  it("only follows the Ministry's own hosts over https", () => {
    expect(isTrustedMoeUrl("https://stats.moe.gov.tw/a.csv")).toBe(true);
    expect(isTrustedMoeUrl("http://stats.moe.gov.tw/a.csv")).toBe(false);
    expect(isTrustedMoeUrl("https://stats.moe.gov.tw.evil.example/a.csv")).toBe(false);
  });
  it("places a school with an unknown district inside its city, the same way every time", () => {
    const [w, s, e, n] = TW_CITY_BBOX.kaohsiung!;
    const p = placeInCity("kaohsiung", "x")!;
    expect(p.lng).toBeGreaterThan(w); expect(p.lng).toBeLessThan(e); expect(p.lat).toBeGreaterThan(s); expect(p.lat).toBeLessThan(n);
    expect(placeInCity("kaohsiung", "x")).toEqual(p);
    expect(placeInCity("nowhere", "x")).toBeNull();
  });
});
