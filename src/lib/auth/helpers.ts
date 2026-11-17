import { ACCOUNT_TYPES, type AccountType } from "@/lib/db/schema/auth";

/** Anything a client sends for accountType other than these falls back to "educator". Never "admin". */
export function sanitizeAccountType(value: unknown): AccountType {
  return (ACCOUNT_TYPES as readonly unknown[]).includes(value) ? (value as AccountType) : "educator";
}

/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  // Reject anything that, once decoded, could become an absolute URL or a protocol-relative one.
  let decoded = next;
  try {
    decoded = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (decoded.startsWith("//") || decoded.includes("\\") || /^\/[a-z][a-z0-9+.-]*:/i.test(decoded)) return fallback;
  return next;
}

/** Admin = verified email that appears in the ADMIN_EMAILS list. Nothing about admin is stored in the database. */
export function isAdminEmail(email: string, emailVerified: boolean, adminEmails: readonly string[]): boolean {
  return emailVerified && adminEmails.includes(email.trim().toLowerCase());
}
