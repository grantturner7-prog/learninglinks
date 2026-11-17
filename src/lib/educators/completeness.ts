import type { ProfileInput } from "./profile-input";

/** Characters of bio that count as a real introduction. Low enough for dense scripts like Chinese. */
export const BIO_MIN = 40;

export type StrengthKey =
  | "headline" | "bio" | "photo" | "subjects" | "levels" | "languages" | "teachingModes" | "location"
  | "openTo" | "experience" | "credentials";

const WEIGHTS: Record<StrengthKey | "name", number> = {
  name: 10, headline: 10, bio: 15, photo: 10, subjects: 10, levels: 5, languages: 5, teachingModes: 5,
  location: 10, openTo: 5, experience: 5, credentials: 10,
};

/** Profile strength 0-100 and what would raise it, most valuable first. */
export function profileStrength(v: ProfileInput, hasPhoto: boolean): { percent: number; missing: StrengthKey[] } {
  const have: Record<StrengthKey, boolean> = {
    headline: !!v.headline,
    bio: [...(v.bio ?? "")].length >= BIO_MIN,
    photo: hasPhoto,
    subjects: v.subjects.length > 0,
    levels: v.levels.length > 0,
    languages: v.languages.length > 0,
    teachingModes: v.teachingModes.length > 0,
    location: !!v.city,
    openTo: v.openTo.length > 0,
    experience: !!v.experienceBand,
    credentials: v.credentials.length >= 1,
  };
  let score = v.displayName ? WEIGHTS.name : 0;
  const missing: StrengthKey[] = [];
  for (const k of Object.keys(have) as StrengthKey[]) {
    if (have[k]) score += WEIGHTS[k];
    else missing.push(k);
  }
  missing.sort((a, b) => WEIGHTS[b] - WEIGHTS[a]);
  return { percent: score, missing };
}

export type PublishBlocker =
  | "displayName" | "subjects" | "levels" | "languages" | "teachingModes" | "city" | "openTo" | "contact" | "waiver";

/**
 * What must be true before a profile can be shown to members. At least one contact channel is required:
 * a profile nobody can reach is of no use to the educator or the member.
 */
export function publishBlockers(v: ProfileInput, hasValidWaiver: boolean): PublishBlocker[] {
  const out: PublishBlocker[] = [];
  if (!v.displayName) out.push("displayName");
  if (v.subjects.length === 0) out.push("subjects");
  if (v.levels.length === 0) out.push("levels");
  if (v.languages.length === 0) out.push("languages");
  if (v.teachingModes.length === 0) out.push("teachingModes");
  if (!v.city) out.push("city");
  if (v.openTo.length === 0) out.push("openTo");
  if (Object.keys(v.contacts).length === 0) out.push("contact");
  if (!hasValidWaiver) out.push("waiver");
  return out;
}
