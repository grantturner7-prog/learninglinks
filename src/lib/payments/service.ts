import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { confirmOrderPaid, OrderFailure } from "@/lib/billing/orders";
import { PLANS, type PlanCode } from "@/lib/plans";
import { buildCheckout, isNumberIssuedCode, isPaidCode, merchantTradeNo, readNotice, verifyCheckMacValue, type Checkout, type EcpayConfig, type EcpayMethod, type PaymentNotice } from "./ecpay";

const { orders, orderItems, paymentAttempts, paymentEvents } = schema;

export type PaymentError = "not_found" | "not_pending" | "not_online" | "too_many_attempts";

export class PaymentFailure extends Error {
  constructor(public code: PaymentError) {
    super(code);
  }
}

/** A buyer who keeps pressing "Pay now" gets a new ECPay order each time; this stops a runaway loop. */
const MAX_ATTEMPTS_PER_ORDER = 20;

export interface StartUrls {
  appUrl: string;
  locale: string;
}

const itemNameFor = (planCode: string, campuses: number) => {
  const plan = PLANS[planCode as PlanCode];
  return plan?.audience === "school" ? `LearningLinks school membership 12 months x ${campuses} campus${campuses === 1 ? "" : "es"}` : "LearningLinks family membership 12 months";
};

/**
 * The buyer pressed "Pay now" on an unpaid online order. Creates a fresh attempt (ECPay never accepts the same trade
 * number twice) and returns the signed form for the browser to post to ECPay. Only the person who placed the order can
 * do this, and only while it is unpaid.
 */
export async function startOnlinePayment(db: Db, cfg: EcpayConfig, userId: string, orderId: string, urls: StartUrls, now: Date = new Date(), method?: EcpayMethod): Promise<Checkout> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) throw new PaymentFailure("not_found");
  const base = urls.appUrl.replace(/\/$/, "");
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.createdByUserId, userId))).for("update").limit(1);
    if (!order) throw new PaymentFailure("not_found");
    if (order.provider !== "ecpay") throw new PaymentFailure("not_online");
    if (order.status !== "pending") throw new PaymentFailure("not_pending");
    const [{ n } = { n: 0 }] = await tx.select({ n: sql<number>`count(*)::int` }).from(paymentAttempts).where(eq(paymentAttempts.orderId, order.id));
    if (n >= MAX_ATTEMPTS_PER_ORDER) throw new PaymentFailure("too_many_attempts");
    const tradeNo = merchantTradeNo(order.referenceCode, n + 1);
    await tx.insert(paymentAttempts).values({ orderId: order.id, provider: "ecpay", merchantTradeNo: tradeNo, amount: order.amount });
    return buildCheckout(cfg, {
      tradeNo,
      amount: order.amount,
      itemName: itemNameFor(order.planCode, order.campuses),
      tradeDesc: "LearningLinks membership",
      returnUrl: `${base}/api/payments/ecpay/notify`,
      paymentInfoUrl: `${base}/api/payments/ecpay/info`,
      orderResultUrl: `${base}/api/payments/ecpay/return`,
      clientBackUrl: `${base}/${urls.locale}/orders/${order.id}`,
      locale: urls.locale,
      method,
      now,
    });
  });
}

export interface NoticeResult {
  /** HTTP status for ECPay: 200 with "1|OK" when we have the notice (whatever we decided), 400 when it is not genuine. */
  status: 200 | 400;
  body: string;
  outcome: schema.PaymentOutcome;
  orderId: string | null;
  /** True only when this notice is the one that made the order paid (send the "payment confirmed" email once). */
  newlyPaid: boolean;
  locale: string | null;
}

const OK = "1|OK";
const BAD = "0|CheckMacValue Error";

const taipeiDay = (d: Date) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Taipei" }).format(d);
const day = (paymentDate: string | null, fallback: Date) => (paymentDate && /^\d{4}\/\d{2}\/\d{2}/.test(paymentDate) ? paymentDate.slice(0, 10).replace(/\//g, "-") : taipeiDay(fallback));

/**
 * The only fields of an ECPay notice we keep. Anything else ECPay may add (for example the first six and last four
 * digits of a card) is dropped on purpose: this site stores no card or bank-account data. Only the NAMES of dropped
 * fields are kept, so a developer can see that something was left out.
 */
const KEEP = new Set(["MerchantID", "MerchantTradeNo", "StoreID", "RtnCode", "RtnMsg", "TradeNo", "TradeAmt", "PaymentDate", "PaymentType", "PaymentTypeChargeFee", "TradeDate", "SimulatePaid", "CustomField1", "CustomField2", "CustomField3", "CustomField4", "CheckMacValue", "BankCode", "vAccount", "ExpireDate", "PaymentNo", "Barcode1", "Barcode2", "Barcode3"]);

export function storablePayload(params: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (KEEP.has(k)) out[k] = v.slice(0, 500);
    else dropped.push(k.slice(0, 40));
  }
  if (dropped.length > 0) out._droppedFields = dropped.slice(0, 30).join(",");
  return out;
}

async function record(db: Db, kind: "result" | "info" | "return", params: Record<string, string>, outcome: schema.PaymentOutcome, valid: boolean, note: string | null, simulated = false, now = new Date()) {
  // The signature is kept in the record (it is not a secret); nothing else is altered or dropped.
  await db.insert(paymentEvents).values({ kind, merchantTradeNo: params.MerchantTradeNo?.slice(0, 40) ?? null, valid, simulated, outcome, note, payload: storablePayload(params), receivedAt: now });
}

/**
 * ECPay tells us something: the payment result (ReturnURL), or the ATM / convenience-store number (PaymentInfoURL).
 * Rules, in order:
 *  1. The signature must be right and the merchant id ours, or nothing happens (400, recorded as invalid).
 *  2. ECPay's "simulate payment" button (SimulatePaid=1) is recorded and ignored: it is not money.
 *  3. Only RtnCode 1 is a payment. The amount ECPay reports must equal the order total, or the order is NOT settled
 *     and the notice is flagged for an admin.
 *  4. Settling goes through confirmOrderPaid, so it is the same audited, all-or-nothing step an admin uses, and a
 *     repeated notice (ECPay retries until we answer 1|OK) changes nothing.
 *  5. A second payment for an order that is already paid is flagged for a refund, never silently absorbed.
 */
export async function handleEcpayNotice(db: Db, cfg: EcpayConfig, kind: "result" | "info", params: Record<string, string>, now: Date = new Date()): Promise<NoticeResult> {
  const reject = async (note: string): Promise<NoticeResult> => {
    await record(db, kind, params, "invalid", false, note, false, now);
    return { status: 400, body: BAD, outcome: "invalid", orderId: null, newlyPaid: false, locale: null };
  };
  if (!verifyCheckMacValue(params, cfg.hashKey, cfg.hashIV)) return reject("bad signature");
  const n = readNotice(params);
  if (!n || n.merchantId !== cfg.merchantId) return reject("wrong or missing merchant id");

  const [attempt] = await db.select().from(paymentAttempts).where(eq(paymentAttempts.merchantTradeNo, n.merchantTradeNo)).limit(1);
  const done = async (outcome: schema.PaymentOutcome, note: string | null, extra: Partial<NoticeResult> = {}): Promise<NoticeResult> => {
    await record(db, kind, params, outcome, true, note, n.simulated, now);
    return { status: 200, body: OK, outcome, orderId: attempt?.orderId ?? null, newlyPaid: false, locale: n.locale, ...extra };
  };
  if (!attempt) return done("needs_review", "unknown trade number (no such attempt)");
  if (n.simulated) return done("ignored", "simulated payment from the ECPay test button: not money");

  if (kind === "info") {
    if (!isNumberIssuedCode(n.rtnCode)) return done("applied", `number not issued: ${n.rtnCode} ${n.rtnMsg}`.slice(0, 200), await failAttempt(db, attempt, n, now));
    if (attempt.status !== "paid") await db.update(paymentAttempts).set({ status: "awaiting", providerTradeNo: n.tradeNo || attempt.providerTradeNo, paymentType: n.paymentType || attempt.paymentType, rtnCode: n.rtnCode, rtnMsg: n.rtnMsg.slice(0, 200), paymentInfo: n.info ?? attempt.paymentInfo, updatedAt: now }).where(eq(paymentAttempts.id, attempt.id));
    return done("applied", "payment number issued");
  }

  if (!isPaidCode(n.rtnCode)) {
    if (attempt.status !== "paid") await db.update(paymentAttempts).set({ status: "failed", providerTradeNo: n.tradeNo || attempt.providerTradeNo, paymentType: n.paymentType || attempt.paymentType, rtnCode: n.rtnCode, rtnMsg: n.rtnMsg.slice(0, 200), updatedAt: now }).where(eq(paymentAttempts.id, attempt.id));
    return done("applied", `not paid: ${n.rtnCode} ${n.rtnMsg}`.slice(0, 200));
  }

  // ECPay repeats a notice until we answer 1|OK, so two copies can arrive together. They queue on this lock, and the
  // second one finds the attempt already settled.
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ecpay:${n.merchantTradeNo}`}))`);
    const [fresh] = await tx.select().from(paymentAttempts).where(eq(paymentAttempts.id, attempt.id)).limit(1);
    const [order] = await tx.select().from(orders).where(eq(orders.id, attempt.orderId)).limit(1);
    if (!fresh || !order) return done("needs_review", "attempt or order is missing");
    if (n.tradeAmt !== fresh.amount || fresh.amount !== order.amount) return done("needs_review", `amount mismatch: ECPay says ${n.tradeAmt}, attempt ${fresh.amount}, order ${order.amount}`);
    if (fresh.status === "paid") return done("duplicate", "already settled");

    const alreadyPaid = order.status === "paid";
    try {
      // confirmOrderPaid is the same audited all-or-nothing step an admin uses (it runs on its own connection).
      const res = await confirmOrderPaid(db, order.id, "system:ecpay", { receivedAmount: order.amount, receivedOn: day(n.paymentDate, now), note: `ECPay ${n.tradeNo} ${n.paymentType}`.slice(0, 300) }, now, { allowCancelled: true });
      await tx.update(paymentAttempts).set({ status: "paid", providerTradeNo: n.tradeNo, paymentType: n.paymentType, rtnCode: n.rtnCode, rtnMsg: n.rtnMsg.slice(0, 200), paidAt: now, updatedAt: now }).where(eq(paymentAttempts.id, fresh.id));
      if (alreadyPaid || !res.created) return done("needs_review", `order was already paid: this ECPay payment ${n.tradeNo} looks like a second payment, refund it in the ECPay back office`);
      const wasCancelled = order.status === "cancelled";
      return done(wasCancelled ? "needs_review" : "applied", wasCancelled ? "paid after the buyer cancelled the order: membership started, check with the buyer" : null, { newlyPaid: true });
    } catch (err) {
      if (err instanceof OrderFailure) return done("needs_review", `could not settle: ${err.code}`);
      throw err;
    }
  });
}

async function failAttempt(db: Db, attempt: typeof paymentAttempts.$inferSelect, n: PaymentNotice, now: Date): Promise<Partial<NoticeResult>> {
  if (attempt.status !== "paid") await db.update(paymentAttempts).set({ status: "failed", rtnCode: n.rtnCode, rtnMsg: n.rtnMsg.slice(0, 200), updatedAt: now }).where(eq(paymentAttempts.id, attempt.id));
  return {};
}

/** The buyer's browser comes back from ECPay (OrderResultURL). Only used to find the order: it changes nothing. */
export async function findOrderForReturn(db: Db, cfg: EcpayConfig, params: Record<string, string>, now: Date = new Date()): Promise<{ orderId: string; locale: string | null } | null> {
  if (!verifyCheckMacValue(params, cfg.hashKey, cfg.hashIV)) {
    await record(db, "return", params, "invalid", false, "bad signature on return", false, now);
    return null;
  }
  const n = readNotice(params);
  if (!n || n.merchantId !== cfg.merchantId) return null;
  const [a] = await db.select({ orderId: paymentAttempts.orderId }).from(paymentAttempts).where(eq(paymentAttempts.merchantTradeNo, n.merchantTradeNo)).limit(1);
  await record(db, "return", params, "ignored", true, "browser return (the server notice decides)", n.simulated, now);
  return a ? { orderId: a.orderId, locale: n.locale } : null;
}

export interface OrderPaymentView {
  /** Latest ATM account / store code to show, if the buyer has chosen one and ECPay issued it. */
  info: { bankCode?: string; vAccount?: string; paymentNo?: string; expireDate?: string; paymentType: string | null } | null;
  /** The buyer came back from ECPay but we have not been told the result yet. */
  attempts: number;
  lastFailure: string | null;
}

export async function getOrderPaymentView(db: Db, orderId: string): Promise<OrderPaymentView> {
  const rows = await db.select().from(paymentAttempts).where(eq(paymentAttempts.orderId, orderId)).orderBy(desc(paymentAttempts.createdAt)).limit(20);
  const awaiting = rows.find((r) => r.status === "awaiting" && r.paymentInfo);
  const failed = rows[0]?.status === "failed" ? rows[0] : null;
  return { info: awaiting?.paymentInfo ? { ...awaiting.paymentInfo, paymentType: awaiting.paymentType } : null, attempts: rows.length, lastFailure: failed?.rtnMsg ?? null };
}

export interface ReviewItem {
  id: string;
  receivedAt: Date;
  merchantTradeNo: string | null;
  note: string | null;
  orderReference: string | null;
  orderId: string | null;
}

/** Admin: notices the system would not decide by itself (amount mismatch, second payment, unknown order, paid after cancel). */
export async function listPaymentsNeedingReview(db: Db): Promise<ReviewItem[]> {
  const rows = await db
    .select({ e: paymentEvents, orderId: paymentAttempts.orderId, ref: orders.referenceCode })
    .from(paymentEvents)
    .leftJoin(paymentAttempts, eq(paymentAttempts.merchantTradeNo, paymentEvents.merchantTradeNo))
    .leftJoin(orders, eq(orders.id, paymentAttempts.orderId))
    .where(and(eq(paymentEvents.outcome, "needs_review"), isNull(paymentEvents.reviewedAt)))
    .orderBy(asc(paymentEvents.receivedAt))
    .limit(100);
  return rows.map((r) => ({ id: r.e.id, receivedAt: r.e.receivedAt, merchantTradeNo: r.e.merchantTradeNo, note: r.e.note, orderReference: r.ref, orderId: r.orderId }));
}

export async function markPaymentReviewed(db: Db, eventId: string, adminUserId: string, now: Date = new Date()): Promise<void> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return;
  await db.update(paymentEvents).set({ reviewedAt: now, reviewedBy: adminUserId }).where(and(eq(paymentEvents.id, eventId), isNull(paymentEvents.reviewedAt)));
}

/** Campus names on an order, for the ECPay item list. (Kept here so the order page and admin share it.) */
export async function campusCount(db: Db, orderId: string): Promise<number> {
  const [{ n } = { n: 0 }] = await db.select({ n: sql<number>`count(*)::int` }).from(orderItems).where(eq(orderItems.orderId, orderId));
  return n;
}
