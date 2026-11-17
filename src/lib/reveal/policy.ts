export type RevealDenied = "no_membership" | "daily_cap" | "unavailable";
export type RevealDecision = { allowed: true; countsTowardCap: boolean } | { allowed: false; reason: RevealDenied };

export interface RevealContext {
  hasActiveMembership: boolean;
  /** The educator's profile is published and not suspended/hidden. */
  educatorAvailable: boolean;
  /** This organisation already revealed THIS educator today (re-viewing does not use more cap). */
  alreadyRevealedToday: boolean;
  /** Distinct educators this organisation revealed today. */
  distinctRevealedToday: number;
  dailyCap: number;
}

/**
 * Decides whether a contact reveal is allowed. The cap protects the database from bulk harvesting:
 * one flat annual fee must not become a licence to copy every educator's contact details.
 */
export function decideReveal(c: RevealContext): RevealDecision {
  if (!c.educatorAvailable) return { allowed: false, reason: "unavailable" };
  if (!c.hasActiveMembership) return { allowed: false, reason: "no_membership" };
  if (c.alreadyRevealedToday) return { allowed: true, countsTowardCap: false };
  if (c.distinctRevealedToday >= c.dailyCap) return { allowed: false, reason: "daily_cap" };
  return { allowed: true, countsTowardCap: true };
}
