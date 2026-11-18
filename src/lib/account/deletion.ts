import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";

const { orders, orgMembers, organizations, jobs, auditLog } = schema;

/**
 * Runs just before a school or family account is deleted (the account, its memberships in campuses, its claims,
 * its reports and its contact requests go with it through the database's cascades). What must NOT silently vanish
 * or dangle is handled here:
 *  - unpaid orders are cancelled, so nobody is left waiting on a transfer for an account that no longer exists;
 *  - the personal invoice email is erased from every order the person placed. The company name and 統一編號 stay on
 *    paid orders because orders are business and tax records (the order itself loses its link to the person);
 *  - a campus left with no members at all goes back to "unclaimed", loses the contact details its owner gave us and
 *    has its open job posts closed, so it can be claimed again by someone else. Its paid membership is untouched.
 * Everything runs in one transaction, and an audit-log line records that it happened (by internal id only).
 */
export async function prepareAccountDeletion(db: Db, userId: string, now: Date = new Date()): Promise<{ cancelledOrders: number; releasedCampuses: number }> {
  return db.transaction(async (tx) => {
    const cancelled = await tx
      .update(orders)
      .set({ status: "cancelled", cancelledAt: now })
      .where(and(eq(orders.createdByUserId, userId), eq(orders.status, "pending")))
      .returning({ id: orders.id });
    await tx.update(orders).set({ invoiceEmail: null }).where(eq(orders.createdByUserId, userId));

    const mine = await tx.select({ id: orgMembers.organizationId }).from(orgMembers).where(eq(orgMembers.userId, userId));
    let released = 0;
    for (const { id } of mine) {
      const [{ others } = { others: 0 }] = await tx
        .select({ others: sql<number>`count(*)::int` })
        .from(orgMembers)
        .where(and(eq(orgMembers.organizationId, id), sql`${orgMembers.userId} <> ${userId}`));
      if (others === 0) {
        await tx.update(organizations).set({ status: "unclaimed", claimedAt: null, contactEmail: null, contactPhone: null }).where(and(eq(organizations.id, id), eq(organizations.status, "claimed")));
        await tx.update(jobs).set({ status: "closed" }).where(and(eq(jobs.organizationId, id), eq(jobs.status, "open")));
        released += 1;
      }
    }
    await tx.insert(auditLog).values({ actorUserId: null, action: "account.deleted", entityType: "user", entityId: userId, meta: { cancelledOrders: cancelled.length, releasedCampuses: released } });
    return { cancelledOrders: cancelled.length, releasedCampuses: released };
  });
}
