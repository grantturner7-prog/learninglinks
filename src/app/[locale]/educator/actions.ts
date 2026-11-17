"use server";

import { hasLocale } from "next-intl";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import type { PublishBlocker } from "@/lib/educators/completeness";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { buildWaiverSnapshot } from "@/lib/consent/waiver-text";
import { hashIp, readWaiverItems } from "@/lib/consent/waiver";
import { getDb } from "@/lib/db";
import { parseProfileForm, type FieldErrors, type ProfileInput } from "@/lib/educators/profile-input";
import { deleteEducatorData, hasValidWaiver, hideProfile, publishProfile, recordWaiver, saveProfile, withdrawWaiver } from "@/lib/educators/service";
import { getEnv } from "@/lib/env";
import { deletePhoto } from "@/lib/uploads/photos";
import { redirect } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

async function educator(): Promise<CurrentUser | null> {
  const u = await getCurrentUser();
  return u && u.accountType === "educator" ? u : null;
}
const localeOf = (v: FormDataEntryValue | null) => (typeof v === "string" && hasLocale(routing.locales, v) ? v : routing.defaultLocale);

/* ---------- waiver ---------- */

export interface WaiverState { error?: "incomplete" | "server" }

export async function acceptWaiverAction(_prev: WaiverState, fd: FormData): Promise<WaiverState> {
  const user = await educator();
  const locale = localeOf(fd.get("locale"));
  if (!user) return { error: "server" };
  const check = readWaiverItems((n) => fd.get(n));
  if (!check.ok) return { error: "incomplete" };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
  await recordWaiver(getDb(), user.id, {
    locale,
    items: check.items,
    snapshot: await buildWaiverSnapshot(locale),
    ipHash: hashIp(ip, getEnv().BETTER_AUTH_SECRET),
  });
  revalidatePath(`/${locale}/educator`, "layout");
  return redirect({ href: "/educator/profile?step=9", locale });
}

/* ---------- profile ---------- */

export interface ProfileState {
  message?: "saved" | "published" | "unpublished" | "fix" | "server" | "suspended";
  errors?: FieldErrors;
  blockers?: PublishBlocker[];
  /** What the educator typed, so a failed save does not wipe the form. */
  values?: ProfileInput;
  /** Changes on every response so the form remounts with fresh defaults. */
  nonce?: number;
}

export async function saveProfileAction(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await educator();
  const locale = localeOf(fd.get("locale"));
  const nonce = Date.now();
  if (!user) return { message: "server", nonce };
  const { values, errors } = parseProfileForm(fd);
  if (Object.keys(errors).length > 0) return { message: "fix", errors, values, nonce };
  try {
    const db = getDb();
    const saved = await saveProfile(db, user.id, values);
    revalidatePath(`/${locale}/educator`, "layout");
    revalidatePath(`/${locale}/dashboard`);
    if (fd.get("intent") === "publish") {
      const res = await publishProfile(db, user.id);
      if (!res.ok) return { message: res.suspended ? "suspended" : "saved", blockers: res.blockers, values, nonce };
      return { message: "published", values, nonce };
    }
    return { message: saved.unpublished ? "unpublished" : "saved", values, nonce };
  } catch (err) {
    console.error("save profile failed", err);
    return { message: "server", values, nonce };
  }
}

/**
 * Last step of the guided flow: record the agreement (if it is not already on file), save the profile and
 * publish it. The agreement is recorded with the exact wording of the waiver as shown on that step.
 */
export async function publishJourneyAction(_prev: ProfileState, fd: FormData): Promise<ProfileState> {
  const user = await educator();
  const locale = localeOf(fd.get("locale"));
  const nonce = Date.now();
  if (!user) return { message: "server", nonce };
  const { values, errors } = parseProfileForm(fd);
  if (Object.keys(errors).length > 0) return { message: "fix", errors, values, nonce };
  try {
    const db = getDb();
    if (!(await hasValidWaiver(db, user.id))) {
      const check = readWaiverItems((n) => fd.get(n));
      if (!check.ok) return { message: "fix", blockers: ["waiver"], values, nonce };
      const h = await headers();
      const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip");
      await recordWaiver(db, user.id, { locale, items: check.items, snapshot: await buildWaiverSnapshot(locale), ipHash: hashIp(ip, getEnv().BETTER_AUTH_SECRET) });
    }
    await saveProfile(db, user.id, values);
    const res = await publishProfile(db, user.id);
    revalidatePath(`/${locale}/educator`, "layout");
    revalidatePath(`/${locale}/dashboard`);
    if (!res.ok) return { message: res.suspended ? "suspended" : "saved", blockers: res.blockers, values, nonce };
    return { message: "published", values, nonce };
  } catch (err) {
    console.error("publish failed", err);
    return { message: "server", values, nonce };
  }
}

/* ---------- settings ---------- */

export async function hideProfileAction(fd: FormData): Promise<void> {
  const user = await educator();
  const locale = localeOf(fd.get("locale"));
  if (user) await hideProfile(getDb(), user.id);
  revalidatePath(`/${locale}/educator`, "layout");
  return redirect({ href: "/educator/settings?done=hidden", locale });
}

export async function withdrawWaiverAction(fd: FormData): Promise<void> {
  const user = await educator();
  const locale = localeOf(fd.get("locale"));
  if (user) await withdrawWaiver(getDb(), user.id);
  revalidatePath(`/${locale}/educator`, "layout");
  return redirect({ href: "/educator/settings?done=withdrawn", locale });
}

export async function deleteProfileAction(fd: FormData): Promise<void> {
  const user = await educator();
  const locale = localeOf(fd.get("locale"));
  if (user) {
    const { photoKey } = await deleteEducatorData(getDb(), user.id);
    await deletePhoto(photoKey);
  }
  revalidatePath(`/${locale}/educator`, "layout");
  return redirect({ href: "/educator/settings?done=deleted", locale });
}

export interface DeleteAccountState { error?: "wrongPassword" | "server" }

export async function deleteAccountAction(_prev: DeleteAccountState, fd: FormData): Promise<DeleteAccountState> {
  const user = await educator();
  const locale = localeOf(fd.get("locale"));
  const password = fd.get("password");
  if (!user || typeof password !== "string" || password.length === 0) return { error: "wrongPassword" };
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
