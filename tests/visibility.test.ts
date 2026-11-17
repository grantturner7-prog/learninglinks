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
