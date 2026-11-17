/** Client-safe constants (no node:crypto), shared by the waiver form and the server rules. */
export const WAIVER_REQUIRED_ITEMS = ["terms_privacy", "publish_to_members", "contact_on_request", "truthful", "notice"] as const;
export const WAIVER_OPTIONAL_ITEMS = ["marketing"] as const;
export type WaiverItem = (typeof WAIVER_REQUIRED_ITEMS)[number] | (typeof WAIVER_OPTIONAL_ITEMS)[number];
