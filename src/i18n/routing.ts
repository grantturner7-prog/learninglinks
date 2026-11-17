import { defineRouting } from "next-intl/routing";
import { DEFAULT_LOCALE, ENABLED_LOCALES } from "@/lib/countries";

/** Locales are "<language>-<COUNTRY>". Only enabled countries are routable (Phase 1: zh-TW, en-TW). */
export const routing = defineRouting({
  locales: ENABLED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "always",
});
