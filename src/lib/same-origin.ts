import { getEnv } from "@/lib/env";

/** Reject cross-site form posts to our API routes: the Origin header, when present, must be ours. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // same-origin navigations and non-browser clients; the session cookie is SameSite=Lax
  try {
    return new URL(origin).origin === new URL(getEnv().NEXT_PUBLIC_APP_URL).origin;
  } catch {
    return false;
  }
}
