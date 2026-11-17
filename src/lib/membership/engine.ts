/**
 * Membership term logic. Pure functions only.
 * Rules: every purchase buys one 12-month term. Terms never renew by themselves.
 * Buying early stacks the new term after the current one, so nobody loses days by renewing early.
 */

export interface Term {
  startsAt: Date;
  endsAt: Date;
}

/** Add calendar months in UTC, clamping to the last day of the month (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

export function latestEnd(terms: readonly Term[]): Date | null {
  return terms.reduce<Date | null>((acc, t) => (!acc || t.endsAt > acc ? t.endsAt : acc), null);
}

/** The next term starts now, or when the latest existing term ends if that is later. */
export function computeNextTerm(existing: readonly Term[], now: Date, months = 12): Term {
  const end = latestEnd(existing);
  const startsAt = end && end > now ? end : now;
  return { startsAt, endsAt: addMonthsUtc(startsAt, months) };
}

/** A membership is active when some term satisfies startsAt <= at < endsAt. */
export function isActiveAt(terms: readonly Term[], at: Date): boolean {
  return terms.some((t) => t.startsAt <= at && at < t.endsAt);
}

/** The term covering `at`, if any. */
export function activeTerm(terms: readonly Term[], at: Date): Term | null {
  return terms.find((t) => t.startsAt <= at && at < t.endsAt) ?? null;
}

export const REMINDER_DAYS_BEFORE = [60, 30, 7, 0] as const;

/** Whole days from `now` until `endsAt` (negative once expired). */
export function daysUntil(endsAt: Date, now: Date): number {
  return Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000);
}

/**
 * Which reminder (60/30/7/0 days before expiry) is due now and not yet sent.
 * Returns the most urgent unsent reminder whose time has come, or null.
 * Renewal is never automatic: reminders only invite the member to renew.
 */
export function dueReminder(endsAt: Date, now: Date, alreadySent: readonly number[]): number | null {
  const left = daysUntil(endsAt, now);
  if (left < 0) return null;
  const due = REMINDER_DAYS_BEFORE.filter((d) => left <= d && !alreadySent.includes(d));
  if (due.length === 0) return null;
  // Send only the most urgent one; mark skipped earlier ones as sent by the caller if desired.
  return Math.min(...due);
}
