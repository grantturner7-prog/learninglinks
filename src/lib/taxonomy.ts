/** Controlled vocabularies. Stable keys are stored; labels live in messages/*.json under `taxonomy`. */

export const SUBJECTS = [
  "english-conversation", "phonics", "grammar", "reading-comprehension", "creative-writing",
  "public-speaking-debate", "test-prep-english", "mandarin", "mathematics", "science",
  "social-studies", "history", "geography", "art", "music", "physical-education",
  "computer-science-coding", "stem-robotics", "drama-theater", "literature", "business-economics",
  "exam-prep-taiwan",
] as const;
export type Subject = (typeof SUBJECTS)[number];

export const LEVELS = [
  "kindergarten", "elementary-lower", "elementary-upper", "junior-high", "senior-high", "university", "adult",
] as const;
export type Level = (typeof LEVELS)[number];

export const TEACHING_MODES = ["in_person", "online"] as const;
export type TeachingMode = (typeof TEACHING_MODES)[number];

/** What kind of work the educator is open to. */
export const OPEN_TO = ["full_time", "part_time", "substitute", "private_tutoring"] as const;
export type OpenTo = (typeof OPEN_TO)[number];

/**
 * Work authorization is a CATEGORY the educator self-declares. We never collect permit or ID numbers.
 * It is shown to hirers with a "self-declared" label.
 */
export const WORK_AUTHORIZATION = [
  "citizen_or_pr",
  "open_work_rights",
  "employer_sponsored",
  "overseas_needs_sponsorship",
  "online_from_abroad",
] as const;
export type WorkAuthorization = (typeof WORK_AUTHORIZATION)[number];

export const SCHOOL_TYPES = [
  "kindergarten", "elementary", "junior_high", "senior_high", "university",
  "cram_school", "language_school", "international_school", "other",
] as const;
export type SchoolType = (typeof SCHOOL_TYPES)[number];

export const LANGUAGES = ["en", "zh", "ja", "ko", "th", "vi", "es", "fr", "de", "other"] as const;
export type TeachingLanguage = (typeof LANGUAGES)[number];

export const EXPERIENCE_BANDS = ["0-1", "2-4", "5-9", "10+"] as const;

export function isOneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}
