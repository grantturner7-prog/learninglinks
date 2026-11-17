import { describe, expect, it } from "vitest";
import { activeTerm, addMonthsUtc, computeNextTerm, daysUntil, dueReminder, isActiveAt } from "@/lib/membership/engine";

const d = (s: string) => new Date(s);

describe("membership terms", () => {
  it("adds calendar months and clamps to month end", () => {
    expect(addMonthsUtc(d("2027-01-31T00:00:00Z"), 1).toISOString()).toBe("2027-02-28T00:00:00.000Z");
    expect(addMonthsUtc(d("2028-01-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
    expect(addMonthsUtc(d("2027-02-01T00:00:00Z"), 12).toISOString()).toBe("2028-02-01T00:00:00.000Z");
  });
  it("starts a first purchase now and lasts 12 months", () => {
    const now = d("2027-02-01T08:00:00Z");
    const t = computeNextTerm([], now);
    expect(t.startsAt).toEqual(now);
    expect(t.endsAt.toISOString()).toBe("2028-02-01T08:00:00.000Z");
  });
  it("stacks an early renewal after the current term so no days are lost", () => {
    const now = d("2027-06-01T00:00:00Z");
    const current = { startsAt: d("2027-02-01T00:00:00Z"), endsAt: d("2028-02-01T00:00:00Z") };
    const next = computeNextTerm([current], now);
    expect(next.startsAt).toEqual(current.endsAt);
    expect(next.endsAt.toISOString()).toBe("2029-02-01T00:00:00.000Z");
  });
  it("starts a renewal now when the old term has already ended", () => {
    const now = d("2028-03-01T00:00:00Z");
    const old = { startsAt: d("2027-02-01T00:00:00Z"), endsAt: d("2028-02-01T00:00:00Z") };
    expect(computeNextTerm([old], now).startsAt).toEqual(now);
  });
  it("is active from the start instant until, but not including, the end instant", () => {
    const t = { startsAt: d("2027-02-01T00:00:00Z"), endsAt: d("2028-02-01T00:00:00Z") };
    expect(isActiveAt([t], d("2027-01-31T23:59:59Z"))).toBe(false);
    expect(isActiveAt([t], d("2027-02-01T00:00:00Z"))).toBe(true);
    expect(isActiveAt([t], d("2028-01-31T23:59:59Z"))).toBe(true);
    expect(isActiveAt([t], d("2028-02-01T00:00:00Z"))).toBe(false);
    expect(activeTerm([t], d("2027-05-05T00:00:00Z"))).toBe(t);
  });
  it("never renews on its own: expiry means no active term", () => {
    const t = { startsAt: d("2027-02-01T00:00:00Z"), endsAt: d("2028-02-01T00:00:00Z") };
    expect(isActiveAt([t], d("2030-01-01T00:00:00Z"))).toBe(false);
  });
});

describe("renewal reminders", () => {
  const ends = d("2028-02-01T00:00:00Z");
  it("counts whole days left", () => {
    expect(daysUntil(ends, d("2027-12-03T00:00:00Z"))).toBe(60);
  });
  it("sends the 60-day reminder first, once", () => {
    expect(dueReminder(ends, d("2027-12-03T00:00:00Z"), [])).toBe(60);
    expect(dueReminder(ends, d("2027-12-03T00:00:00Z"), [60])).toBeNull();
  });
  it("sends nothing early", () => {
    expect(dueReminder(ends, d("2027-10-01T00:00:00Z"), [])).toBeNull();
  });
  it("sends the most urgent unsent reminder, not an expiry notice too soon", () => {
    expect(dueReminder(ends, d("2028-01-27T00:00:00Z"), [60, 30])).toBe(7);
    expect(dueReminder(ends, ends, [60, 30, 7])).toBe(0);
  });
  it("sends nothing after expiry", () => {
    expect(dueReminder(ends, d("2028-02-05T00:00:00Z"), [])).toBeNull();
  });
});
