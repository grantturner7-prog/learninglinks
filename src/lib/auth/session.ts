import { headers } from "next/headers";
import { cache } from "react";
import { getAuth } from "@/lib/auth";
import { isAdminEmail, safeNext } from "@/lib/auth/helpers";
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

/** The signed-in user for this request, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  let session;
  try {
    session = await getAuth().api.getSession({ headers: await headers() });
  } catch (err) {
    // Next.js control-flow errors (dynamic rendering, redirects) carry a digest and must pass through.
    if (typeof err === "object" && err !== null && "digest" in err) throw err;
    // If the database is briefly unavailable, public pages must still render (signed out).
    console.error("getSession failed", err);
    return null;
  }
  if (!session) return null;
  const u = session.user as typeof session.user & { accountType?: AccountType };
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    accountType: u.accountType ?? "educator",
    isAdmin: isAdminEmail(u.email, u.emailVerified, getEnv().ADMIN_EMAILS),
  };
});

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
