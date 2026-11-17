/**
 * Country configuration. Everything that differs per market lives here, not in feature code.
 * A locale is "<language>-<COUNTRY>", e.g. "zh-TW" (Chinese for Taiwan) or "en-TW" (English for Taiwan).
 * Adding a market = add its config, messages files and legal pack, then flip `enabled`.
 */

export type CountryCode = "TW" | "TH" | "VN" | "JP" | "KR" | "CN";
export type ContactChannel = "email" | "phone" | "line" | "whatsapp" | "wechat" | "kakao" | "zalo" | "link";

export interface CountryConfig {
  code: CountryCode;
  /** Only enabled countries are routable. Phase 1 = TW. */
  enabled: boolean;
  /** Launch wave from the master plan: 1 = Taiwan, 2 = Thailand + Vietnam, 3 = Japan + Korea + China. */
  wave: 1 | 2 | 3;
  defaultLocale: string;
  locales: readonly string[];
  currency: "TWD" | "THB" | "VND" | "JPY" | "KRW" | "CNY";
  /** Minor units per major unit (TWD has none in practice). */
  currencyMinorUnit: 0 | 2;
  /** Tax rate included in consumer prices, in percent. */
  vatPercent: number;
  timezone: string;
  /** Contact channels educators can publish for members, in display order. */
  contactChannels: readonly ContactChannel[];
  /** Per-country legal gate from the master plan. Must all be true before charging in this country. */
  launchGate: {
    legalOpinionOnEmploymentAgencyRules: boolean;
    legalOpinionOnDataProtection: boolean;
    localisedLegalPages: boolean;
    paymentPathReady: boolean;
  };
}

export const COUNTRIES: Record<CountryCode, CountryConfig> = {
  TW: {
    code: "TW",
    enabled: true,
    wave: 1,
    defaultLocale: "zh-TW",
    locales: ["zh-TW", "en-TW"],
    currency: "TWD",
    currencyMinorUnit: 0,
    vatPercent: 5,
    timezone: "Asia/Taipei",
    contactChannels: ["email", "phone", "line", "whatsapp", "wechat", "link"],
    launchGate: {
      legalOpinionOnEmploymentAgencyRules: false,
      legalOpinionOnDataProtection: false,
      localisedLegalPages: false,
      paymentPathReady: false,
    },
  },
  TH: {
    code: "TH",
    enabled: false,
    wave: 2,
    defaultLocale: "th-TH",
    locales: ["th-TH", "en-TH"],
    currency: "THB",
    currencyMinorUnit: 2,
    vatPercent: 7,
    timezone: "Asia/Bangkok",
    contactChannels: ["email", "phone", "line", "whatsapp", "link"],
    launchGate: {
      legalOpinionOnEmploymentAgencyRules: false,
      legalOpinionOnDataProtection: false,
      localisedLegalPages: false,
      paymentPathReady: false,
    },
  },
  VN: {
    code: "VN",
    enabled: false,
    wave: 2,
    defaultLocale: "vi-VN",
    locales: ["vi-VN", "en-VN"],
    currency: "VND",
    currencyMinorUnit: 0,
    vatPercent: 10,
    timezone: "Asia/Ho_Chi_Minh",
    contactChannels: ["email", "phone", "zalo", "whatsapp", "link"],
    launchGate: {
      legalOpinionOnEmploymentAgencyRules: false,
      legalOpinionOnDataProtection: false,
      localisedLegalPages: false,
      paymentPathReady: false,
    },
  },
  JP: {
    code: "JP",
    enabled: false,
    wave: 3,
    defaultLocale: "ja-JP",
    locales: ["ja-JP", "en-JP"],
    currency: "JPY",
    currencyMinorUnit: 0,
    vatPercent: 10,
    timezone: "Asia/Tokyo",
    contactChannels: ["email", "phone", "line", "link"],
    launchGate: {
      legalOpinionOnEmploymentAgencyRules: false,
      legalOpinionOnDataProtection: false,
      localisedLegalPages: false,
      paymentPathReady: false,
    },
  },
  KR: {
    code: "KR",
    enabled: false,
    wave: 3,
    defaultLocale: "ko-KR",
    locales: ["ko-KR", "en-KR"],
    currency: "KRW",
    currencyMinorUnit: 0,
    vatPercent: 10,
    timezone: "Asia/Seoul",
    contactChannels: ["email", "phone", "kakao", "link"],
    launchGate: {
      legalOpinionOnEmploymentAgencyRules: false,
      legalOpinionOnDataProtection: false,
      localisedLegalPages: false,
      paymentPathReady: false,
    },
  },
  CN: {
    code: "CN",
    enabled: false,
    wave: 3,
    defaultLocale: "zh-CN",
    locales: ["zh-CN", "en-CN"],
    currency: "CNY",
    currencyMinorUnit: 2,
    vatPercent: 6,
    timezone: "Asia/Shanghai",
    contactChannels: ["email", "phone", "wechat", "link"],
    launchGate: {
      legalOpinionOnEmploymentAgencyRules: false,
      legalOpinionOnDataProtection: false,
      localisedLegalPages: false,
      paymentPathReady: false,
    },
  },
};

export const ENABLED_COUNTRIES = Object.values(COUNTRIES).filter((c) => c.enabled);
export const ENABLED_LOCALES = ENABLED_COUNTRIES.flatMap((c) => [...c.locales]);
export const DEFAULT_LOCALE = "zh-TW";

/** "zh-TW" -> "TW". Returns undefined for a locale we do not serve. */
export function countryFromLocale(locale: string): CountryCode | undefined {
  const region = locale.split("-")[1]?.toUpperCase();
  const country = region ? COUNTRIES[region as CountryCode] : undefined;
  return country?.enabled && country.locales.includes(locale) ? country.code : undefined;
}

export function languageFromLocale(locale: string): string {
  return locale.split("-")[0] ?? locale;
}

/** The country config for a locale. Throws for unserved locales, which routing already prevents. */
export function countryForLocale(locale: string): CountryConfig {
  const code = countryFromLocale(locale);
  if (!code) throw new Error(`No enabled country serves locale "${locale}"`);
  return COUNTRIES[code];
}

/** A country may only charge money once every launch-gate item is true. */
export function canChargeInCountry(code: CountryCode): boolean {
  const c = COUNTRIES[code];
  return c.enabled && Object.values(c.launchGate).every(Boolean);
}
