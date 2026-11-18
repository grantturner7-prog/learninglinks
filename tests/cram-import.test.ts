import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TW_DISTRICT_BBOX } from "@/lib/geo/tw-centroids.generated";
import { inferType, mapHeaders, matchArea, parseCsv, placeInDistrict, planImport, rowsFromCsv, rowsFromObjects } from "@/lib/import/cram";

const sample = readFileSync("tests/fixtures/cram-sample.csv", "utf8");

describe("cram school import: reading the table", () => {
  it("reads quoted fields, doubled quotes and a BOM", () => {
    expect(parseCsv('﻿a,b\n"x, y","say ""hi"""\r\n1,2\n')).toEqual([["a", "b"], ["x, y", 'say "hi"'], ["1", "2"]]);
  });
  it("finds the columns by the names publishers use", () => {
    expect(mapHeaders(["縣市 ", "補習班 名稱", "立案字號", "班別", "地址", "電話"])).toEqual({ city: 0, name: 1, regNo: 2, category: 3, address: 4 });
    expect(mapHeaders(["name", "address"])).toEqual({ name: 0, address: 1 });
  });
  it("reads JSON rows the same way", () => {
    const { rows, mapped } = rowsFromObjects([{ 補習班名稱: "甲班", 地址: "臺中市西屯區某路", 電話: "04-1" }]);
    expect(rows[0]).toMatchObject({ name: "甲班", address: "臺中市西屯區某路" });
    expect(mapped.sort()).toEqual(["address", "name"]);
  });
});

describe("cram school import: where a school is", () => {
  it("takes city and district from the address, treating 台 and 臺 alike", () => {
    expect(matchArea({ address: "臺中市西屯區台灣大道三段1號" })).toEqual({ city: "taichung", district: "taichung:xitun" });
    expect(matchArea({ city: "台中市", address: "北屯區文心路" })?.city).toBe("taichung");
  });
  it("handles cities inside counties and counties", () => {
    const a = matchArea({ address: "彰化縣員林市中山路4號" });
    expect(a?.city).toBe("changhua");
    expect(a?.district.startsWith("changhua:")).toBe(true);
  });
  it("accepts a district alone only when its name is unique, and refuses guesses", () => {
    expect(matchArea({ address: "西屯區某路" })?.city).toBe("taichung");
    expect(matchArea({ address: "中正區某路5號" })).toBeNull(); // exists in more than one city
    expect(matchArea({ city: "臺中市" })).toBeNull(); // city only: not placeable
    expect(matchArea({ address: "" })).toBeNull();
  });
  it("places a school inside its district, the same way every time, and spreads schools out", () => {
    const [w, s, e, n] = TW_DISTRICT_BBOX["taichung:xitun"]!;
    const a = placeInDistrict("taichung:xitun", "gov-cram:A")!;
    const b = placeInDistrict("taichung:xitun", "gov-cram:B")!;
    for (const p of [a, b]) {
      expect(p.lng).toBeGreaterThanOrEqual(w); expect(p.lng).toBeLessThanOrEqual(e);
      expect(p.lat).toBeGreaterThanOrEqual(s); expect(p.lat).toBeLessThanOrEqual(n);
    }
    expect(placeInDistrict("taichung:xitun", "gov-cram:A")).toEqual(a);
    expect(a).not.toEqual(b);
    expect(placeInDistrict("nowhere:none", "x")).toBeNull();
  });
});

describe("cram school import: the plan", () => {
  const plan = planImport(rowsFromCsv(sample).rows);

  it("keeps the placeable, unique schools and says why it skipped the rest", () => {
    expect(plan.records.map((r) => r.name)).toEqual(["陽光美語補習班(測試)", "快樂數理班（測試）", '豐原"藝術"補習班（測試）', "員林英語補習班（測試）"]);
    expect(plan.skipped).toEqual({ no_name: 1, no_area: 1, duplicate: 1 });
    expect(plan.unplaced).toHaveLength(1);
    expect(plan.perCity).toEqual({ taichung: 3, changhua: 1 });
  });
  it("stores only name, kind, place and an id: never an address, phone or owner", () => {
    for (const r of plan.records) {
      expect(Object.keys(r).sort()).toEqual(["city", "countryCode", "district", "latitude", "longitude", "name", "source", "sourceId", "type"]);
      expect(JSON.stringify(r)).not.toMatch(/04-0000|王小明|李小華|台灣大道|文心路/);
    }
  });
  it("uses the registration number as the stable id and marks the source", () => {
    expect(plan.records[0]).toMatchObject({ source: "gov_open_data", sourceId: "gov-cram:中市教補字第0001號" });
  });
  it("tells language schools from the rest", () => {
    expect(plan.records.map((r) => r.type)).toEqual(["language_school", "cram_school", "cram_school", "language_school"]);
    expect(inferType({ name: "Mandarin Center", category: "語文類" })).toBe("language_school");
    expect(inferType({ name: "數學班" })).toBe("cram_school");
  });
  it("is stable: planning twice gives the same positions", () => {
    expect(planImport(rowsFromCsv(sample).rows).records).toEqual(plan.records);
  });
});
