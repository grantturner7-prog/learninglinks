/** Client-safe report vocabulary. The wording lives in the report.json message files under `reasons`. */
export const REPORT_TARGETS = ["educator", "organization", "job"] as const;
export type ReportTargetType = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = ["misleading", "abusive", "payment_or_documents", "discriminatory", "substitute_work", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** "Substitute or cover work" only makes sense for a job post. */
export const reasonsFor = (t: ReportTargetType): ReportReason[] => REPORT_REASONS.filter((r) => r !== "substitute_work" || t === "job");

export const REPORT_DETAILS_MAX = 500;
/** A person may send this many reports in 24 hours. */
export const MAX_REPORTS_PER_DAY = 10;
