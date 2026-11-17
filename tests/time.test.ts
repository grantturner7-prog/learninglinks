import { describe, expect, it } from "vitest";
import { startOfDayInZone } from "@/lib/time";

describe("startOfDayInZone", () => {
  it("finds midnight in Taipei (UTC+8)", () => {
    expect(startOfDayInZone(new Date("2026-11-17T20:00:00Z"), "Asia/Taipei").toISOString()).toBe("2026-11-17T16:00:00.000Z");
    expect(startOfDayInZone(new Date("2026-11-17T05:00:00Z"), "Asia/Taipei").toISOString()).toBe("2026-11-16T16:00:00.000Z");
  });
  it("is stable at the exact boundary", () => {
    expect(startOfDayInZone(new Date("2026-11-17T16:00:00Z"), "Asia/Taipei").toISOString()).toBe("2026-11-17T16:00:00.000Z");
  });
  it("works for another country's zone", () => {
    expect(startOfDayInZone(new Date("2026-11-17T12:00:00Z"), "Asia/Bangkok").toISOString()).toBe("2026-11-16T17:00:00.000Z");
  });
});
