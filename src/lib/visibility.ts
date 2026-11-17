import type { Credential } from "@/lib/db/schema/domain";
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

/**
 * The fields of a stored educator profile that the projection below needs. Declared structurally so this
 * module stays pure (no database import) and so a query that forgets a column fails to type-check.
 */
export interface ProfileForProjection {
  id: string;
  status: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  photoKey: string | null;
  city: string | null;
  districts: readonly string[];
  subjects: readonly string[];
  levels: readonly string[];
  languages: readonly string[];
  teachingModes: readonly string[];
  openTo: readonly string[];
  workAuthorization: string | null;
  experienceBand: string | null;
  rateMin: number | null;
  rateMax: number | null;
  credentials: readonly Credential[];
}

/** What an audience may receive about one educator. Contact details are never part of it. */
export interface EducatorCardDto {
  id: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  hasPhoto: boolean;
  city: string | null;
  districts: string[];
  subjects: string[];
  levels: string[];
  languages: string[];
  teachingModes: string[];
  experienceBand: string | null;
  /** Only this audience's side of what the educator is open to. */
  openTo: OpenTo[];
  /** Hirers only: shown with a "self-declared" label. Families do not receive it. */
  workAuthorization: string | null;
  /** Families only. Schools never receive a tutoring rate. */
  rate: { min: number | null; max: number | null } | null;
  credentials: Credential[];
}

/**
 * The ONLY way an educator profile may be turned into something another user sees.
 * Returns null when the profile is not published or this audience may not see it at all.
 */
export function projectEducatorForAudience(p: ProfileForProjection, audience: Audience): EducatorCardDto | null {
  if (p.status !== "published") return null;
  if (!isVisibleToAudience(p.openTo, audience)) return null;
  const hasRate = p.rateMin !== null || p.rateMax !== null;
  return {
    id: p.id,
    displayName: p.displayName,
    headline: p.headline,
    bio: p.bio,
    hasPhoto: p.photoKey !== null,
    city: p.city,
    districts: [...p.districts],
    subjects: [...p.subjects],
    levels: [...p.levels],
    languages: [...p.languages],
    teachingModes: [...p.teachingModes],
    experienceBand: p.experienceBand,
    openTo: openToForAudience(p.openTo, audience),
    workAuthorization: audience === "school" ? p.workAuthorization : null,
    rate: canSeeTutoringRate(audience) && hasRate ? { min: p.rateMin, max: p.rateMax } : null,
    credentials: p.credentials.map((c) => ({ ...c })),
  };
}

/** Who is looking at job posts (or the school map). */
export interface JobViewer {
  accountType: string;
  /** The viewer has created an educator profile (draft, published or hidden). */
  hasProfile: boolean;
  profileSuspended?: boolean;
}

/**
 * Job posts are visible ONLY to signed-in educators who have an account and a profile (owner decision,
 * 17 Nov 2026). Not the public, not search engines, not families, not other schools.
 */
export function canSeeJobs(viewer: JobViewer | null | undefined): boolean {
  if (!viewer) return false;
  return viewer.accountType === "educator" && viewer.hasProfile && !viewer.profileSuspended;
}
