export type AuthErrorKey = "invalid" | "notVerified" | "rateLimited" | "exists" | "weak" | "ackRequired" | "generic";

interface AuthErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

/** Map a Better Auth client error to one of our translated messages. Never leaks server detail to the page. */
export function mapAuthError(e: AuthErrorLike | null | undefined): AuthErrorKey {
  if (!e) return "generic";
  const code = (e.code ?? "").toUpperCase();
  const message = (e.message ?? "").toUpperCase();
  if (e.status === 429) return "rateLimited";
  if (code === "NOTICE_NOT_ACKNOWLEDGED" || message.includes("NOTICE_NOT_ACKNOWLEDGED")) return "ackRequired";
  if (code === "EMAIL_NOT_VERIFIED" || e.status === 403) return "notVerified";
  if (code === "INVALID_EMAIL_OR_PASSWORD") return "invalid";
  if (code.startsWith("USER_ALREADY_EXISTS")) return "exists";
  if (code === "PASSWORD_TOO_SHORT") return "weak";
  return "generic";
}
