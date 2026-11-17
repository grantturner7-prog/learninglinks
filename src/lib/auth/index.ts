import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { getDb, schema } from "@/lib/db";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/db/schema/auth";
import { sendEmail } from "@/lib/email";
import { getEnv } from "@/lib/env";

/** Anything a client sends for accountType other than these falls back to "educator". Never "admin". */
export function sanitizeAccountType(value: unknown): AccountType {
  return (ACCOUNT_TYPES as readonly unknown[]).includes(value) ? (value as AccountType) : "educator";
}

function createAuth() {
  const env = getEnv();
  const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {};
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET };
  }
  if (env.LINE_CLIENT_ID && env.LINE_CLIENT_SECRET) {
    socialProviders.line = { clientId: env.LINE_CLIENT_ID, clientSecret: env.LINE_CLIENT_SECRET };
  }

  return betterAuth({
    appName: "LearningLinks",
    baseURL: env.NEXT_PUBLIC_APP_URL,
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.NEXT_PUBLIC_APP_URL],
    database: drizzleAdapter(getDb(), { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: env.AUTH_REQUIRE_EMAIL_VERIFICATION,
      sendResetPassword: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Reset your LearningLinks password / 重設您的 LearningLinks 密碼",
          text: `Reset your password / 重設密碼:\n${url}\n\nIf you did not ask for this, ignore this email. / 若非您本人申請，請忽略此信。`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        await sendEmail({
          to: user.email,
          subject: "Verify your email / 請驗證您的電子郵件",
          text: `Welcome to LearningLinks. Verify your email / 請點擊連結驗證電子郵件:\n${url}`,
        });
      },
    },
    user: {
      additionalFields: {
        accountType: { type: "string", required: false, defaultValue: "educator", input: true },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (u) => ({
            data: { ...u, accountType: sanitizeAccountType((u as { accountType?: unknown }).accountType) },
          }),
        },
      },
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "rateLimit",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 8 },
        "/sign-up/email": { window: 3600, max: 15 },
        "/request-password-reset": { window: 3600, max: 6 },
        "/forget-password": { window: 3600, max: 6 },
        "/send-verification-email": { window: 3600, max: 6 },
      },
    },
    socialProviders,
    plugins: [nextCookies()],
  });
}

type AuthInstance = ReturnType<typeof createAuth>;
const g = globalThis as unknown as { __llAuth?: AuthInstance };

export function getAuth(): AuthInstance {
  return (g.__llAuth ??= createAuth());
}
