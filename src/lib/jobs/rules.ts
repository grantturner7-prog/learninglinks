/** Client-safe job rules: no database, geography or scanner imports, so the browser bundle stays small. */
export const JOB_LIMITS = { title: 100, description: 2000, applyContact: 200, subjects: 6, levels: 4, salaryMax: 1_000_000 } as const;
/** An organisation can have this many open posts at once. */
export const MAX_OPEN_JOBS_PER_ORG = 20;

/**
 * Posts are full-time or part-time jobs only. Substitute and cover work was removed on purpose (17 Nov 2026), so a
 * post that offers it is rejected, in English and Chinese. This is a guard rail, not a lawyer: wording can always be
 * got around, and reports plus admin removal cover the rest.
 */
const SUBSTITUTE = /\b(?:substitute|relief|supply|cover)\s+(?:teach\w*|work|shifts?|staff|cover)\b|\bsubstitutes?\b|\bday[- ]to[- ]day\s+cover\b|\bshort[- ]term\s+cover\b|代課|代打|臨時代|代理教師|代理老師|代班/i;
export const looksLikeSubstituteWork = (s: string): boolean => SUBSTITUTE.test(s);

