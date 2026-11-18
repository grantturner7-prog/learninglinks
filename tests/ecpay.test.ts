import { describe, expect, it } from "vitest";
import { buildCheckout, checkoutHost, computeCheckMacValue, ecpayDate, ecpayUrlEncode, isNumberIssuedCode, isPaidCode, merchantTradeNo, parseForm, readNotice, verifyCheckMacValue, type EcpayConfig } from "@/lib/payments/ecpay";

// ECPay's published TEST account (developers.ecpay.com.tw, 準備事項 / 測試介接資訊). Never a real account.
const TEST = { merchantId: "3002607", hashKey: "pwFHCqoQZGmho4w6", hashIV: "EkRm7iFT261dpevs" };
const cfg: EcpayConfig = { ...TEST, mode: "stage", methods: ["Credit", "ATM", "CVS"] };

describe("CheckMacValue against ECPay's own printed examples", () => {
  it("reproduces the create-order example from the specification", () => {
    // 附錄 / 檢查碼機制說明: "下列範例為 AioCheckOut 建立訂單 計算方式"
    const params = {
      TradeDesc: "促銷方案", PaymentType: "aio", MerchantTradeDate: "2023/03/12 15:30:23", MerchantTradeNo: "ecpay20230312153023", MerchantID: "3002607",
      ReturnURL: "https://www.ecpay.com.tw/receive.php", ItemName: "Apple iphone 15", TotalAmount: "30000", ChoosePayment: "ALL", EncryptType: "1",
    };
    expect(computeCheckMacValue(params, TEST.hashKey, TEST.hashIV)).toBe("6C51C9E6888DE861FD62FB1DD17029FC742634498FD813DC43D4243B5685B840");
  });

  it("reproduces the payment-result notification example (empty fields included)", () => {
    // 付款結果通知 / 綠界回傳參數範例
    const params = {
      CustomField1: "", CustomField2: "", CustomField3: "", CustomField4: "", MerchantID: "3002607", MerchantTradeNo: "D9RMXNrihUYM", PaymentDate: "2024/12/31 12:26:09",
      PaymentType: "Credit_CreditCard", PaymentTypeChargeFee: "10", RtnCode: "1", RtnMsg: "交易成功", SimulatePaid: "0", StoreID: "", TradeAmt: "402", TradeDate: "2024/12/31 12:25:43",
      TradeNo: "2412311225437371", CheckMacValue: "85D927637935683EA756CDEF76498FEB9F5D098A7A1AC4F0CB3B3609A9D4116A",
    };
    expect(computeCheckMacValue(params, TEST.hashKey, TEST.hashIV)).toBe(params.CheckMacValue);
    expect(verifyCheckMacValue(params, TEST.hashKey, TEST.hashIV)).toBe(true);
  });

  it("sorts names without regard to case, as the specification says (A to Z)", () => {
    const a = computeCheckMacValue({ b: "2", A: "1", c: "3" }, "k", "i");
    const b = computeCheckMacValue({ c: "3", A: "1", b: "2" }, "k", "i");
    expect(a).toBe(b);
  });
});

describe("ECPay's URL encoding", () => {
  it("matches the 'ecpay' column of their conversion table", () => {
    expect(ecpayUrlEncode("a b")).toBe("a+b");
    expect(ecpayUrlEncode("-_.!*()")).toBe("-_.!*()"); // left as they are
    expect(ecpayUrlEncode("~")).toBe("%7e");
    expect(ecpayUrlEncode("'")).toBe("%27");
    expect(ecpayUrlEncode("A=B&C/D:E")).toBe("a%3db%26c%2fd%3ae"); // lower-case hex, and the whole string lower-cased
    expect(ecpayUrlEncode("促銷")).toBe("%e4%bf%83%e9%8a%b7");
  });
});

describe("checking what arrives", () => {
  const good = () => {
    const p: Record<string, string> = { MerchantID: "3002607", MerchantTradeNo: "LL7K3Q9FXD01", RtnCode: "1", RtnMsg: "ok", TradeAmt: "2000", TradeNo: "2411180000000001", PaymentType: "Credit_CreditCard", SimulatePaid: "0" };
    p.CheckMacValue = computeCheckMacValue(p, TEST.hashKey, TEST.hashIV);
    return p;
  };
  it("accepts a correctly signed notice", () => {
    expect(verifyCheckMacValue(good(), TEST.hashKey, TEST.hashIV)).toBe(true);
  });
  it("rejects a changed amount, a changed order, a missing or malformed signature and the wrong key", () => {
    const tampered = { ...good(), TradeAmt: "1" };
    expect(verifyCheckMacValue(tampered, TEST.hashKey, TEST.hashIV)).toBe(false);
    expect(verifyCheckMacValue({ ...good(), MerchantTradeNo: "OTHER" }, TEST.hashKey, TEST.hashIV)).toBe(false);
    const none = good();
    delete none.CheckMacValue;
    expect(verifyCheckMacValue(none, TEST.hashKey, TEST.hashIV)).toBe(false);
    expect(verifyCheckMacValue({ ...good(), CheckMacValue: "ABC" }, TEST.hashKey, TEST.hashIV)).toBe(false);
    expect(verifyCheckMacValue(good(), "wrong-key-wrong-key", TEST.hashIV)).toBe(false);
  });
  it("accepts the signature in lower case too", () => {
    const p = good();
    p.CheckMacValue = p.CheckMacValue!.toLowerCase();
    expect(verifyCheckMacValue(p, TEST.hashKey, TEST.hashIV)).toBe(true);
  });
  it("reads a notice, including the test-payment flag and ATM details", () => {
    const n = readNotice({ ...good(), SimulatePaid: "1" })!;
    expect(n).toMatchObject({ merchantTradeNo: "LL7K3Q9FXD01", rtnCode: 1, tradeAmt: 2000, simulated: true, info: null });
    const atm = readNotice({ MerchantID: "3002607", MerchantTradeNo: "X", RtnCode: "2", BankCode: "812", vAccount: "9103522175887271", ExpireDate: "2026/11/21", CustomField1: "zh-TW" })!;
    expect(atm.info).toEqual({ bankCode: "812", vAccount: "9103522175887271", paymentNo: undefined, expireDate: "2026/11/21" });
    expect(atm.locale).toBe("zh-TW");
    expect(readNotice({ MerchantID: "x" })).toBeNull();
    expect(isPaidCode(1)).toBe(true);
    expect(isPaidCode(10300066)).toBe(false); // "result waiting for confirmation: do not ship"
    expect(isNumberIssuedCode(2) && isNumberIssuedCode(10100073)).toBe(true);
  });
  it("reads a form body without altering values", () => {
    expect(parseForm("a=1&b=%E4%BA%A4%E6%98%93%E6%88%90%E5%8A%9F&c=")).toEqual({ a: "1", b: "交易成功", c: "" });
  });
});

describe("building the checkout form", () => {
  const input = {
    tradeNo: "LL7K3Q9FXD01", amount: 20_000, itemName: "LearningLinks school membership 12 months x 2 campuses", tradeDesc: "LearningLinks membership",
    returnUrl: "https://learninglinks.tw/api/payments/ecpay/notify", paymentInfoUrl: "https://learninglinks.tw/api/payments/ecpay/info",
    orderResultUrl: "https://learninglinks.tw/api/payments/ecpay/return", clientBackUrl: "https://learninglinks.tw/zh-TW/orders/abc", locale: "zh-TW", now: new Date("2026-11-18T04:05:06Z"),
  };
  it("fills every required field in the form ECPay expects, and signs it", () => {
    const { action, fields } = buildCheckout(cfg, input);
    expect(action).toBe("https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5");
    expect(fields).toMatchObject({ MerchantID: "3002607", MerchantTradeNo: "LL7K3Q9FXD01", PaymentType: "aio", TotalAmount: "20000", EncryptType: "1", Language: "CHT", CustomField1: "zh-TW" });
    expect(fields.MerchantTradeDate).toBe("2026/11/18 12:05:06"); // Taipei is UTC+8
    expect(verifyCheckMacValue(fields, TEST.hashKey, TEST.hashIV)).toBe(true);
    for (const k of ["MerchantID", "MerchantTradeNo", "MerchantTradeDate", "PaymentType", "TotalAmount", "TradeDesc", "ItemName", "ReturnURL", "ChoosePayment", "CheckMacValue", "EncryptType"]) expect(fields[k], k).toBeTruthy();
  });
  it("names exactly one method per trip, as ECPay advises, never ALL (ECPay keeps adding methods)", () => {
    expect(buildCheckout(cfg, input).fields.ChoosePayment).toBe("Credit"); // the first on offer by default
    for (const m of ["Credit", "ATM", "CVS"] as const) {
      const { fields } = buildCheckout(cfg, { ...input, method: m });
      expect(fields.ChoosePayment).toBe(m);
      expect(fields.IgnorePayment).toBeUndefined();
      expect(verifyCheckMacValue(fields, TEST.hashKey, TEST.hashIV)).toBe(true);
    }
  });
  it("refuses a method we do not offer", () => {
    expect(() => buildCheckout({ ...cfg, methods: ["Credit"] }, { ...input, method: "ATM" })).toThrow(/not on offer/);
  });
  it("uses the production address in production mode", () => {
    expect(buildCheckout({ ...cfg, mode: "production" }, input).action).toBe("https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5");
    expect(checkoutHost("production")).toBe("https://payment.ecpay.com.tw");
  });
  it("English pages ask ECPay for English", () => {
    expect(buildCheckout(cfg, { ...input, locale: "en-TW" }).fields.Language).toBe("ENG");
  });
  it("refuses an amount ECPay would reject", () => {
    expect(() => buildCheckout(cfg, { ...input, amount: 2000.5 })).toThrow();
    expect(() => buildCheckout(cfg, { ...input, amount: 0 })).toThrow();
  });
  it("keeps long text inside ECPay's limits", () => {
    const f = buildCheckout(cfg, { ...input, itemName: "x".repeat(900), tradeDesc: "y".repeat(500) }).fields;
    expect(f.ItemName!.length).toBe(400);
    expect(f.TradeDesc!.length).toBe(200);
  });
});

describe("trade numbers and dates", () => {
  it("makes a 12-character letters-and-digits number from the order reference, new for every attempt", () => {
    expect(merchantTradeNo("LL-7K3Q-9FXD", 1)).toBe("LL7K3Q9FXD01");
    expect(merchantTradeNo("LL-7K3Q-9FXD", 35)).toBe("LL7K3Q9FXD0Z");
    expect(merchantTradeNo("LL-7K3Q-9FXD", 36)).toBe("LL7K3Q9FXD10");
    expect(merchantTradeNo("LL-7K3Q-9FXD", 2)).not.toBe(merchantTradeNo("LL-7K3Q-9FXD", 1));
    expect(merchantTradeNo("LL-7K3Q-9FXD", 1)).toMatch(/^[A-Za-z0-9]{1,20}$/);
  });
  it("writes the trade date in Taipei time", () => {
    expect(ecpayDate(new Date("2026-12-31T16:30:00Z"))).toBe("2027/01/01 00:30:00");
  });
});
