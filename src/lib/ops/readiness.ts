/**
 * Launch readiness: what must be set before real people use the site. Pure, so it is unit tested; the
 * `npm run preflight` script feeds it the real environment and adds the database checks.
 *   fail = do not open the site yet; warn = works, but you should know.
 */
export type Level = "pass" | "warn" | "fail";
export interface Check {
  id: string;
  level: Level;
  message: string;
}

type Env = Record<string, string | undefined>;
const has = (v: string | undefined) => !!v && v.trim() !== "";
const PLACEHOLDER = /change-me|example\.com|example\.org|localhost|dev-only|your-|xxxxx/i;

export function checkReadiness(env: Env): Check[] {
  const out: Check[] = [];
  const add = (id: string, ok: boolean, level: Level, good: string, bad: string) => out.push({ id, level: ok ? "pass" : level, message: ok ? good : bad });

  const url = env.NEXT_PUBLIC_APP_URL ?? "";
  add("app_url", /^https:\/\//.test(url) && !/localhost|127\.0\.0\.1/.test(url), "fail", `Site address is ${url}`, "NEXT_PUBLIC_APP_URL must be the public https:// address (not localhost).");

  const secret = env.BETTER_AUTH_SECRET ?? "";
  add("auth_secret", secret.length >= 32 && !PLACEHOLDER.test(secret), "fail", "BETTER_AUTH_SECRET is set and long enough.", "BETTER_AUTH_SECRET must be 32+ random characters (openssl rand -base64 32), not a placeholder.");

  add("database", has(env.DATABASE_URL), "fail", "DATABASE_URL is set.", "DATABASE_URL is missing.");
  const pw = /^postgres(?:ql)?:\/\/[^:]+:([^@]+)@/.exec(env.DATABASE_URL ?? "")?.[1] ?? "";
  add("db_password", pw.length >= 12 && !PLACEHOLDER.test(pw) && pw !== "learninglinks", "warn", "The database password looks strong.", "The database password is short or a placeholder. Use a long random one (POSTGRES_PASSWORD).");

  add("email_key", has(env.RESEND_API_KEY), "fail", "RESEND_API_KEY is set (verification and reset emails can be sent).", "RESEND_API_KEY is missing. Without it nobody can verify their email or reset a password.");
  const from = env.EMAIL_FROM ?? "";
  add("email_from", has(from) && !PLACEHOLDER.test(from), "warn", `Emails come from ${from}`, "EMAIL_FROM is still a placeholder. Use an address on a domain you verified with the email provider.");

  add("admins", has(env.ADMIN_EMAILS), "fail", "ADMIN_EMAILS lists who can confirm payments.", "ADMIN_EMAILS is empty: nobody could confirm a bank transfer or review reports.");
  add("bank", has(env.BANK_NAME) && has(env.BANK_ACCOUNT_NAME) && has(env.BANK_ACCOUNT_NUMBER), "fail", "Bank details are set for the order page.", "BANK_NAME, BANK_ACCOUNT_NAME and BANK_ACCOUNT_NUMBER must be set, or members cannot see where to pay.");
  add("cron", (env.CRON_SECRET ?? "").length >= 24, "warn", "CRON_SECRET is set (renewal reminders can run).", "CRON_SECRET is missing or short (24+ characters): renewal reminders will not run.");
  add("support", has(env.SUPPORT_EMAIL) && /@/.test(env.SUPPORT_EMAIL ?? ""), "fail", `Support address is ${env.SUPPORT_EMAIL}`, "SUPPORT_EMAIL is missing: the legal pages, appeals and privacy requests need a public address.");
  add("legal", env.LEGAL_REVIEWED === "true", "warn", "Legal text is marked as reviewed.", "LEGAL_REVIEWED is not true: the Terms, Privacy Policy and Waiver still show a DRAFT banner. Set it only after your lawyer approves them.");

  const cap = Number(env.REVEAL_DAILY_CAP ?? 100);
  add("reveal_cap", Number.isInteger(cap) && cap >= 1 && cap <= 300, "warn", `Daily contact-reveal cap is ${cap}.`, "REVEAL_DAILY_CAP is very high or invalid. The cap protects educators from bulk copying.");

  add("google_social", !has(env.GOOGLE_CLIENT_ID) && !has(env.LINE_CLIENT_ID), "fail", "Social sign-in is off.", "Social sign-in is configured. It must stay OFF: it would bypass the compliance acknowledgement at sign-up.");
  return out;
}

export const worst = (checks: Check[]): Level => (checks.some((c) => c.level === "fail") ? "fail" : checks.some((c) => c.level === "warn") ? "warn" : "pass");
