import type { OpenTo } from "@/lib/taxonomy";

/**
 * Who may see which educator. Single source of truth: SQL filters, DTO projection and UI all use this.
 *
 *  - Schools see educators open to full-time or part-time work (the two work together). They NEVER see
 *    educators who offer private tutoring only.
 *  - Families see only educators who offer private tutoring or coaching. They never see the rest.
 *  - An educator in both groups is shown to each audience with only that audience's side: schools do not
 *    see that the educator tutors (or the rate); families do not see the educator's school-work wishes.
 */
export type Audience = "school" | "family";

export const AUDIENCE_OPEN_TO: Record<Audience, readonly OpenTo[]> = {
  school: ["full_time", "part_time"],
  family: ["private_tutoring"],
};

export function isVisibleToAudience(openTo: readonly string[], audience: Audience): boolean {
  return AUDIENCE_OPEN_TO[audience].some((t) => openTo.includes(t));
}

/** The "open to" values an audience is allowed to see for an educator (everything else is hidden). */
export function openToForAudience(openTo: readonly string[], audience: Audience): OpenTo[] {
  return AUDIENCE_OPEN_TO[audience].filter((t) => openTo.includes(t));
}

/** Hourly tutoring rates are shown to families only. */
export function canSeeTutoringRate(audience: Audience): boolean {
  return audience === "family";
}
