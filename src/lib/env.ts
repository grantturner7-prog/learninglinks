import { z } from "zod";

/** Treat empty strings (as in a copied .env.example) as "not set". */
const emptyToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const bool = z.preprocess(emptyToUndefined, z.enum(["true", "false"]).default("false")).transform((v) => v === "true");

const DEV_SECRET = "dev-only-secret-do-not-use-in-production-0000";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.preprocess(emptyToUndefined, z.url().default("http://localhost:3000")),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  BETTER_AUTH_SECRET: z.preprocess(emptyToUndefined, z.string().min(32).optional()),
  ADMIN_EMAILS: z
    .preprocess(emptyToUndefined, z.string().default(""))
    .transform((s) => s.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)),
  AUTH_REQUIRE_EMAIL_VERIFICATION: bool,
  RESEND_API_KEY: optionalString,
  EMAIL_FROM: z.preprocess(emptyToUndefined, z.string().default("LearningLinks <no-reply@localhost>")),
  UPLOAD_DIR: z.preprocess(emptyToUndefined, z.string().default(".data/uploads")),
  REVEAL_DAILY_CAP: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().default(100)),
  BANK_NAME: optionalString,
  BANK_ACCOUNT_NAME: optionalString,
  BANK_ACCOUNT_NUMBER: optionalString,
  BANK_BRANCH: optionalString,
  /** ECPay (綠界) online payment. Leave all three empty to keep it off. */
  ECPAY_MERCHANT_ID: optionalString,
  ECPAY_HASH_KEY: optionalString,
  ECPAY_HASH_IV: optionalString,
  /** "stage" = ECPay's test server (default). "production" only with the live merchant account. */
  ECPAY_MODE: z.preprocess(emptyToUndefined, z.enum(["stage", "production"]).default("stage")),
  /** Which payment methods to offer on ECPay's page, comma separated: Credit, ATM, CVS, BARCODE, WebATM, ApplePay, TWQR, BNPL, WeiXin. */
  ECPAY_METHODS: z.preprocess(emptyToUndefined, z.string().default("Credit,ATM,CVS")),
  /** Shared secret for scheduled jobs (renewal reminders). Without it the cron endpoint is disabled. */
  CRON_SECRET: z.preprocess(emptyToUndefined, z.string().min(24).optional()),
  LEGAL_REVIEWED: bool,
  /** Public support address shown in the Contact block of the Terms, Privacy policy and Educator waiver pages. */
  SUPPORT_EMAIL: optionalString,
  FOUNDING_DISCOUNT_PERCENT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(0).max(90).default(0)),
  /** Dev/test only: lets checkout run before a country's launch gate is green. Ignored in production. */
  LAUNCH_GATE_OVERRIDE: bool,
  LINE_CLIENT_ID: optionalString,
  LINE_CLIENT_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
});

export type Env = Omit<z.infer<typeof schema>, "BETTER_AUTH_SECRET"> & { BETTER_AUTH_SECRET: string };

let cached: Env | undefined;

/** Validated environment. Parsed lazily so `next build` does not need runtime secrets. */
export function getEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (source === process.env && cached) return cached;
  const parsed = schema.parse(source);
  const isProd = parsed.NODE_ENV === "production";
  if (isProd && !parsed.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET (32+ chars) is required in production");
  }
  if (isProd && parsed.BETTER_AUTH_SECRET === DEV_SECRET) {
    throw new Error("BETTER_AUTH_SECRET must not be the development default in production");
  }
  const env: Env = {
    ...parsed,
    BETTER_AUTH_SECRET: parsed.BETTER_AUTH_SECRET ?? DEV_SECRET,
    // Never let a dev override or an unverified-email flow leak into production.
    LAUNCH_GATE_OVERRIDE: isProd ? false : parsed.LAUNCH_GATE_OVERRIDE,
    AUTH_REQUIRE_EMAIL_VERIFICATION: isProd ? true : parsed.AUTH_REQUIRE_EMAIL_VERIFICATION,
  };
  if (source === process.env) cached = env;
  return env;
}
