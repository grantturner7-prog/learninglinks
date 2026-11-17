"use server";

import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { allow } from "@/lib/rate-limit";
import { revealContact } from "@/lib/reveal/service";

export type RevealState =
  | { status: "idle" }
  | { status: "ok"; channels: { channel: string; value: string }[]; alreadyRevealed: boolean }
  | { status: "denied"; reason: "no_membership" | "daily_cap" | "unavailable" | "no_contacts" | "not_a_member" | "rate" | "signin" | "server" };

/** A paying member asks for this educator's contact details. Everything is decided in the reveal service. */
export async function revealContactAction(_prev: RevealState, fd: FormData): Promise<RevealState> {
  const user = await getCurrentUser();
  if (!user) return { status: "denied", reason: "signin" };
  const educatorId = fd.get("educatorId");
  if (typeof educatorId !== "string") return { status: "denied", reason: "unavailable" };
  // Beyond the daily cap, also slow down bursts so a script cannot probe ids quickly.
  if (!allow(`reveal:${user.id}`, 30, 60_000)) return { status: "denied", reason: "rate" };
  try {
    const res = await revealContact(getDb(), user, educatorId, { dailyCap: getEnv().REVEAL_DAILY_CAP });
    if (res.ok) return { status: "ok", channels: res.channels, alreadyRevealed: res.alreadyRevealed };
    return { status: "denied", reason: res.reason };
  } catch (err) {
    console.error("reveal failed", err);
    return { status: "denied", reason: "server" };
  }
}
