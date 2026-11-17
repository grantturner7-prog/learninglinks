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

  // Phones are short of room: with exactly two languages, show one button for the OTHER language instead of both.
  const other = options.length === 2 ? options.find((l) => l !== current) : undefined;

  return (
    <>
      {other ? (
        <Link href={pathname} locale={other} lang={other} hrefLang={other} className="seg-link !min-w-11 !px-2.5 rounded-[10px] border border-ink-200 md:hidden">
          {labelFor(other)}
        </Link>
      ) : null}
      <div role="group" aria-label={t("language")} className={`inline-flex overflow-hidden rounded-[10px] border border-ink-200 ${other ? "max-md:hidden" : ""}`}>
        {options.map((l) => (
          <Link key={l} href={pathname} locale={l} lang={l} hrefLang={l} aria-current={l === current ? "true" : undefined} className="seg-link">
            {labelFor(l)}
          </Link>
        ))}
      </div>
    </>
  );
}
