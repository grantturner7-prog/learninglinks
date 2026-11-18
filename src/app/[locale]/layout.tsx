import "../globals.css";
import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { ComplianceNotice } from "@/components/compliance-notice";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteUrl } from "@/lib/site-url";
import { routing } from "@/i18n/routing";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.meta" });
  return {
    metadataBase: new URL(siteUrl()),
    title: t("title"),
    description: t("description"),
    applicationName: "LearningLinks",
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("common");
  const tn = await getTranslations("notice");
  // Client components only get the strings they use (not every page's copy).
  const all = await getMessages();
  const clientMessages = {
    common: all.common,
    nav: all.nav,
    auth: all.auth,
    notice: all.notice,
    home: { waitlist: all.home.waitlist },
    taxonomy: { countries: all.taxonomy.countries },
  };

  return (
    <html lang={locale}>
      <body className="flex min-h-dvh flex-col">
        <NextIntlClientProvider messages={clientMessages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-bold"
          >
            {t("skipToContent")}
          </a>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <section aria-label={tn("title")} className="container-page py-8">
            <ComplianceNotice />
          </section>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
