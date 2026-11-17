import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqList } from "@/components/faq-list";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "forFamilies.meta" });
  return { title: t("title"), description: t("description") };
}

export default async function ForFamiliesPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("forFamilies");
  const bullets = [t("price.b1"), t("price.b2"), t("price.b3"), t("price.b4")];
  const steps = [
    { t: t("how.s1t"), b: t("how.s1b") },
    { t: t("how.s2t"), b: t("how.s2b") },
    { t: t("how.s3t"), b: t("how.s3b") },
  ];
  const before = [
    { t: t("before.i1t"), b: t("before.i1b") },
    { t: t("before.i2t"), b: t("before.i2b") },
    { t: t("before.i3t"), b: t("before.i3b") },
    { t: t("before.i4t"), b: t("before.i4b") },
  ];
  const faq = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
  ];

  return (
    <>
      <section className="py-14">
        <div className="container-page grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="badge">{t("eyebrow")}</span>
            <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">{t("title")}</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-600">{t("lead")}</p>
            <p className="mt-5 text-sm text-ink-500">{t("fine")}</p>
          </div>
          <div className="card flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">{t("price.label")}</h2>
              <span className="badge-muted">12</span>
            </div>
            <p className="text-5xl font-extrabold tracking-tight text-brand-800">{t("price.amount")}</p>
            <p className="text-sm text-ink-500">{t("price.note")}</p>
            <ul className="list-disc space-y-1.5 pl-5 text-sm">
              {bullets.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <Link href="/sign-up?type=family" className="btn btn-accent btn-lg">
              {t("cta")}
            </Link>
            <p className="text-xs text-ink-500">{t("ctaNote")}</p>
          </div>
        </div>
      </section>

      <section className="border-y border-ink-100 bg-white py-14">
        <div className="container-page">
          <h2 className="text-center text-3xl font-extrabold">{t("how.title")}</h2>
          <ol className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {steps.map((s, i) => (
              <li key={s.t} className="flex flex-col gap-2.5">
                <span className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand-700 text-sm font-extrabold text-white">{i + 1}</span>
                <h3 className="text-xl font-bold">{s.t}</h3>
                <p className="text-ink-600">{s.b}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-14">
        <div className="container-page grid grid-cols-1 items-start gap-10 lg:grid-cols-2">
          <div className="flex flex-col gap-3.5">
            <h2 className="text-3xl font-extrabold">{t("before.title")}</h2>
            {before.map((b, i) => (
              <div key={b.t} className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-4">
                <span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-brand-700 text-sm font-extrabold text-white">{i + 1}</span>
                <span>
                  <b>{b.t}</b> {b.b}
                </span>
              </div>
            ))}
          </div>
          <div>
            <h2 className="mb-3 text-3xl font-extrabold">{t("faq.title")}</h2>
            <FaqList items={faq} />
          </div>
        </div>
      </section>
    </>
  );
}
