import { describe, expect, it } from "vitest";
import { checkReadiness, worst } from "@/lib/ops/readiness";

const good = {
  NEXT_PUBLIC_APP_URL: "https://learninglinks.tw",
  BETTER_AUTH_SECRET: "k3Jx9Qm2Zr7VbN1cD8fGh5LpS0tYwA4e",
  DATABASE_URL: "postgres://learninglinks:Xt9pQ2mVb7LrN4cD@db:5432/learninglinks",
  RESEND_API_KEY: "re_live_abc",
  EMAIL_FROM: "LearningLinks <no-reply@learninglinks.tw>",
  ADMIN_EMAILS: "owner@learninglinks.tw",
  BANK_NAME: "Bank", BANK_ACCOUNT_NAME: "LearningLinks Co.", BANK_ACCOUNT_NUMBER: "000111222333",
  CRON_SECRET: "c".repeat(32),
  SUPPORT_EMAIL: "help@learninglinks.tw",
  LEGAL_REVIEWED: "true",
  REVEAL_DAILY_CAP: "100",
};
const level = (env: Record<string, string | undefined>, id: string) => checkReadiness(env).find((c) => c.id === id)!.level;

describe("launch readiness", () => {
  it("passes a fully configured production environment", () => {
    expect(worst(checkReadiness(good))).toBe("pass");
  });
  it("refuses a development setup on every point that matters", () => {
    const dev = { NEXT_PUBLIC_APP_URL: "http://localhost:3000", BETTER_AUTH_SECRET: "dev-only-secret-do-not-use-in-production-0000", DATABASE_URL: "postgres://learninglinks:learninglinks@localhost:5432/learninglinks" };
    const checks = checkReadiness(dev);
    for (const id of ["app_url", "auth_secret", "email_key", "admins", "payment_route", "support"]) expect(checks.find((c) => c.id === id)!.level, id).toBe("fail");
    expect(worst(checks)).toBe("fail");
  });
  it("needs the real site address over https", () => {
    expect(level({ ...good, NEXT_PUBLIC_APP_URL: "http://learninglinks.tw" }, "app_url")).toBe("fail");
    expect(level({ ...good, NEXT_PUBLIC_APP_URL: "https://localhost" }, "app_url")).toBe("fail");
  });
  it("treats the example secret as not set", () => {
    expect(level({ ...good, BETTER_AUTH_SECRET: "change-me-change-me-change-me-change-me" }, "auth_secret")).toBe("fail");
    expect(level({ ...good, BETTER_AUTH_SECRET: "short" }, "auth_secret")).toBe("fail");
  });
  it("a half-filled set of bank details is an error, but no bank details at all is fine when ECPay is set", () => {
    expect(level({ ...good, BANK_ACCOUNT_NUMBER: "" }, "bank")).toBe("fail");
    const online = { ...good, BANK_NAME: "", BANK_ACCOUNT_NAME: "", BANK_ACCOUNT_NUMBER: "", ECPAY_MERCHANT_ID: "1234567", ECPAY_HASH_KEY: "k".repeat(16), ECPAY_HASH_IV: "i".repeat(16), ECPAY_MODE: "production" };
    expect(worst(checkReadiness(online))).toBe("pass");
    expect(checkReadiness(online).some((c) => c.id === "bank")).toBe(false);
  });
  it("needs at least one way to pay", () => {
    expect(level({ ...good, BANK_NAME: "", BANK_ACCOUNT_NAME: "", BANK_ACCOUNT_NUMBER: "" }, "payment_route")).toBe("fail");
    expect(level(good, "payment_route")).toBe("pass");
  });
  describe("ECPay", () => {
    const ecpay = { ...good, ECPAY_MERCHANT_ID: "1234567", ECPAY_HASH_KEY: "k".repeat(16), ECPAY_HASH_IV: "i".repeat(16), ECPAY_MODE: "production" };
    it("passes with real production keys, alone or beside a bank account", () => {
      expect(worst(checkReadiness(ecpay))).toBe("pass");
    });
    it("is not checked at all while it is switched off", () => {
      expect(checkReadiness(good).some((c) => c.id.startsWith("ecpay"))).toBe(false);
    });
    it("fails when only some of the three keys are set", () => {
      expect(level({ ...ecpay, ECPAY_HASH_IV: "" }, "ecpay_keys")).toBe("fail");
    });
    it("refuses to open the site in ECPay's test mode: it takes no real money", () => {
      expect(level({ ...ecpay, ECPAY_MODE: "stage" }, "ecpay_mode")).toBe("fail");
      expect(level({ ...ecpay, ECPAY_MODE: undefined }, "ecpay_mode")).toBe("fail");
    });
    it("refuses ECPay's public test accounts", () => {
      expect(level({ ...ecpay, ECPAY_MERCHANT_ID: "3002607" }, "ecpay_not_test_account")).toBe("fail");
      expect(level({ ...ecpay, ECPAY_MERCHANT_ID: "2000132" }, "ecpay_not_test_account")).toBe("fail");
    });
  });
  it("warns (does not block) about draft legal text, a weak database password and missing reminders", () => {
    expect(level({ ...good, LEGAL_REVIEWED: "false" }, "legal")).toBe("warn");
    expect(level({ ...good, DATABASE_URL: "postgres://learninglinks:learninglinks@db:5432/learninglinks" }, "db_password")).toBe("warn");
    expect(level({ ...good, CRON_SECRET: undefined }, "cron")).toBe("warn");
    expect(worst(checkReadiness({ ...good, LEGAL_REVIEWED: "false" }))).toBe("warn");
  });
  it("blocks social sign-in, which would bypass the compliance acknowledgement", () => {
    expect(level({ ...good, GOOGLE_CLIENT_ID: "abc" }, "google_social")).toBe("fail");
    expect(level({ ...good, LINE_CLIENT_ID: "abc" }, "google_social")).toBe("fail");
  });
  it("flags an absurd contact-reveal cap", () => {
    expect(level({ ...good, REVEAL_DAILY_CAP: "100000" }, "reveal_cap")).toBe("warn");
    expect(level({ ...good, REVEAL_DAILY_CAP: "abc" }, "reveal_cap")).toBe("warn");
  });
});
