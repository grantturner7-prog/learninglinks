"use server";

import { getLocale } from "next-intl/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { waitlistSignups } from "@/lib/db/schema";

export type WaitlistState = { status: "idle" | "success" | "error"; error?: "email" | "generic" };

const schema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  country: z.enum(["TH", "VN", "JP", "KR", "CN"]),
  audience: z.enum(["educator", "school", "family"]),
});

/** Join the "tell me when you open in my country" list. Only countries that are not live yet. */
export async function joinWaitlist(_prev: WaitlistState, formData: FormData): Promise<WaitlistState> {
  // Honeypot: real people never fill this hidden field.
  if (String(formData.get("website") ?? "") !== "") return { status: "success" };
  const parsed = schema.safeParse({
    email: formData.get("email"),
    country: formData.get("country"),
    audience: formData.get("audience"),
  });
  if (!parsed.success) {
    return { status: "error", error: parsed.error.issues.some((i) => i.path[0] === "email") ? "email" : "generic" };
  }
  try {
    await getDb()
      .insert(waitlistSignups)
      .values({ email: parsed.data.email, countryCode: parsed.data.country, audience: parsed.data.audience, locale: await getLocale() })
      .onConflictDoNothing();
    return { status: "success" };
  } catch (err) {
    console.error("waitlist insert failed", err);
    return { status: "error", error: "generic" };
  }
}
