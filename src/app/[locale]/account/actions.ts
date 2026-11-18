"use server";

import { hasLocale } from "next-intl";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth/session";
import { allow } from "@/lib/rate-limit";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

export interface DeleteAccountState { error?: "wrongPassword" | "server" }

/**
 * Delete my account (schools and families; educators use their settings page, which also removes the profile photo).
 * The password is required. prepareAccountDeletion (run by the auth library just before the delete) cancels unpaid
 * orders, erases the invoice email and releases campuses nobody else is linked to.
 */
export async function deleteMyAccountAction(_prev: DeleteAccountState, fd: FormData): Promise<DeleteAccountState> {
  const user = await getCurrentUser();
  const loc = fd.get("locale");
  const locale = typeof loc === "string" && hasLocale(routing.locales, loc) ? loc : routing.defaultLocale;
  const password = fd.get("password");
  if (!user || typeof password !== "string" || password.length === 0) return { error: "wrongPassword" };
  if (!allow(`delete:${user.id}`, 5, 15 * 60_000)) return { error: "wrongPassword" };
  try {
    await getAuth().api.deleteUser({ body: { password }, headers: await headers() });
  } catch (err) {
    const status = typeof err === "object" && err && "status" in err ? String((err as { status: unknown }).status) : "";
    if (status === "BAD_REQUEST" || status === "UNAUTHORIZED" || status === "FORBIDDEN") return { error: "wrongPassword" };
    console.error("delete account failed", err);
    return { error: "server" };
  }
  return redirect({ href: "/", locale });
}
