import { asc, eq } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { orderPaidEmail } from "./emails";

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
