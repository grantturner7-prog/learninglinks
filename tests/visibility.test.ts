import { describe, expect, it } from "vitest";
import { OPEN_TO } from "@/lib/taxonomy";
import { canSeeTutoringRate, isVisibleToAudience, openToForAudience } from "@/lib/visibility";

describe("who can see which educator", () => {
  it("hides tutoring-only educators from schools", () => {
    expect(isVisibleToAudience(["private_tutoring"], "school")).toBe(false);
  });
  it("shows schools anyone open to full-time or part-time work, which work together", () => {
    expect(isVisibleToAudience(["full_time"], "school")).toBe(true);
    expect(isVisibleToAudience(["part_time"], "school")).toBe(true);
    expect(isVisibleToAudience(["full_time", "part_time"], "school")).toBe(true);
    expect(openToForAudience(["full_time", "part_time"], "school")).toEqual(["full_time", "part_time"]);
  });
  it("hides school-work-only educators from families", () => {
    for (const t of ["full_time", "part_time"]) {
      expect(isVisibleToAudience([t], "family")).toBe(false);
    }
  });
  it("shows families only educators who offer private tutoring", () => {
    expect(isVisibleToAudience(["private_tutoring"], "family")).toBe(true);
    expect(isVisibleToAudience([], "family")).toBe(false);
    expect(isVisibleToAudience([], "school")).toBe(false);
  });
  it("shows an educator in both groups to both audiences, each seeing only its own side", () => {
    const both = ["part_time", "private_tutoring"];
    expect(isVisibleToAudience(both, "school")).toBe(true);
    expect(isVisibleToAudience(both, "family")).toBe(true);
    expect(openToForAudience(both, "school")).toEqual(["part_time"]);
    expect(openToForAudience(both, "family")).toEqual(["private_tutoring"]);
  });
  it("shows tutoring rates to families only", () => {
    expect(canSeeTutoringRate("family")).toBe(true);
    expect(canSeeTutoringRate("school")).toBe(false);
  });
  it("does not offer substitute work: schools and educators arrange cover between themselves", () => {
    expect(OPEN_TO as readonly string[]).not.toContain("substitute");
    expect(isVisibleToAudience(["substitute"], "school")).toBe(false);
  });
});

import { canSeeJobs, projectEducatorForAudience, type ProfileForProjection } from "@/lib/visibility";

const profile = (over: Partial<ProfileForProjection> = {}): ProfileForProjection => ({
  id: "e1", status: "published", displayName: "Emily R.", headline: "Phonics", bio: "Hello",
  photoKey: "abc.webp", city: "taichung", districts: ["taichung:xitun"], subjects: ["phonics"], levels: ["kindergarten"],
  languages: ["en"], teachingModes: ["in_person"], openTo: ["part_time", "private_tutoring"], workAuthorization: "open_work_rights",
  experienceBand: "5-9", rateMin: 600, rateMax: 900, credentials: [{ label: "TEFL 120h", year: 2021 }], ...over,
});

describe("projecting an educator for an audience", () => {
  it("never shows an unpublished profile to anyone", () => {
    for (const status of ["draft", "hidden", "suspended"]) {
      expect(projectEducatorForAudience(profile({ status }), "school")).toBeNull();
      expect(projectEducatorForAudience(profile({ status }), "family")).toBeNull();
    }
  });
  it("gives schools only the school side, no rate and no tutoring", () => {
    const dto = projectEducatorForAudience(profile(), "school")!;
    expect(dto.openTo).toEqual(["part_time"]);
    expect(dto.rate).toBeNull();
    expect(dto.workAuthorization).toBe("open_work_rights");
    expect(JSON.stringify(dto)).not.toContain("private_tutoring");
    expect(JSON.stringify(dto)).not.toContain("600");
  });
  it("gives families only the tutoring side, the rate, and no work authorization", () => {
    const dto = projectEducatorForAudience(profile(), "family")!;
    expect(dto.openTo).toEqual(["private_tutoring"]);
    expect(dto.rate).toEqual({ min: 600, max: 900 });
    expect(dto.workAuthorization).toBeNull();
    expect(JSON.stringify(dto)).not.toContain("part_time");
  });
  it("returns nothing for an audience that is not allowed to see the educator", () => {
    expect(projectEducatorForAudience(profile({ openTo: ["private_tutoring"] }), "school")).toBeNull();
    expect(projectEducatorForAudience(profile({ openTo: ["full_time"] }), "family")).toBeNull();
  });
  it("exposes a photo flag, never the storage key", () => {
    const dto = projectEducatorForAudience(profile(), "school")!;
    expect(dto.hasPhoto).toBe(true);
    expect(JSON.stringify(dto)).not.toContain("abc.webp");
  });
});

describe("who may see job posts", () => {
  it("allows only signed-in educators who have a profile", () => {
    expect(canSeeJobs({ accountType: "educator", hasProfile: true })).toBe(true);
  });
  it("refuses the public, educators without a profile, suspended profiles, families and schools", () => {
    expect(canSeeJobs(null)).toBe(false);
    expect(canSeeJobs({ accountType: "educator", hasProfile: false })).toBe(false);
    expect(canSeeJobs({ accountType: "educator", hasProfile: true, profileSuspended: true })).toBe(false);
    expect(canSeeJobs({ accountType: "family", hasProfile: true })).toBe(false);
    expect(canSeeJobs({ accountType: "school", hasProfile: true })).toBe(false);
  });
});
