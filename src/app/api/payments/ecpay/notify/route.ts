import { ecpayServerNotice } from "@/lib/payments/route";

export const dynamic = "force-dynamic";

/** ECPay's ReturnURL: the payment result, server to server. This is the notice that counts. */
export async function POST(req: Request) {
  return ecpayServerNotice(req, "result");
}
