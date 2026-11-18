import { createHash, timingSafeEqual } from "node:crypto";

/**
 * ECPay (綠界) all-in-one checkout, "AioCheckOut V5". Pure functions only: no database, no network. Written from
 * ECPay's published specification (developers.ecpay.com.tw: 產生訂單, 付款結果通知, 檢查碼機制說明) and checked
 * against the examples printed there (see tests/ecpay.test.ts).
 *
 * How it works: the browser posts a signed form to ECPay's page, the buyer pays there (we never see card numbers),
 * and ECPay tells our server the result with a signed server-to-server POST (ReturnURL). Everything that arrives
 * from ECPay is believed only after its CheckMacValue checks out.
 */

export interface EcpayConfig {
  merchantId: string;
  hashKey: string;
  hashIV: string;
  mode: "stage" | "production";
  /** Payment methods to offer, e.g. ["Credit", "ATM", "CVS"]. The buyer picks one on our order page. */
  methods: EcpayMethod[];
}

/**
 * The methods this site supports: card, ATM virtual account and convenience-store code. ECPay keeps adding payment
 * methods and advises naming ONE method per order (ChoosePayment) instead of "ALL", so the buyer picks on our page
 * and each trip to ECPay asks for exactly that method.
 */
export const ECPAY_METHODS = ["Credit", "ATM", "CVS"] as const;
export type EcpayMethod = (typeof ECPAY_METHODS)[number];

export const CHECKOUT_URL = {
  stage: "https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5",
  production: "https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5",
} as const;

export const checkoutHost = (mode: EcpayConfig["mode"]) => new URL(CHECKOUT_URL[mode]).origin;

/* ---------------- CheckMacValue ---------------- */

/**
 * ECPay's URL encoding ("the .NET encoding" in their table): everything percent-encoded in lowercase except
 * A-Z a-z 0-9 - _ . ! * ( ), a space is "+", and ~ and ' are encoded.
 */
export function ecpayUrlEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/%20/g, "+")
    .replace(/~/g, "%7e")
    .replace(/'/g, "%27")
    .toLowerCase();
}

const byNameIgnoringCase = (a: string, b: string) => {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x < y ? -1 : x > y ? 1 : 0;
};

/** SHA-256 CheckMacValue over every parameter except CheckMacValue itself, as ECPay specifies (upper-case hex). */
export function computeCheckMacValue(params: Record<string, string>, hashKey: string, hashIV: string): string {
  const pairs = Object.keys(params)
    .filter((k) => k !== "CheckMacValue")
    .sort(byNameIgnoringCase)
    .map((k) => `${k}=${params[k]}`);
  const raw = `HashKey=${hashKey}&${pairs.join("&")}&HashIV=${hashIV}`;
  return createHash("sha256").update(ecpayUrlEncode(raw)).digest("hex").toUpperCase();
}

/** Constant-time check of the CheckMacValue that came with a notification. False if it is missing or wrong. */
export function verifyCheckMacValue(params: Record<string, string>, hashKey: string, hashIV: string): boolean {
  const given = params.CheckMacValue;
  if (!given || !/^[0-9A-Fa-f]{64}$/.test(given)) return false;
  const expected = Buffer.from(computeCheckMacValue(params, hashKey, hashIV), "utf8");
  const got = Buffer.from(given.toUpperCase(), "utf8");
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/* ---------------- building the checkout ---------------- */

/** yyyy/MM/dd HH:mm:ss in Taipei time, the format ECPay wants for MerchantTradeDate. */
export function ecpayDate(d: Date): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/**
 * ECPay's MerchantTradeNo: at most 20 letters and digits, never reused. We use the order's reference code without
 * the dashes (10 characters) plus a 2-character attempt counter, so a buyer who leaves and comes back gets a fresh one.
 */
export function merchantTradeNo(referenceCode: string, attempt: number): string {
  const base = referenceCode.replace(/[^A-Za-z0-9]/g, "");
  const suffix = attempt.toString(36).toUpperCase().padStart(2, "0");
  const no = `${base}${suffix}`;
  if (no.length > 20 || !/^[A-Za-z0-9]+$/.test(no)) throw new Error("Cannot build a valid MerchantTradeNo");
  return no;
}

export interface CheckoutInput {
  tradeNo: string;
  amount: number;
  /** Shown on ECPay's page. Plain letters and digits only: ECPay asks for no special characters. */
  itemName: string;
  tradeDesc: string;
  /** Server-to-server payment result (the one that counts). Must be on port 80 or 443. */
  returnUrl: string;
  /** ATM, convenience-store and barcode payments: the notice carrying the account or code. */
  paymentInfoUrl: string;
  /** Where ECPay posts the buyer's browser after a card payment. */
  orderResultUrl: string;
  /** The "back to the shop" button. */
  clientBackUrl: string;
  locale: string;
  /** The one method this trip is for. Must be one we offer; defaults to the first. */
  method?: EcpayMethod;
  now?: Date;
}

export interface Checkout {
  action: string;
  fields: Record<string, string>;
}

const LANGUAGE = (locale: string) => (locale.startsWith("zh") ? "CHT" : "ENG");

export function buildCheckout(cfg: EcpayConfig, i: CheckoutInput): Checkout {
  if (!Number.isInteger(i.amount) || i.amount < 1) throw new Error("amount must be a whole number of New Taiwan dollars");
  const methods = cfg.methods.length > 0 ? cfg.methods : (["Credit"] as EcpayMethod[]);
  const method = i.method ?? methods[0]!;
  if (!methods.includes(method)) throw new Error(`payment method ${method} is not on offer`);
  const fields: Record<string, string> = {
    MerchantID: cfg.merchantId,
    MerchantTradeNo: i.tradeNo,
    MerchantTradeDate: ecpayDate(i.now ?? new Date()),
    PaymentType: "aio",
    TotalAmount: String(i.amount),
    TradeDesc: i.tradeDesc.slice(0, 200),
    ItemName: i.itemName.slice(0, 400),
    ReturnURL: i.returnUrl,
    PaymentInfoURL: i.paymentInfoUrl,
    OrderResultURL: i.orderResultUrl,
    ClientBackURL: i.clientBackUrl,
    // ECPay advises naming one method (they add new ones over time, and "ALL" would show those too).
    ChoosePayment: method,
    EncryptType: "1",
    Language: LANGUAGE(i.locale),
    // Handed back unchanged in every notice, so the return page can speak the buyer's language.
    CustomField1: i.locale,
  };
  fields.CheckMacValue = computeCheckMacValue(fields, cfg.hashKey, cfg.hashIV);
  return { action: CHECKOUT_URL[cfg.mode], fields };
}

/* ---------------- reading what ECPay sends ---------------- */

export interface PaymentNotice {
  merchantId: string;
  merchantTradeNo: string;
  rtnCode: number;
  rtnMsg: string;
  tradeNo: string;
  tradeAmt: number;
  paymentType: string;
  paymentDate: string | null;
  /** 1 = ECPay's "simulate payment" test button. Never treat it as money. */
  simulated: boolean;
  /** ATM virtual account and convenience-store code details, when the notice carries them. */
  info: { bankCode?: string; vAccount?: string; paymentNo?: string; expireDate?: string } | null;
  locale: string | null;
}

/** Form body ("a=1&b=2") to an object. Later duplicates win; nothing is trimmed (the signature covers exact values). */
export function parseForm(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(body)) out[k] = v;
  return out;
}

export function readNotice(p: Record<string, string>): PaymentNotice | null {
  const rtnCode = Number(p.RtnCode);
  const tradeAmt = Number(p.TradeAmt);
  if (!p.MerchantID || !p.MerchantTradeNo || !Number.isFinite(rtnCode)) return null;
  const info = p.vAccount || p.PaymentNo || p.Barcode1 ? { bankCode: p.BankCode || undefined, vAccount: p.vAccount || undefined, paymentNo: p.PaymentNo || undefined, expireDate: p.ExpireDate || undefined } : null;
  return {
    merchantId: p.MerchantID,
    merchantTradeNo: p.MerchantTradeNo,
    rtnCode,
    rtnMsg: p.RtnMsg ?? "",
    tradeNo: p.TradeNo ?? "",
    tradeAmt: Number.isFinite(tradeAmt) ? tradeAmt : -1,
    paymentType: p.PaymentType ?? "",
    paymentDate: p.PaymentDate || null,
    simulated: p.SimulatePaid === "1",
    info,
    locale: p.CustomField1 || null,
  };
}

/** The result notice reports success with RtnCode 1; ATM numbers with 2; convenience-store and barcode numbers with 10100073. */
export const isPaidCode = (code: number) => code === 1;
export const isNumberIssuedCode = (code: number) => code === 2 || code === 10100073;
