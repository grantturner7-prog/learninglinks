import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/plans";

describe("money is written NT$ in every language", () => {
  it("never prints a bare $ for Taiwan dollars", () => {
    for (const locale of ["en-TW", "zh-TW", "en", "zh"]) {
      expect(formatMoney(2000, "TWD", locale)).toBe("NT$2,000");
      expect(formatMoney(30_000, "TWD", locale)).toBe("NT$30,000");
    }
  });
});
