import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getEcpayConfig } from "@/lib/payments/config";
import { parseForm } from "@/lib/payments/ecpay";
import { findOrderForReturn } from "@/lib/payments/service";
import { siteUrl } from "@/lib/site-url";
import { routing } from "@/i18n/routing";

export const dynamic = "force-dynamic";

/**
 * ECPay's OrderResultURL: the buyer's browser is posted here after a card payment. It only finds the order and sends
 * the buyer on to its page (a normal GET, so their sign-in cookie comes with it). It changes nothing: the payment
 * itself is settled by the server notice.
 */
export async function POST(req: Request) {
  const cfg = getEcpayConfig();
  if (!cfg) return new NextResponse(null, { status: 404 });
  const body = await req.text();
  const base = siteUrl();
  const found = body.length <= 20_000 ? await findOrderForReturn(getDb(), cfg, parseForm(body)) : null;
  const locale = found?.locale && (routing.locales as readonly string[]).includes(found.locale) ? found.locale : routing.defaultLocale;
  const to = found ? `${base}/${locale}/orders/${found.orderId}?from=ecpay` : `${base}/${locale}/dashboard`;
  return NextResponse.redirect(to, 303);
}
