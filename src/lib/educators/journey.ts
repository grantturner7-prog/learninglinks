import type { PublishBlocker } from "./completeness";
import type { FieldErrors, ProfileInput } from "./profile-input";

/** The guided profile flow: one question at a time. Step numbers are shown to educators ("Step 4 of 9"). */
export const STEP_COUNT = 9;
export const STEPS = ["name", "about", "teaching", "subjects", "where", "work", "proof", "reach", "publish"] as const;
export type StepName = (typeof STEPS)[number];

/** Which step a form field belongs to, so a server error can send the educator to the right question. */
export function stepForField(field: string): number {
  if (field === "displayName") return 1;
  if (field === "headline" || field === "bio") return 2;
  if (field === "languages" || field === "teachingModes" || field === "experienceBand") return 3;
  if (field === "subjects") return 4;
  if (field === "levels" || field === "city" || field === "districts") return 5;
  if (field === "openTo" || field === "rateMin" || field === "rateMax" || field === "workAuthorization") return 6;
  if (/^cred(Label|Year|Url)_\d+$/.test(field)) return 7;
  if (field.startsWith("contact_")) return 8;
  return 9;
}

/** The earliest step that has an error (1 when there are none). */
export function earliestErrorStep(errors: FieldErrors): number {
  const steps = Object.keys(errors).map(stepForField);
  return steps.length > 0 ? Math.min(...steps) : 1;
}

const BLOCKER_STEP: Record<PublishBlocker, number> = {
  displayName: 1, languages: 3, teachingModes: 3, subjects: 4, levels: 5, city: 5, openTo: 6, contact: 8, waiver: 9,
};
export const stepForBlocker = (b: PublishBlocker): number => BLOCKER_STEP[b];

/** Where to resume: the first question that still needs an answer, or the last step when everything is filled in. */
export function firstIncompleteStep(input: ProfileInput, hasProfile: boolean): number {
  if (!hasProfile || !input.displayName) return 1;
  if (input.languages.length === 0 || input.teachingModes.length === 0) return 3;
  if (input.subjects.length === 0) return 4;
  if (input.levels.length === 0 || !input.city) return 5;
  if (input.openTo.length === 0) return 6;
  if (Object.keys(input.contacts).length === 0) return 8;
  return 9;
}

export function parseStep(raw: string | string[] | undefined): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= STEP_COUNT ? n : null;
}
