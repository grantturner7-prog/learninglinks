import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { confirmOrderPaid, createFamilyOrder, createSchoolOrder, getHolderMembership } from "@/lib/billing/orders";
import type { Db } from "@/lib/db";
import { schema } from "@/lib/db";
import { computeCheckMacValue, type EcpayConfig } from "@/lib/payments/ecpay";
import { findOrderForReturn, getOrderPaymentView, handleEcpayNotice, listPaymentsNeedingReview, markPaymentReviewed, PaymentFailure, startOnlinePayment } from "@/lib/payments/service";
import { TEST_DB_URL, closeTestDb, makeUser, openTestDb, resetTestDb } from "./helpers";

const cfg: EcpayConfig = { merchantId: "3002607", hashKey: "pwFHCqoQZGmho4w6", hashIV: "EkRm7iFT261dpevs", mode: "stage", methods: ["Credit", "ATM", "CVS"] };
const urls = { appUrl: "https://learninglinks.test", locale: "zh-TW" };

/** A notice as ECPay would send it, correctly signed. */
function notice(tradeNo: string, over: Record<string, string> = {}) {
  const p: Record<string, string> = { MerchantID: cfg.merchantId, MerchantTradeNo: tradeNo, RtnCode: "1", RtnMsg: "交易成功", TradeNo: "2611180000000001", TradeAmt: "2000", PaymentDate: "2026/11/18 12:26:09", PaymentType: "Credit_CreditCard", SimulatePaid: "0", CustomField1: "zh-TW", ...over };
  p.CheckMacValue = computeCheckMacValue(p, cfg.hashKey, cfg.hashIV);
  return p;
}

describe.skipIf(!TEST_DB_URL)("ECPay payments (real Postgres)", () => {
  let db: Db;
  beforeAll(async () => { db = await openTestDb(); });
  beforeEach(async () => { await resetTestDb(db); });
  afterAll(async () => { await closeTestDb(); });

  async function familyOrder() {
    const fam = await makeUser(db, "family");
    const order = await createFamilyOrder(db, fam, undefined, "ecpay");
    return { fam, order };
  }
  async function pay(fam: { id: string }, orderId: string) {
    const c = await startOnlinePayment(db, cfg, fam.id, orderId, urls);
    return c.fields.MerchantTradeNo!;
  }
  const outcomes = async () => (await db.select().from(schema.paymentEvents)).map((e) => e.outcome).sort();

  describe("starting a payment", () => {
    it("builds a signed form for the order's amount and gives every attempt its own number", async () => {
      const { fam, order } = await familyOrder();
      expect(order.provider).toBe("ecpay");
      const a = await startOnlinePayment(db, cfg, fam.id, order.id, urls);
      const b = await startOnlinePayment(db, cfg, fam.id, order.id, urls);
      expect(a.fields).toMatchObject({ MerchantID: "3002607", TotalAmount: "2000", ReturnURL: "https://learninglinks.test/api/payments/ecpay/notify", CustomField1: "zh-TW", ClientBackURL: `https://learninglinks.test/zh-TW/orders/${order.id}` });
      expect(a.fields.MerchantTradeNo).not.toBe(b.fields.MerchantTradeNo);
      expect(a.fields.MerchantTradeNo!.startsWith(order.referenceCode.replace(/-/g, ""))).toBe(true);
      expect(await db.select().from(schema.paymentAttempts)).toHaveLength(2);
    });
    it("asks ECPay for exactly the method the buyer picked, and refuses one we do not offer", async () => {
      const { fam, order } = await familyOrder();
      expect((await startOnlinePayment(db, cfg, fam.id, order.id, urls, new Date(), "ATM")).fields.ChoosePayment).toBe("ATM");
      expect((await startOnlinePayment(db, cfg, fam.id, order.id, urls, new Date(), "CVS")).fields.ChoosePayment).toBe("CVS");
      expect((await startOnlinePayment(db, cfg, fam.id, order.id, urls)).fields.ChoosePayment).toBe("Credit");
      await expect(startOnlinePayment(db, { ...cfg, methods: ["Credit"] }, fam.id, order.id, urls, new Date(), "ATM")).rejects.toThrow(/not on offer/);
    });
    it("charges a school order the per-campus total", async () => {
      const owner = await makeUser(db, "school");
      const [a, b] = await db.insert(schema.organizations).values([{ name: "A", type: "cram_school", status: "claimed" }, { name: "B", type: "cram_school", status: "claimed" }]).returning();
      await db.insert(schema.orgMembers).values([{ organizationId: a!.id, userId: owner.id }, { organizationId: b!.id, userId: owner.id }]);
      const order = await createSchoolOrder(db, owner, [a!.id, b!.id], undefined, "ecpay");
      const c = await startOnlinePayment(db, cfg, owner.id, order.id, urls);
      expect(c.fields.TotalAmount).toBe("20000");
      expect(c.fields.ItemName).toContain("2 campuses");
    });
    it("only for the buyer, only while unpaid, only for online orders", async () => {
      const { fam, order } = await familyOrder();
      const other = await makeUser(db, "family");
      await expect(startOnlinePayment(db, cfg, other.id, order.id, urls)).rejects.toMatchObject({ code: "not_found" });
      await expect(startOnlinePayment(db, cfg, fam.id, "nope", urls)).rejects.toMatchObject({ code: "not_found" });
      const bank = await createFamilyOrder(db, fam);
      await expect(startOnlinePayment(db, cfg, fam.id, bank.id, urls)).rejects.toMatchObject({ code: "not_online" });
      const no = await pay(fam, order.id);
      await handleEcpayNotice(db, cfg, "result", notice(no));
      await expect(startOnlinePayment(db, cfg, fam.id, order.id, urls)).rejects.toBeInstanceOf(PaymentFailure);
    });
  });

  describe("when ECPay reports a payment", () => {
    it("settles the order once: paid, 12 months, the attempt marked, and 1|OK", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      const res = await handleEcpayNotice(db, cfg, "result", notice(no));
      expect(res).toMatchObject({ status: 200, body: "1|OK", outcome: "applied", newlyPaid: true, orderId: order.id });
      const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
      expect(o).toMatchObject({ status: "paid", paidAmount: 2000, confirmedBy: "system:ecpay" });
      expect(o!.paidNote).toContain("2611180000000001");
      expect(o!.paidOn).toBe("2026-11-18");
      expect((await getHolderMembership(db, "user", fam.id)).active).toBe(true);
      const [att] = await db.select().from(schema.paymentAttempts);
      expect(att).toMatchObject({ status: "paid", providerTradeNo: "2611180000000001", paymentType: "Credit_CreditCard", rtnCode: 1 });
      const [audit] = await db.select().from(schema.auditLog).where(eq(schema.auditLog.action, "order.confirmed"));
      expect(audit).toMatchObject({ actorUserId: "system:ecpay" });
    });

    it("a repeated notice (ECPay retries until it hears 1|OK) changes nothing", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      await handleEcpayNotice(db, cfg, "result", notice(no));
      const again = await handleEcpayNotice(db, cfg, "result", notice(no));
      expect(again).toMatchObject({ status: 200, body: "1|OK", outcome: "duplicate", newlyPaid: false });
      expect(await db.select().from(schema.memberships)).toHaveLength(1);
      expect(await outcomes()).toEqual(["applied", "duplicate"]);
    });

    it("three copies arriving at the same moment still make one membership and one 'applied'", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      const results = await Promise.all([1, 2, 3].map(() => handleEcpayNotice(db, cfg, "result", notice(no))));
      expect(results.filter((r) => r.newlyPaid)).toHaveLength(1);
      expect(await db.select().from(schema.memberships)).toHaveLength(1);
      expect(await outcomes()).toEqual(["applied", "duplicate", "duplicate"]);
    });

    it("a school order settles every campus", async () => {
      const owner = await makeUser(db, "school");
      const [a, b] = await db.insert(schema.organizations).values([{ name: "A", type: "cram_school", status: "claimed" }, { name: "B", type: "cram_school", status: "claimed" }]).returning();
      await db.insert(schema.orgMembers).values([{ organizationId: a!.id, userId: owner.id }, { organizationId: b!.id, userId: owner.id }]);
      const order = await createSchoolOrder(db, owner, [a!.id, b!.id], undefined, "ecpay");
      const no = await pay(owner, order.id);
      await handleEcpayNotice(db, cfg, "result", notice(no, { TradeAmt: "20000" }));
      expect(await db.select().from(schema.memberships)).toHaveLength(2);
    });

    it("refuses a notice that is not genuine: wrong signature, tampered amount, wrong merchant", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      const forged = { ...notice(no), TradeAmt: "1" };
      expect(await handleEcpayNotice(db, cfg, "result", forged)).toMatchObject({ status: 400, outcome: "invalid" });
      const noMac = notice(no); delete (noMac as Record<string, string | undefined>).CheckMacValue;
      expect(await handleEcpayNotice(db, cfg, "result", noMac as Record<string, string>)).toMatchObject({ status: 400 });
      const otherMerchant = { MerchantID: "2000132", MerchantTradeNo: no, RtnCode: "1", TradeAmt: "2000" } as Record<string, string>;
      otherMerchant.CheckMacValue = computeCheckMacValue(otherMerchant, cfg.hashKey, cfg.hashIV);
      expect(await handleEcpayNotice(db, cfg, "result", otherMerchant)).toMatchObject({ status: 400 });
      const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
      expect(o!.status).toBe("pending");
      expect(await db.select().from(schema.memberships)).toHaveLength(0);
      expect(await outcomes()).toEqual(["invalid", "invalid", "invalid"]);
    });

    it("ECPay's 'simulate payment' button is recorded and ignored: no membership", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      const res = await handleEcpayNotice(db, cfg, "result", notice(no, { SimulatePaid: "1" }));
      expect(res).toMatchObject({ status: 200, body: "1|OK", outcome: "ignored" });
      const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
      expect(o!.status).toBe("pending");
      expect((await db.select().from(schema.paymentEvents))[0]!.simulated).toBe(true);
    });

    it("a failed or pending payment (RtnCode other than 1) does not settle, and the buyer can try again", async () => {
      const { fam, order } = await familyOrder();
      const first = await pay(fam, order.id);
      expect(await handleEcpayNotice(db, cfg, "result", notice(first, { RtnCode: "10100248", RtnMsg: "拒絕交易" }))).toMatchObject({ status: 200, outcome: "applied", newlyPaid: false });
      await handleEcpayNotice(db, cfg, "result", notice(await pay(fam, order.id), { RtnCode: "10300066", RtnMsg: "交易付款結果待確認中" }));
      expect((await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)))[0]!.status).toBe("pending");
      expect((await getOrderPaymentView(db, order.id)).lastFailure).toContain("待確認");
      const retry = await pay(fam, order.id);
      await handleEcpayNotice(db, cfg, "result", notice(retry));
      expect((await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)))[0]!.status).toBe("paid");
    });

    it("an amount that does not match is NOT settled and goes to the admin", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      expect(await handleEcpayNotice(db, cfg, "result", notice(no, { TradeAmt: "1500" }))).toMatchObject({ status: 200, outcome: "needs_review" });
      expect((await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)))[0]!.status).toBe("pending");
      const review = await listPaymentsNeedingReview(db);
      expect(review).toHaveLength(1);
      expect(review[0]).toMatchObject({ orderReference: order.referenceCode, merchantTradeNo: no });
      expect(review[0]!.note).toContain("amount mismatch");
      const admin = await makeUser(db, "educator");
      await markPaymentReviewed(db, review[0]!.id, admin.id);
      expect(await listPaymentsNeedingReview(db)).toHaveLength(0);
    });

    it("a notice for a trade number we never made is kept and flagged, and ECPay is told 1|OK", async () => {
      expect(await handleEcpayNotice(db, cfg, "result", notice("NOSUCHORDER01"))).toMatchObject({ status: 200, body: "1|OK", outcome: "needs_review", orderId: null });
      expect(await listPaymentsNeedingReview(db)).toHaveLength(1);
    });

    it("money that arrives after the buyer cancelled still starts the membership, and is flagged", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      await db.update(schema.orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(schema.orders.id, order.id));
      const res = await handleEcpayNotice(db, cfg, "result", notice(no));
      expect(res).toMatchObject({ outcome: "needs_review", newlyPaid: true });
      const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, order.id));
      expect(o).toMatchObject({ status: "paid", cancelledAt: null });
      expect((await getHolderMembership(db, "user", fam.id)).active).toBe(true);
      expect((await listPaymentsNeedingReview(db))[0]!.note).toContain("cancelled");
    });

    it("a second payment for an order that is already paid is flagged for a refund, with no extra months", async () => {
      const { fam, order } = await familyOrder();
      const admin = await makeUser(db, "educator");
      const no = await pay(fam, order.id);
      await confirmOrderPaid(db, order.id, admin.id, { receivedAmount: 2000, receivedOn: "2026-11-18" }); // the admin confirmed a bank transfer first
      const res = await handleEcpayNotice(db, cfg, "result", notice(no));
      expect(res).toMatchObject({ outcome: "needs_review", newlyPaid: false });
      expect(await db.select().from(schema.memberships)).toHaveLength(1);
      expect((await listPaymentsNeedingReview(db))[0]!.note).toContain("second payment");
    });
  });

  describe("ATM and convenience-store numbers", () => {
    it("keeps the virtual account so the order page can show it", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      const res = await handleEcpayNotice(db, cfg, "info", notice(no, { RtnCode: "2", RtnMsg: "Get VirtualAccount Succeeded", PaymentType: "ATM_TAISHIN", BankCode: "812", vAccount: "9103522175887271", ExpireDate: "2026/11/21" }));
      expect(res).toMatchObject({ status: 200, body: "1|OK", outcome: "applied" });
      const view = await getOrderPaymentView(db, order.id);
      expect(view.info).toMatchObject({ bankCode: "812", vAccount: "9103522175887271", expireDate: "2026/11/21", paymentType: "ATM_TAISHIN" });
      expect((await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)))[0]!.status).toBe("pending"); // a number is not a payment
    });
    it("keeps a convenience-store code, and the later payment settles the order", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      await handleEcpayNotice(db, cfg, "info", notice(no, { RtnCode: "10100073", PaymentType: "CVS_CVS", PaymentNo: "LLL17355880822", ExpireDate: "2026/11/25 23:59:59" }));
      expect((await getOrderPaymentView(db, order.id)).info?.paymentNo).toBe("LLL17355880822");
      await handleEcpayNotice(db, cfg, "result", notice(no, { PaymentType: "CVS_CVS" }));
      expect((await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)))[0]!.status).toBe("paid");
    });
    it("a refused number is recorded as a failed attempt", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      await handleEcpayNotice(db, cfg, "info", notice(no, { RtnCode: "10100058", RtnMsg: "failed" }));
      expect((await db.select().from(schema.paymentAttempts))[0]!.status).toBe("failed");
      expect((await getOrderPaymentView(db, order.id)).info).toBeNull();
    });
  });

  describe("what is kept of a notice", () => {
    it("drops anything outside ECPay's known fields (for example card digits) and keeps only the names of what was dropped", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      await handleEcpayNotice(db, cfg, "result", notice(no, { card6no: "431195", card4no: "2222", auth_code: "777777" }));
      const [e] = await db.select().from(schema.paymentEvents);
      const payload = e!.payload;
      expect(payload.MerchantTradeNo).toBe(no);
      expect(payload.TradeAmt).toBe("2000");
      expect(JSON.stringify(payload)).not.toMatch(/431195|2222|777777/);
      expect(payload._droppedFields).toBe("card6no,card4no,auth_code");
    });
  });

  describe("the buyer's browser coming back", () => {
    it("finds the order for a genuine return and refuses a forged one, and never changes the order", async () => {
      const { fam, order } = await familyOrder();
      const no = await pay(fam, order.id);
      expect(await findOrderForReturn(db, cfg, notice(no))).toEqual({ orderId: order.id, locale: "zh-TW" });
      expect(await findOrderForReturn(db, cfg, { ...notice(no), TradeAmt: "5" })).toBeNull();
      expect((await db.select().from(schema.orders).where(eq(schema.orders.id, order.id)))[0]!.status).toBe("pending");
    });
  });
});
