import { describe, expect, it } from "vitest";
import { PLANS, planFor, priceForCampuses, splitTax } from "@/lib/plans";

describe("plans", () => {
  it("charges the owner's prices, VAT included", () => {
    expect(PLANS.school_tw.listPrice).toBe(10_000);
    expect(PLANS.school_tw.perCampus).toBe(true);
    expect(PLANS.family_tw.listPrice).toBe(2_000);
  });
  it("charges the full 10,000 for every campus: no discount for extra campuses", () => {
    expect(priceForCampuses(PLANS.school_tw)).toBe(10_000);
    expect(priceForCampuses(PLANS.school_tw, 1)).toBe(10_000);
    expect(priceForCampuses(PLANS.school_tw, 2)).toBe(20_000);
    expect(priceForCampuses(PLANS.school_tw, 3)).toBe(30_000);
    expect(priceForCampuses(PLANS.school_tw, 10)).toBe(100_000);
  });
  it("is exactly linear, so a campus added later costs the same as one bought up front", () => {
    for (let n = 1; n <= 12; n++) expect(priceForCampuses(PLANS.school_tw, n)).toBe(n * PLANS.school_tw.listPrice);
  });
  it("rejects an invalid number of campuses", () => {
    for (const bad of [0, -1, 1.5, Number.NaN]) {
      expect(() => priceForCampuses(PLANS.school_tw, bad)).toThrow();
    }
  });
  it("charges families a single price and no campuses", () => {
    expect(priceForCampuses(PLANS.family_tw)).toBe(2_000);
    expect(() => priceForCampuses(PLANS.family_tw, 2)).toThrow();
  });
  it("splits tax so that net + tax equals the amount paid", () => {
    for (const gross of [10_000, 20_000, 30_000, 2_000, 1, 999, 12_345]) {
      const { net, tax } = splitTax(gross, 5);
      expect(net + tax).toBe(gross);
    }
    expect(splitTax(10_000, 5)).toEqual({ net: 9_524, tax: 476 });
    expect(splitTax(20_000, 5)).toEqual({ net: 19_048, tax: 952 });
    expect(splitTax(30_000, 5)).toEqual({ net: 28_571, tax: 1_429 });
    expect(splitTax(2_000, 5)).toEqual({ net: 1_905, tax: 95 });
  });
  it("looks up the plan for an audience and country", () => {
    expect(planFor("school", "TW")?.code).toBe("school_tw");
    expect(planFor("family", "TW")?.code).toBe("family_tw");
    expect(planFor("school", "JP")).toBeUndefined();
  });
  it("opens both Taiwan plans at launch", () => {
    expect(PLANS.school_tw.available).toBe(true);
    expect(PLANS.family_tw.available).toBe(true);
  });
});
