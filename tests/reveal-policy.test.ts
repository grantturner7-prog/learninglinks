import { describe, expect, it } from "vitest";
import { decideReveal } from "@/lib/reveal/policy";

const base = { hasActiveMembership: true, educatorAvailable: true, alreadyRevealedToday: false, distinctRevealedToday: 0, dailyCap: 100 };

describe("contact reveal policy", () => {
  it("allows an active member and counts it toward the cap", () => {
    expect(decideReveal(base)).toEqual({ allowed: true, countsTowardCap: true });
  });
  it("denies without an active membership", () => {
    expect(decideReveal({ ...base, hasActiveMembership: false })).toEqual({ allowed: false, reason: "no_membership" });
  });
  it("denies hidden, draft or suspended educators", () => {
    expect(decideReveal({ ...base, educatorAvailable: false })).toEqual({ allowed: false, reason: "unavailable" });
  });
  it("denies a NEW educator once the daily cap is reached", () => {
    expect(decideReveal({ ...base, distinctRevealedToday: 100 })).toEqual({ allowed: false, reason: "daily_cap" });
    expect(decideReveal({ ...base, distinctRevealedToday: 99 })).toEqual({ allowed: true, countsTowardCap: true });
  });
  it("lets a member re-view an educator they already revealed today, even at the cap", () => {
    expect(decideReveal({ ...base, alreadyRevealedToday: true, distinctRevealedToday: 100 })).toEqual({ allowed: true, countsTowardCap: false });
  });
  it("checks availability before membership so nothing leaks about hidden educators", () => {
    expect(decideReveal({ ...base, educatorAvailable: false, hasActiveMembership: false })).toEqual({ allowed: false, reason: "unavailable" });
  });
});
