import { describe, expect, it } from "vitest";
import { isAdminEmail, safeNext, sanitizeAccountType } from "@/lib/auth/helpers";

describe("account type", () => {
  it("accepts the three public account types", () => {
    for (const t of ["educator", "school", "family"]) expect(sanitizeAccountType(t)).toBe(t);
  });
  it("never lets a client pick admin or anything unknown", () => {
    for (const bad of ["admin", "root", "", null, undefined, 5, {}, ["school"]]) expect(sanitizeAccountType(bad)).toBe("educator");
  });
});

describe("safeNext (open-redirect protection)", () => {
  it("allows normal same-site paths", () => {
    expect(safeNext("/dashboard")).toBe("/dashboard");
    expect(safeNext("/educators?x=1")).toBe("/educators?x=1");
  });
  it("falls back for anything that could leave the site", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil", "", null, undefined, "/%2F%2Fevil.example", "/%5Cevil", "/https:evil"]) {
      expect(safeNext(bad as string | null | undefined)).toBe("/dashboard");
    }
  });
  it("uses a custom fallback", () => {
    expect(safeNext("//x", "/home")).toBe("/home");
  });
});

describe("admin rule", () => {
  const admins = ["owner@example.com"];
  it("requires a VERIFIED email on the list", () => {
    expect(isAdminEmail("owner@example.com", true, admins)).toBe(true);
    expect(isAdminEmail("owner@example.com", false, admins)).toBe(false);
  });
  it("ignores case and spaces", () => {
    expect(isAdminEmail("  OWNER@Example.com ", true, admins)).toBe(true);
  });
  it("is false for everyone else and for an empty list", () => {
    expect(isAdminEmail("other@example.com", true, admins)).toBe(false);
    expect(isAdminEmail("owner@example.com", true, [])).toBe(false);
  });
});
