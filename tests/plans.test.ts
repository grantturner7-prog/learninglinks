import { describe, expect, it } from "vitest";
import { PLANS, planFor, priceFor, splitTax } from "@/lib/plans";

describe("plans", () => {
  it("charges the owner's flat prices", () => {
    expect(PLANS.school_tw.listPrice).toBe(10_000);
    expect(PLANS.family_tw.listPrice).toBe(2_000);
  });
  it("has no discount unless one is configured", () => {
    expect(priceFor(PLANS.school_tw)).toBe(10_000);
    expect(priceFor(PLANS.family_tw)).toBe(2_000);
    expect(priceFor(PLANS.school_tw, 0)).toBe(10_000);
  });
  it("only applies a configured discount, clamped and rounded to 10", () => {
    expect(priceFor(PLANS.school_tw, 20)).toBe(8_000);
    expect(priceFor(PLANS.school_tw, 999)).toBe(1_000);
    expect(priceFor(PLANS.school_tw, -5)).toBe(10_000);
  });
  it("splits tax so that net + tax equals the amount paid", () => {
    for (const gross of [10_000, 2_000, 1, 999, 12_345]) {
      const { net, tax } = splitTax(gross, 5);
      expect(net + tax).toBe(gross);
    }
    expect(splitTax(10_000, 5)).toEqual({ net: 9_524, tax: 476 });
    expect(splitTax(2_000, 5)).toEqual({ net: 1_905, tax: 95 });
  });
  it("looks up the plan for an audience and country", () => {
    expect(planFor("school", "TW")?.code).toBe("school_tw");
    expect(planFor("family", "TW")?.code).toBe("family_tw");
    expect(planFor("school", "JP")).toBeUndefined();
  });
  it("keeps family memberships closed until Phase 2", () => {
    expect(PLANS.family_tw.available).toBe(false);
    expect(PLANS.school_tw.available).toBe(true);
  });
});
