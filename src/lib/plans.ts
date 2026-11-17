import type { CountryCode } from "@/lib/countries";
import { COUNTRIES } from "@/lib/countries";

export type PlanCode = "school_tw" | "family_tw";

export interface Plan {
  code: PlanCode;
  audience: "school" | "family";
  countryCode: CountryCode;
  /**
   * Flat price for one 12-month term, in the currency's major unit.
   * Set by the owner on 17 Nov 2026: schools NT$10,000, families NT$2,000.
   * ASSUMED tax-inclusive (5% VAT included). Confirm with the accountant before launch.
   */
  listPrice: number;
  /** false = shown as "coming soon" and cannot be bought yet (families arrive in Phase 2). */
  available: boolean;
}

export const TERM_MONTHS = 12;

export const PLANS: Record<PlanCode, Plan> = {
  school_tw: { code: "school_tw", audience: "school", countryCode: "TW", listPrice: 10_000, available: true },
  family_tw: { code: "family_tw", audience: "family", countryCode: "TW", listPrice: 2_000, available: false },
};

export function isPlanCode(v: unknown): v is PlanCode {
  return typeof v === "string" && v in PLANS;
}

export function planFor(audience: Plan["audience"], country: CountryCode): Plan | undefined {
  return Object.values(PLANS).find((p) => p.audience === audience && p.countryCode === country);
}

/** Price to charge. Prices are flat: a discount applies only if the owner explicitly configures one. */
export function priceFor(plan: Plan, discountPercent = 0): number {
  const pct = Math.min(90, Math.max(0, Math.trunc(discountPercent)));
  if (pct === 0) return plan.listPrice;
  return Math.min(plan.listPrice, Math.max(0, Math.round((plan.listPrice * (100 - pct)) / 100 / 10) * 10));
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
