import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "safety.meta" });
  return { title: t("title"), description: t("description") };
}

export default async function SafetyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("safety");
  const hirers = [t("hirers.h1"), t("hirers.h2"), t("hirers.h3"), t("hirers.h4"), t("hirers.h5")];
  const educators = [t("educators.e1"), t("educators.e2"), t("educators.e3"), t("educators.e4"), t("educators.e5")];

  return (
    <div className="container-page max-w-3xl py-12">
      <h1 className="text-4xl font-extrabold">{t("title")}</h1>
      <p className="mt-3 text-lg text-ink-600">{t("intro")}</p>
      <section className="card mt-8">
        <h2 className="text-2xl font-bold">{t("hirers.title")}</h2>
        <ol className="mt-4 list-decimal space-y-2.5 pl-6">
          {hirers.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ol>
      </section>
      <section className="card mt-6">
        <h2 className="text-2xl font-bold">{t("educators.title")}</h2>
        <ol className="mt-4 list-decimal space-y-2.5 pl-6">
          {educators.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
