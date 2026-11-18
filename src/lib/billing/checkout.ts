import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { NOTICE_VERSION } from "@/lib/notice";
import { orderPlacedEmail } from "./emails";
import type { InvoiceInput } from "./orders";

/** What the checkout flows send from the browser. Plain data only. */
export interface CheckoutPayload {
  invoice: { company: boolean; taxId: string; title: string; email: string };
  /** The compliance acknowledgement checkbox. Checkout is refused without it. */
  acknowledged: boolean;
  /** "ecpay" is honoured only while online payment is switched on. */
  method?: "bank_transfer" | "ecpay";
}

export function invoiceFrom(p: CheckoutPayload["invoice"]): InvoiceInput {
  return p.company ? { taxId: p.taxId, title: p.title, email: p.email } : { email: p.email };
}

/** Record that the buyer acknowledged the notice at checkout, and email the order details. Neither may fail the order. */
export async function afterOrderPlaced(db: Db, user: { id: string; email: string }, order: { id: string; referenceCode: string; amount: number; currency: string; campuses: number; provider?: string }): Promise<void> {
  try {
    await db.insert(schema.auditLog).values({ actorUserId: user.id, action: "checkout.notice_acknowledged", entityType: "order", entityId: order.id, meta: { noticeVersion: NOTICE_VERSION } });
  } catch (err) {
    console.error("audit failed", err);
  }
  try {
    await sendEmail(orderPlacedEmail(user.email, order));
  } catch (err) {
    console.error("order email failed", err);
  }
}
