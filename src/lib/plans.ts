import type { CountryCode } from "@/lib/countries";
import { COUNTRIES } from "@/lib/countries";

export type PlanCode = "school_tw" | "family_tw";

export interface Plan {
  code: PlanCode;
  audience: "school" | "family";
  countryCode: CountryCode;
  /**
   * Price for one 12-month term, in the currency's major unit, VAT INCLUDED (confirmed by the owner,
   * 17 Nov 2026). Schools: NT$10,000 PER CAMPUS, for that campus's own full 12 months. Families: NT$2,000.
   */
  listPrice: number;
  /** true = the price is charged once per campus (schools). There is no discount for extra campuses. */
  perCampus: boolean;
  /** false = cannot be bought yet. Both Taiwan plans are open at launch. */
  available: boolean;
}

export const TERM_MONTHS = 12;

export const PLANS: Record<PlanCode, Plan> = {
  school_tw: { code: "school_tw", audience: "school", countryCode: "TW", listPrice: 10_000, perCampus: true, available: true },
  family_tw: { code: "family_tw", audience: "family", countryCode: "TW", listPrice: 2_000, perCampus: false, available: true },
};

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === "string" && v in PLANS;
}

export function planFor(audience: Plan["audience"], country: CountryCode): Plan | undefined {
  return Object.values(PLANS).find((p) => p.audience === audience && p.countryCode === country);
}

/**
 * Total for the campuses bought, each for its own 12 months. Every campus costs the full list price
 * (3 campuses = 30,000). No discount and no proration: a campus added mid-year pays the full price
 * and gets its own full 12 months from the day it starts. Families always pay the list price once.
 */
export function priceForCampuses(plan: Plan, campuses = 1): number {
  if (!Number.isInteger(campuses) || campuses < 1) throw new Error("campuses must be a whole number of at least 1");
  if (!plan.perCampus) {
    if (campuses !== 1) throw new Error("This plan does not have campuses");
    return plan.listPrice;
  }
  return plan.listPrice * campuses;
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
