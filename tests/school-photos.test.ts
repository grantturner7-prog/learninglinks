import { describe, expect, it } from "vitest";
import { cityOfChineseName, cityOfPosition, isReusableLicence, metresBetween, planSchoolPhotos, type PhotoEntry, type SchoolRow } from "@/lib/import/school-photos";
import { reasonsFor } from "@/lib/moderation/reasons";

const entry = (o: Partial<PhotoEntry> & { wikidata: string; zh: string }): PhotoEntry => ({ file: "File:x.jpg", thumbUrl: "https://upload.wikimedia.org/x.jpg", pageUrl: "https://commons.wikimedia.org/wiki/File:x.jpg", licence: "CC BY-SA 4.0", licenceUrl: "https://creativecommons.org/licenses/by-sa/4.0", author: "A. Photographer", sha256: "a".repeat(64), ...o });
const school = (o: Partial<SchoolRow> & { id: string; name: string }): SchoolRow => ({ city: null, lat: null, lng: null, source: "moe_open_data", ...o });

describe("which school a reviewed picture belongs to", () => {
  it("matches the same name in the same city when there is only one such school there", () => {
    const plan = planSchoolPhotos(
      [entry({ wikidata: "Q1", zh: "嘉義市東區興安國民小學" })],
      [school({ id: "a", name: "市立興安國小", city: "chiayi-city" }), school({ id: "b", name: "市立興安國小", city: "taipei" })],
    );
    expect(plan.matches).toEqual([expect.objectContaining({ schoolId: "a", how: "name and city" })]);
    expect(plan.left).toEqual([]);
  });

  it("uses the position when both have a real one, even among several schools of the same name", () => {
    const plan = planSchoolPhotos(
      [entry({ wikidata: "Q2", zh: "臺中市立中山國民小學", lat: 24.1502, lng: 120.6703 })],
      [
        school({ id: "far", name: "中山國小", city: "taichung", lat: 24.3, lng: 120.72, source: "osm_import" }),
        school({ id: "near", name: "中山國小", city: "taichung", lat: 24.1505, lng: 120.6701, source: "osm_import" }),
      ],
    );
    expect(plan.matches).toEqual([expect.objectContaining({ schoolId: "near", how: "name and position" })]);
  });

  it("leaves a picture out when two schools in the city share the name and the position cannot settle it", () => {
    const plan = planSchoolPhotos(
      [entry({ wikidata: "Q3", zh: "臺中市立中山國民小學" })],
      [school({ id: "a", name: "中山國小", city: "taichung" }), school({ id: "b", name: "市立中山國小", city: "taichung" })],
    );
    expect(plan.matches).toEqual([]);
    expect(plan.left).toEqual([expect.objectContaining({ wikidata: "Q3", why: "several schools of that name" })]);
  });

  it("does not trust the made-up position of a Ministry-only school", () => {
    const plan = planSchoolPhotos(
      [entry({ wikidata: "Q4", zh: "大同國民小學", lat: 22.63, lng: 120.3 })],
      [school({ id: "a", name: "大同國小", city: "kaohsiung", lat: 22.6301, lng: 120.3001, source: "moe_open_data" }), school({ id: "b", name: "大同國小", city: "miaoli", source: "moe_open_data" })],
    );
    // The name alone says no city, the position says Kaohsiung, and only one 大同國小 is in Kaohsiung: matched by city, not by distance.
    expect(plan.matches).toEqual([expect.objectContaining({ schoolId: "a", how: "name and city" })]);
  });

  it("leaves a picture out when its position could be in two cities (Taipei sits inside New Taipei) and the name does not say", () => {
    const plan = planSchoolPhotos(
      [entry({ wikidata: "Q4b", zh: "大同國民小學", lat: 25.05, lng: 121.52 })],
      [school({ id: "a", name: "大同國小", city: "taipei" }), school({ id: "b", name: "大同國小", city: "new-taipei" })],
    );
    expect(plan.matches).toEqual([]);
  });

  it("matches a name that exists once in the whole country when the picture says no city", () => {
    const plan = planSchoolPhotos([entry({ wikidata: "Q5", zh: "國立臺灣大學" })], [school({ id: "ntu", name: "國立臺灣大學", city: "taipei" })]);
    expect(plan.matches).toEqual([expect.objectContaining({ schoolId: "ntu", how: "name, only one in Taiwan" })]);
  });

  it("never matches a different school, and says why a picture was left out", () => {
    const plan = planSchoolPhotos([entry({ wikidata: "Q6", zh: "高雄市立不存在國民中學" })], [school({ id: "a", name: "市立存在國中", city: "kaohsiung" })]);
    expect(plan.matches).toEqual([]);
    expect(plan.left[0]).toMatchObject({ why: "no school of that name" });
  });

  it("gives a school one picture only", () => {
    const plan = planSchoolPhotos(
      [entry({ wikidata: "Q7", zh: "國立政治大學" }), entry({ wikidata: "Q8", zh: "政治大學" })],
      [school({ id: "nccu", name: "國立政治大學", city: "taipei" })],
    );
    expect(plan.matches).toHaveLength(1);
    expect(plan.left).toEqual([expect.objectContaining({ wikidata: "Q8", why: "school already has a picture in this list" })]);
  });

  it("treats 台 and 臺 as the same and reads the city from the front of a name", () => {
    expect(cityOfChineseName("台北市立大安國中")).toBe("taipei");
    expect(cityOfChineseName("臺中市西屯區西屯國民小學")).toBe("taichung");
    expect(cityOfChineseName("嘉義縣私立協同高級中學")).toBe("chiayi-county");
    expect(cityOfChineseName("嘉義市東區興安國民小學")).toBe("chiayi-city");
    expect(cityOfChineseName("新竹縣立竹北國中")).toBe("hsinchu-county");
    expect(cityOfChineseName("國立臺灣大學")).toBeNull();
  });

  it("finds the city of a position only when it is unambiguous", () => {
    expect(cityOfPosition(22.63, 120.3)).toBe("kaohsiung");
    expect(cityOfPosition(10, 100)).toBeNull();
  });

  it("measures short distances well enough", () => {
    expect(metresBetween(24.15, 120.67, 24.15, 120.67)).toBe(0);
    const d = metresBetween(24.15, 120.67, 24.159, 120.67); // 0.009 degrees of latitude is about 1 km
    expect(d).toBeGreaterThan(950);
    expect(d).toBeLessThan(1050);
  });
});

describe("licences", () => {
  it("accepts only licences that let anyone reuse the picture", () => {
    for (const ok of ["CC BY-SA 4.0", "CC BY 2.0", "CC BY-SA 3.0", "CC0", "Public domain", "cc-by-sa-4.0", "PD"]) expect(isReusableLicence(ok), ok).toBe(true);
    for (const no of ["", "GFDL", "CC BY-NC 2.0", "CC BY-NC-SA 4.0", "CC BY-ND 4.0", "Copyrighted", "Fair use", "All rights reserved"]) expect(isReusableLicence(no), no).toBe(false);
  });
});

describe("reporting a picture", () => {
  it("offers 'the picture is wrong or shows people' for schools only", () => {
    expect(reasonsFor("organization")).toContain("picture");
    expect(reasonsFor("educator")).not.toContain("picture");
    expect(reasonsFor("job")).not.toContain("picture");
    expect(reasonsFor("job")).toContain("substitute_work");
    expect(reasonsFor("organization")).not.toContain("substitute_work");
  });
});
