import { getEnv } from "@/lib/env";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

const g = globalThis as unknown as { __llOutbox?: EmailMessage[] };

/** Dev/test only: emails captured instead of sent. Used by tests and local end-to-end runs. */
export function getOutbox(): EmailMessage[] {
  return (g.__llOutbox ??= []);
}

/**
 * Sends a transactional email through Resend when RESEND_API_KEY is set.
 * Without a key (local dev, tests) the message is captured in memory and logged, never sent.
 */
export async function sendEmail(message: EmailMessage): Promise<void> {
  const env = getEnv();
  if (!env.RESEND_API_KEY) {
    if (env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is required to send email in production");
    getOutbox().push(message);
    console.info(`[email:dev] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: message.to, subject: message.subject, text: message.text }),
  });
  if (!res.ok) throw new Error(`Email provider error: HTTP ${res.status}`);
}
