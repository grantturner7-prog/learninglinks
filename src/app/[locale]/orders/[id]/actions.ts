"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { cancelOwnOrder, OrderFailure } from "@/lib/billing/orders";
import { getDb } from "@/lib/db";
import { getEcpayConfig } from "@/lib/payments/config";
import { PaymentFailure, startOnlinePayment } from "@/lib/payments/service";
import { allow } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site-url";
import { routing } from "@/i18n/routing";
import { hasLocale } from "next-intl";

export async function cancelOrderAction(fd: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = fd.get("orderId");
  if (!user || typeof id !== "string") return;
  try {
    await cancelOwnOrder(getDb(), user.id, id);
  } catch (err) {
    if (!(err instanceof OrderFailure)) console.error("cancel order failed", err);
  }
  revalidatePath("/", "layout");
}

export type PayNowResult = { ok: true; action: string; fields: Record<string, string> } | { ok: false; error: "signin" | "unavailable" | "not_pending" | "rate" | "server" };

/** "Pay now": a fresh signed form for ECPay's page. Only the buyer, only while the order is unpaid. */
export async function startOnlinePaymentAction(orderId: string, localeRaw: string, methodRaw?: string): Promise<PayNowResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "signin" };
  const cfg = getEcpayConfig();
  if (!cfg) return { ok: false, error: "unavailable" };
  if (!allow(`pay:${user.id}`, 20, 60 * 60_000)) return { ok: false, error: "rate" };
  const locale = hasLocale(routing.locales, localeRaw) ? localeRaw : routing.defaultLocale;
  const method = cfg.methods.find((m) => m === methodRaw) ?? cfg.methods[0];
  try {
    const c = await startOnlinePayment(getDb(), cfg, user.id, orderId, { appUrl: siteUrl(), locale }, new Date(), method);
    return { ok: true, action: c.action, fields: c.fields };
  } catch (err) {
    if (err instanceof PaymentFailure) return { ok: false, error: err.code === "not_pending" ? "not_pending" : "unavailable" };
    console.error("start online payment failed", err);
    return { ok: false, error: "server" };
  }
}
