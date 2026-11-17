import { and, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { renewalReminderEmail } from "@/lib/billing/emails";
import { sendEmail, type EmailMessage } from "@/lib/email";
import { daysUntil, dueReminder } from "./engine";

const { memberships, membershipReminders, orgMembers, organizations } = schema;

export interface ReminderReport {
  checked: number;
  sent: number;
  failed: number;
}

/**
 * Renewal reminders: 60, 30, 7 and 0 days before a membership ends, each sent at most once, and none when the
 * holder has already bought the next term. Memberships never renew by themselves, so this email is the only nudge.
 * Safe to run as often as you like (daily is enough): the (membership, day) pair is recorded after a send.
 */
export async function sendDueReminders(db: Db, now: Date = new Date(), send: (m: EmailMessage) => Promise<void> = sendEmail): Promise<ReminderReport> {
  const horizon = new Date(now.getTime() + 61 * 86_400_000);
  const candidates = await db
    .select()
    .from(memberships)
    .where(and(lte(memberships.startsAt, now), gt(memberships.endsAt, new Date(now.getTime() - 86_400_000)), lte(memberships.endsAt, horizon)));
  const report: ReminderReport = { checked: candidates.length, sent: 0, failed: 0 };
  if (candidates.length === 0) return report;

  const sentRows = await db.select().from(membershipReminders).where(inArray(membershipReminders.membershipId, candidates.map((c) => c.id)));
  for (const m of candidates) {
    // Already renewed? A later term for the same holder that begins when this one ends (or later) means yes.
    const [next] = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(and(eq(memberships.holderType, m.holderType), eq(memberships.holderId, m.holderId), gte(memberships.startsAt, m.endsAt)))
      .limit(1);
    if (next) continue;
    const due = dueReminder(m.endsAt, now, sentRows.filter((r) => r.membershipId === m.id).map((r) => r.daysBefore));
    if (due === null) continue;

    const target = await recipientFor(db, m.holderType, m.holderId);
    if (!target || target.emails.length === 0) continue;
    try {
      for (const to of target.emails) await send(renewalReminderEmail(to, { name: target.name, endsAt: m.endsAt, daysLeft: Math.max(0, daysUntil(m.endsAt, now)) }));
      // Record the whole run of skipped earlier steps too (a membership bought 20 days before the end skips 60 and 30).
      await db.insert(membershipReminders).values([60, 30, 7, 0].filter((d) => d >= due).map((d) => ({ membershipId: m.id, daysBefore: d }))).onConflictDoNothing();
      report.sent += 1;
    } catch {
      // Leave it unrecorded so the next run tries again.
      report.failed += 1;
    }
  }
  return report;
}

async function recipientFor(db: Db, holderType: "org" | "user", holderId: string): Promise<{ name: string; emails: string[] } | null> {
  if (holderType === "user") {
    const [u] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, holderId)).limit(1);
    return u ? { name: "LearningLinks", emails: [u.email] } : null;
  }
  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, holderId)).limit(1);
  if (!org) return null;
  const owners = await db
    .select({ email: schema.user.email })
    .from(orgMembers)
    .innerJoin(schema.user, eq(orgMembers.userId, schema.user.id))
    .where(and(eq(orgMembers.organizationId, holderId), eq(orgMembers.role, "owner")));
  return { name: org.name, emails: [...new Set(owners.map((o) => o.email))] };
}
