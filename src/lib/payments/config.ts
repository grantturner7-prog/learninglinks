import { getBankDetails } from "@/lib/billing/bank";
import { getEnv } from "@/lib/env";
import { ECPAY_METHODS, type EcpayConfig, type EcpayMethod } from "./ecpay";

/** ECPay settings from the environment, or null while online payment is switched off (any of the three secrets missing). */
export function getEcpayConfig(): EcpayConfig | null {
  const env = getEnv();
  if (!env.ECPAY_MERCHANT_ID || !env.ECPAY_HASH_KEY || !env.ECPAY_HASH_IV) return null;
  const methods = env.ECPAY_METHODS.split(",").map((m) => m.trim()).filter((m): m is EcpayMethod => (ECPAY_METHODS as readonly string[]).includes(m));
  return { merchantId: env.ECPAY_MERCHANT_ID, hashKey: env.ECPAY_HASH_KEY, hashIV: env.ECPAY_HASH_IV, mode: env.ECPAY_MODE, methods: methods.length > 0 ? methods : ["Credit"] };
}

export const onlinePaymentEnabled = () => getEcpayConfig() !== null;

export type PaymentMethod = "ecpay" | "bank_transfer";

/**
 * The ways a buyer can pay right now, best first. Online is offered whenever ECPay is configured. Bank transfer is
 * offered whenever the bank details are set, and also when online payment is off (the order page then explains that
 * the account details are still to come). So with ECPay on and no bank details yet, buyers simply pay online.
 */
export function paymentMethods(): PaymentMethod[] {
  const online = onlinePaymentEnabled();
  const out: PaymentMethod[] = [];
  if (online) out.push("ecpay");
  if (!online || getBankDetails() !== null) out.push("bank_transfer");
  return out;
}

/** What the buyer asked for, if it is on offer; otherwise the first way on offer. */
export function chooseMethod(asked: unknown): PaymentMethod {
  const on = paymentMethods();
  return on.find((m) => m === asked) ?? on[0]!;
}

/** Where ECPay's checkout page lives for the current mode: the CSP must let our form post there. */
export function onlineCheckoutOrigin(): string | null {
  const c = getEcpayConfig();
  return c ? (c.mode === "production" ? "https://payment.ecpay.com.tw" : "https://payment-stage.ecpay.com.tw") : null;
}
