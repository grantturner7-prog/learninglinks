import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "messages");
const read = (loc: string, ns: string) => JSON.parse(readFileSync(join(root, loc, `${ns}.json`), "utf-8")) as Record<string, unknown>;
const namespaces = (loc: string) => readdirSync(join(root, loc)).filter((f) => f.endsWith(".json")).map((f) => f.replace(".json", ""));

function keys(obj: unknown, prefix = ""): string[] {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => keys(v, `${prefix}${k}.`));
  }
  if (Array.isArray(obj)) return [`${prefix}[${obj.length}]`];
  return [prefix.slice(0, -1)];
}

describe("translations", () => {
  it("have the same namespaces in English and Traditional Chinese", () => {
    expect(namespaces("zh-TW").sort()).toEqual(namespaces("en-TW").sort());
  });
  for (const ns of namespaces("en-TW")) {
    it(`have identical keys (and list lengths) in "${ns}"`, () => {
      expect(keys(read("zh-TW", ns)).sort()).toEqual(keys(read("en-TW", ns)).sort());
    });
  }
});

describe("compliance notice (must never be removed)", () => {
  it("says LearningLinks is only a connection website and does no background checks, in both languages", () => {
    const en = read("en-TW", "notice") as Record<string, string>;
    const zh = read("zh-TW", "notice") as Record<string, string>;
    for (const field of ["full", "short", "acknowledge"] as const) {
      expect(en[field]).toMatch(/background check/i);
      expect(zh[field]).toContain("背景調查");
    }
    expect(en.lead).toMatch(/connection website/i);
    expect(zh.lead).toContain("連結平台");
    expect(en.full).toMatch(/government/i);
    expect(zh.full).toContain("政府");
    expect(en.full).toMatch(/teachers, schools or families/i);
  });
});
