"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { adminCancelOrder, confirmOrderPaid, OrderFailure } from "@/lib/billing/orders";
import { orderPaidEmail } from "@/lib/billing/emails";
import { getDb, schema } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { approveClaim, OrgFailure, rejectClaim } from "@/lib/orgs/service";
import { moderationNoticeEmail } from "@/lib/moderation/emails";
import { ModerationFailure, reinstate, resolveReport } from "@/lib/moderation/service";
import { eq } from "drizzle-orm";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { hasLocale } from "next-intl";

export type AdminResult = { ok: true; message: string } | { ok: false; message: string };

async function admin() {
  const u = await getCurrentUser();
  return u?.isAdmin ? u : null;
}

export async function confirmOrderAction(_prev: AdminResult | null, fd: FormData): Promise<AdminResult> {
  const a = await admin();
  if (!a) return { ok: false, message: "Not allowed" };
  const orderId = String(fd.get("orderId") ?? "");
  const amount = Number(String(fd.get("amount") ?? "").replace(/[,\s]/g, ""));
  const receivedOn = String(fd.get("receivedOn") ?? "");
  const note = String(fd.get("note") ?? "");
  if (!Number.isInteger(amount)) return { ok: false, message: "Enter the amount as a whole number" };
  try {
    const db = getDb();
    const res = await confirmOrderPaid(db, orderId, a.id, { receivedAmount: amount, receivedOn, note });
    if (res.created) {
      const [buyer] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, res.order.createdByUserId)).limit(1);
      if (buyer && res.terms.length > 0) await sendEmail(orderPaidEmail(buyer.email, { referenceCode: res.order.referenceCode, terms: res.terms })).catch((e) => console.error("paid email failed", e));
    }
    revalidatePath("/", "layout");
    // The confirmed order leaves the queue, so the form would vanish with its message: show the result as a banner.
    const loc = fd.get("locale");
    return redirect({ href: `/admin?confirmed=${encodeURIComponent(res.order.referenceCode)}${res.created ? "" : "&again=1"}`, locale: typeof loc === "string" && hasLocale(routing.locales, loc) ? loc : routing.defaultLocale });
  } catch (err) {
    if (typeof err === "object" && err !== null && "digest" in err) throw err; // the redirect above
    if (err instanceof OrderFailure) {
      const m: Record<string, string> = {
        amount_mismatch: "The amount does not match the order total. Check the bank statement; a short payment is not confirmed.",
        invalid_date: "Enter the date from the bank statement as YYYY-MM-DD.",
        not_found: "Order not found.",
        not_pending: "That order is not waiting for payment.",
      };
      return { ok: false, message: m[err.code] ?? err.code };
    }
    console.error("confirm failed", err);
    return { ok: false, message: "Something went wrong. Nothing was changed." };
  }
}

export async function cancelOrderAsAdminAction(fd: FormData): Promise<void> {
  const a = await admin();
  const id = fd.get("orderId");
  if (!a || typeof id !== "string") return;
  try {
    await adminCancelOrder(getDb(), id, a.id);
  } catch (err) {
    if (!(err instanceof OrderFailure)) console.error("admin cancel failed", err);
  }
  revalidatePath("/", "layout");
}

export async function reviewClaimAction(fd: FormData): Promise<void> {
  const a = await admin();
  const id = fd.get("claimId");
  const decision = fd.get("decision");
  if (!a || typeof id !== "string") return;
  try {
    if (decision === "approve") await approveClaim(getDb(), id, a.id);
    else if (decision === "reject") await rejectClaim(getDb(), id, a.id);
  } catch (err) {
    if (!(err instanceof OrgFailure)) console.error("claim review failed", err);
  }
  revalidatePath("/", "layout");
}

export async function reviewReportAction(fd: FormData): Promise<void> {
  const a = await admin();
  const id = fd.get("reportId");
  const decision = fd.get("decision");
  if (!a || typeof id !== "string" || (decision !== "action" && decision !== "dismiss")) return;
  try {
    const res = await resolveReport(getDb(), id, a.id, decision);
    if (res.notify) {
      for (const to of res.notify.emails) await sendEmail(moderationNoticeEmail(to, { what: res.notify.what, name: res.notify.name })).catch((e) => console.error("moderation email failed", e));
    }
  } catch (err) {
    if (!(err instanceof ModerationFailure)) console.error("report review failed", err);
  }
  revalidatePath("/", "layout");
}

export async function reinstateAction(fd: FormData): Promise<void> {
  const a = await admin();
  const id = fd.get("id");
  const type = fd.get("type");
  if (!a || typeof id !== "string" || (type !== "educator" && type !== "organization")) return;
  try {
    await reinstate(getDb(), type, id, a.id);
  } catch (err) {
    if (!(err instanceof ModerationFailure)) console.error("reinstate failed", err);
  }
  revalidatePath("/", "layout");
}
