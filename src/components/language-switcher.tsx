"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

const LABELS: Record<string, string> = { en: "EN", zh: "繁中", th: "ไทย", vi: "VI", ja: "日本語", ko: "한국어" };

function labelFor(locale: string): string {
  const [lang = locale, region] = locale.split("-");
  if (lang === "zh" && region === "CN") return "简中";
  return LABELS[lang] ?? lang.toUpperCase();
}

/**
 * One language at a time: a switch between the locales of the current country, made for the dark top bar.
 * With exactly two languages it is one link to the OTHER language; with more, a small group.
 */
export function LanguageSwitcher() {
  const current = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");
  const country = current.split("-")[1];
  const options = routing.locales.filter((l) => l.split("-")[1] === country);
  const other = options.length === 2 ? options.find((l) => l !== current) : undefined;
  const link = "inline-flex min-h-11 min-w-11 items-center justify-center rounded-[10px] px-2.5 text-sm font-bold no-underline hover:text-white";

  if (other) {
    return (
      <Link href={pathname} locale={other} lang={other} hrefLang={other} className={`${link} text-brand-200`}>
        {labelFor(other)}
      </Link>
    );
  }
  return (
    <div role="group" aria-label={t("language")} className="inline-flex">
      {options.map((l) => (
        <Link key={l} href={pathname} locale={l} lang={l} hrefLang={l} aria-current={l === current ? "true" : undefined} className={`${link} ${l === current ? "text-white underline decoration-accent-400 decoration-2 underline-offset-4" : "text-brand-200"}`}>
          {labelFor(l)}
        </Link>
      ))}
    </div>
  );
}
