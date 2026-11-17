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

/** One language at a time: a switch between the locales of the current country. */
export function LanguageSwitcher() {
  const current = useLocale();
  const pathname = usePathname();
  const t = useTranslations("common");
  const country = current.split("-")[1];
  const options = routing.locales.filter((l) => l.split("-")[1] === country);

  return (
    <div role="group" aria-label={t("language")} className="inline-flex overflow-hidden rounded-[10px] border border-ink-200">
      {options.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          lang={l}
          hrefLang={l}
          aria-current={l === current ? "true" : undefined}
          className="seg-link"
        >
          {labelFor(l)}
        </Link>
      ))}
    </div>
  );
}
