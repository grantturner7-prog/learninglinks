import { asc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { orderPaidEmail, refundEmail } from "./emails";
import type { RefundResult } from "./refunds";

/** Tell the buyer their payment is confirmed. Never throws: a failed email must not undo a settled payment. */
export async function sendPaidEmail(db: Db, orderId: string): Promise<void> {
  try {
    const [row] = await db
      .select({ ref: schema.orders.referenceCode, email: schema.user.email })
      .from(schema.orders)
      .leftJoin(schema.user, eq(schema.user.id, schema.orders.createdByUserId))
      .where(eq(schema.orders.id, orderId))
      .limit(1);
    const terms = await db.select({ endsAt: schema.memberships.endsAt }).from(schema.memberships).where(eq(schema.memberships.orderId, orderId)).orderBy(asc(schema.memberships.endsAt));
    if (row?.email && terms.length > 0) await sendEmail(orderPaidEmail(row.email, { referenceCode: row.ref, terms }));
  } catch (err) {
    console.error("paid email failed", err);
  }
}

/**
 * Tell the buyer a refund was recorded and/or memberships were ended. Never throws: the record is already made.
 * Says what happened ("none" = nobody to email, e.g. the buyer deleted their account) so the admin screen never claims
 * an email went out when it did not.
 */
export async function sendRefundEmail(db: Db, result: RefundResult, endedOn: Date): Promise<"sent" | "failed" | "none"> {
  try {
    if (result.refunded === 0 && result.ended.length === 0) return "none";
    const [row] = await db
      .select({ email: schema.user.email, currency: schema.orders.currency, plan: schema.orders.planCode })
      .from(schema.orders)
      .leftJoin(schema.user, eq(schema.user.id, schema.orders.createdByUserId))
      .where(eq(schema.orders.id, result.orderId))
      .limit(1);
    if (!row?.email) return "none";
    const orgIds = result.ended.filter((e) => e.holderType === "org").map((e) => e.holderId);
    const names = orgIds.length === 0 ? [] : (await db.select({ id: schema.organizations.id, name: schema.organizations.name }).from(schema.organizations).where(inArray(schema.organizations.id, orgIds))).map((o) => o.name);
    await sendEmail(refundEmail(row.email, { referenceCode: result.referenceCode, amount: result.refunded, currency: row.currency, endedNames: names, endedOn: result.ended.length > 0 ? endedOn : null, isSchool: row.plan === "school_tw" }));
    return "sent";
  } catch (err) {
    console.error("refund email failed", err);
    return "failed";
  }
}
