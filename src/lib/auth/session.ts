import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "@/lib/auth";
import type { AccountType } from "@/lib/db/schema/auth";
import { getEnv } from "@/lib/env";
import { redirect } from "@/i18n/navigation";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  accountType: AccountType;
  isAdmin: boolean;
}

/** Admin = verified email that appears in ADMIN_EMAILS. Nothing about admin is stored in the database. */
export function isAdminEmail(email: string, emailVerified: boolean, adminEmails = getEnv().ADMIN_EMAILS): boolean {
  return emailVerified && adminEmails.includes(email.trim().toLowerCase());
}

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { accountType?: AccountType };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    accountType: u.accountType ?? "educator",
    isAdmin: isAdminEmail(u.email, u.emailVerified),
  };
});

/** Only same-site relative paths are allowed as post-login destinations (prevents open redirects). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

export async function requireUser(locale: string, next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const href = next ? `/sign-in?next=${encodeURIComponent(safeNext(next))}` : "/sign-in";
    return redirect({ href, locale });
  }
  return user;
}

export async function requireAccountType(locale: string, types: readonly AccountType[], next?: string): Promise<CurrentUser> {
  const user = await requireUser(locale, next);
  if (!types.includes(user.accountType) && !user.isAdmin) return redirect({ href: "/dashboard", locale });
  return user;
}

export async function requireAdmin(locale: string): Promise<CurrentUser> {
  const user = await requireUser(locale);
  if (!user.isAdmin) return redirect({ href: "/", locale });
  return user;
}
