import type { CountryCode } from "@/lib/countries";
import { COUNTRIES } from "@/lib/countries";

export type PlanCode = "school_campus_tw" | "school_group_tw" | "family_tw";

export interface Plan {
  code: PlanCode;
  audience: "school" | "family";
  countryCode: CountryCode;
  /** List price in the currency's major unit, tax-inclusive. These are HYPOTHESES to validate, not benchmarks. */
  listPrice: number;
  seats: number;
  campuses: number;
  /** false = shown as "coming soon" and cannot be bought yet (families arrive in Phase 2). */
  available: boolean;
}

export const TERM_MONTHS = 12;

export const PLANS: Record<PlanCode, Plan> = {
  school_campus_tw: { code: "school_campus_tw", audience: "school", countryCode: "TW", listPrice: 9900, seats: 3, campuses: 1, available: true },
  school_group_tw: { code: "school_group_tw", audience: "school", countryCode: "TW", listPrice: 29900, seats: 10, campuses: 10, available: true },
  family_tw: { code: "family_tw", audience: "family", countryCode: "TW", listPrice: 790, seats: 1, campuses: 0, available: false },
};

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === "string" && v in PLANS;
}

export function plansFor(audience: Plan["audience"], country: CountryCode): Plan[] {
  return Object.values(PLANS).filter((p) => p.audience === audience && p.countryCode === country);
}

/** Price after the founding-member discount, rounded to the nearest 10 (never below 0, never above list). */
export function priceFor(plan: Plan, foundingDiscountPercent = 0): number {
  const pct = Math.min(90, Math.max(0, Math.trunc(foundingDiscountPercent)));
  if (pct === 0) return plan.listPrice;
  const discounted = (plan.listPrice * (100 - pct)) / 100;
  return Math.min(plan.listPrice, Math.max(0, Math.round(discounted / 10) * 10));
}

/** Split a tax-inclusive amount into net + tax (for invoices). net + tax always equals gross. */
export function splitTax(gross: number, vatPercent: number): { net: number; tax: number } {
  const net = Math.round(gross / (1 + vatPercent / 100));
  return { net, tax: gross - net };
}

export function currencyOf(plan: Plan): string {
  return COUNTRIES[plan.countryCode].currency;
}

export function formatMoney(amount: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}
