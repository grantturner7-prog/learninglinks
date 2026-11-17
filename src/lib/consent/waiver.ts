import { createHash, createHmac } from "node:crypto";

/** The educator publication waiver. Bump WAIVER_VERSION whenever the wording changes. */
export const WAIVER_KEY = "educator_publication_waiver";
export const WAIVER_VERSION = "2026-11-1-draft";

/** Every required item must be ticked. The notice item is the compliance acknowledgement. */
export { WAIVER_OPTIONAL_ITEMS, WAIVER_REQUIRED_ITEMS, type WaiverItem } from "./waiver-items";
import { WAIVER_OPTIONAL_ITEMS, WAIVER_REQUIRED_ITEMS } from "./waiver-items";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

/** Keyed hash of an IP address: lets us spot abuse without storing the address itself. */
export function hashIp(ip: string | null | undefined, secret: string): string | null {
  if (!ip) return null;
  return createHmac("sha256", secret).update(ip.trim()).digest("hex").slice(0, 32);
}

export interface WaiverCheck {
  ok: boolean;
  missing: string[];
  /** Only the known items, as booleans (unknown keys in the request are dropped). */
  items: Record<string, boolean>;
}

/** Read the ticked items from a form. Only a literal "on"/"true" counts as agreement. */
export function readWaiverItems(get: (name: string) => FormDataEntryValue | null): WaiverCheck {
  const items: Record<string, boolean> = {};
  for (const k of [...WAIVER_REQUIRED_ITEMS, ...WAIVER_OPTIONAL_ITEMS]) {
    const v = get(`item_${k}`);
    items[k] = v === "on" || v === "true";
  }
  const missing = WAIVER_REQUIRED_ITEMS.filter((k) => !items[k]);
  return { ok: missing.length === 0, missing, items };
}

/** True when a stored consent still counts: current wording, not withdrawn, every required item agreed. */
export function consentIsValid(c: { documentVersion: string; withdrawnAt: Date | null; items: Record<string, boolean> }): boolean {
  if (c.withdrawnAt) return false;
  if (c.documentVersion !== WAIVER_VERSION) return false;
  return WAIVER_REQUIRED_ITEMS.every((k) => c.items[k] === true);
}

/**
 * The exact words an educator was shown, flattened to one string, so we can store them next to their
 * agreement and prove later what was accepted. `parts` are the translated strings in display order.
 */
export function waiverSnapshot(locale: string, parts: readonly string[]): string {
  return [`document:${WAIVER_KEY}`, `version:${WAIVER_VERSION}`, `locale:${locale}`, ...parts].join("\n");
}
