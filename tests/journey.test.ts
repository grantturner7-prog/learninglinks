import { describe, expect, it } from "vitest";
import { STEP_COUNT, earliestErrorStep, firstIncompleteStep, parseStep, stepForBlocker, stepForField } from "@/lib/educators/journey";
import type { ProfileInput } from "@/lib/educators/profile-input";

const empty: ProfileInput = {
  displayName: "", headline: null, bio: null, city: null, districts: [], subjects: [], levels: [], languages: [], teachingModes: [],
  openTo: [], workAuthorization: null, experienceBand: null, rateMin: null, rateMax: null, credentials: [], contacts: {},
};

describe("guided profile flow", () => {
  it("sends every form field to the question it belongs to", () => {
    expect(stepForField("displayName")).toBe(1);
    expect(stepForField("bio")).toBe(2);
    expect(stepForField("languages")).toBe(3);
    expect(stepForField("subjects")).toBe(4);
    expect(stepForField("districts")).toBe(5);
    expect(stepForField("rateMax")).toBe(6);
    expect(stepForField("credUrl_3")).toBe(7);
    expect(stepForField("contact_line")).toBe(8);
    expect(stepForField("anything-else")).toBe(9);
  });
  it("jumps to the earliest step with an error", () => {
    expect(earliestErrorStep({ contact_email: "invalidEmail", bio: "contactInfo" })).toBe(2);
    expect(earliestErrorStep({})).toBe(1);
  });
  it("maps every publish blocker to a step inside the flow", () => {
    for (const b of ["displayName", "subjects", "levels", "languages", "teachingModes", "city", "openTo", "contact", "waiver"] as const) {
      const n = stepForBlocker(b);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(STEP_COUNT);
    }
  });
  it("resumes at the first question that still needs an answer", () => {
    expect(firstIncompleteStep(empty, false)).toBe(1);
    expect(firstIncompleteStep({ ...empty, displayName: "Emily R." }, true)).toBe(3);
    const withTeaching = { ...empty, displayName: "E", languages: ["en"], teachingModes: ["in_person"] };
    expect(firstIncompleteStep(withTeaching, true)).toBe(4);
    expect(firstIncompleteStep({ ...withTeaching, subjects: ["phonics"] }, true)).toBe(5);
    expect(firstIncompleteStep({ ...withTeaching, subjects: ["phonics"], levels: ["kindergarten"], city: "taichung" }, true)).toBe(6);
    expect(firstIncompleteStep({ ...withTeaching, subjects: ["phonics"], levels: ["kindergarten"], city: "taichung", openTo: ["part_time"] }, true)).toBe(8);
    expect(firstIncompleteStep({ ...withTeaching, subjects: ["phonics"], levels: ["kindergarten"], city: "taichung", openTo: ["part_time"], contacts: { email: "a@b.co" } }, true)).toBe(9);
  });
  it("accepts only real step numbers from the URL", () => {
    expect(parseStep("4")).toBe(4);
    expect(parseStep(["9"])).toBe(9);
    for (const bad of ["0", "10", "x", "", undefined, "2.5"]) expect(parseStep(bad)).toBeNull();
  });
});

import { buildFormData, draftToInput, toDraft, toggle } from "@/lib/educators/journey-draft";
import { parseProfileForm } from "@/lib/educators/profile-input";

describe("the flow's draft and the server's rules agree", () => {
  const input: ProfileInput = {
    displayName: "Emily R.", headline: "Phonics", bio: "I teach kindergarten classes with phonics, songs and picture books.", city: "taichung",
    districts: ["taichung:xitun"], subjects: ["phonics", "mathematics"], levels: ["kindergarten"], languages: ["en"], teachingModes: ["in_person"],
    openTo: ["part_time", "private_tutoring"], workAuthorization: "open_work_rights", experienceBand: "5-9", rateMin: 600, rateMax: 900,
    credentials: [{ label: "TEFL 120h", year: 2021, proofUrl: "https://issuer.example/x" }], contacts: { email: "e@example.com", line: "emily_t" },
  };
  it("round-trips a profile through the draft and the server's form parser", () => {
    const { values, errors } = parseProfileForm(buildFormData(toDraft(input), "zh-TW", "save"), new Date("2026-11-17"));
    expect(errors).toEqual({});
    expect(values).toEqual(input);
  });
  it("gives the rules the same view the educator has typed", () => {
    expect(draftToInput({ ...toDraft(input), subjects: [] }).subjects).toEqual([]);
  });
  it("toggles list choices on and off and respects a maximum", () => {
    expect(toggle(["a"], "b")).toEqual(["a", "b"]);
    expect(toggle(["a", "b"], "a")).toEqual(["b"]);
    expect(toggle(["a", "b"], "c", 2)).toEqual(["a", "b"]);
  });
});
