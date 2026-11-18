import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { sendPaidEmail } from "@/lib/billing/paid-email";
import { getEcpayConfig } from "./config";
import { parseForm } from "./ecpay";
import { handleEcpayNotice } from "./service";

const MAX_BODY = 20_000;

/** Shared by the two server-to-server endpoints: ReturnURL (result) and PaymentInfoURL (ATM / store number). */
export async function ecpayServerNotice(req: Request, kind: "result" | "info"): Promise<Response> {
  const cfg = getEcpayConfig();
  if (!cfg) return new NextResponse(null, { status: 404 });
  const body = await req.text();
  if (body.length > MAX_BODY) return new NextResponse("0|Too large", { status: 413 });
  const db = getDb();
  const res = await handleEcpayNotice(db, cfg, kind, parseForm(body));
  if (res.newlyPaid && res.orderId) await sendPaidEmail(db, res.orderId);
  // ECPay needs exactly "1|OK" as plain text to stop retrying.
  return new Response(res.body, { status: res.status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
