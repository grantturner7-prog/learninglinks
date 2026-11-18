import { ecpayServerNotice } from "@/lib/payments/route";

export const dynamic = "force-dynamic";

/** ECPay's PaymentInfoURL: the ATM virtual account or convenience-store code, once the buyer has chosen one. */
export async function POST(req: Request) {
  return ecpayServerNotice(req, "info");
}
