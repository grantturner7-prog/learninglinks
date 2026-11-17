import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FaqList } from "@/components/faq-list";
import { LinkSays } from "@/components/home/link-says";
import { Phrases } from "@/components/home/phrases";
import { PriceCard } from "@/components/home/price-card";
import { SampleCard } from "@/components/home/sample-card";
import { StepCards } from "@/components/home/step-cards";
import { Icon } from "@/components/journey/icons";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "forSchools.meta" });
  return { title: t("title"), description: t("description") };
}

export default async function ForSchoolsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("forSchools");
  const bullets = [t("price.b1"), t("price.b2"), t("price.b3"), t("price.b4")];
  const steps = [{ body: t("how.s1") }, { body: t("how.s2") }, { body: t("how.s3") }];
  const faq = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
  ];

  return (
    <>
      <section className="py-8 sm:py-14">
        <div className="container-page grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.92fr)] lg:gap-12">
          <div className="flex flex-col gap-6">
            <LinkSays tone="paper">{t("say")}</LinkSays>
            <div>
              <span className="badge">{t("eyebrow")}</span>
              <h1 className="mt-4 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[56px]"><Phrases text={t("title")} /></h1>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-700">{t("lead")}</p>
            </div>
            <div className="flex flex-col gap-3">
              <SampleCard view="school" />
              <p className="flex items-start gap-2.5 text-sm font-medium text-ink-700">
                <Icon name="lock" size={16} className="mt-1 flex-none text-brand-700" />
                {t("sampleNote")}
              </p>
            </div>
          </div>
          <PriceCard
            kind="school"
            tint="bg-accent-300"
            label={t("price.label")}
            amount={t("price.amount")}
            per={t("price.per")}
            note={t("price.note")}
            bullets={bullets}
            href="/sign-up?type=school"
            cta={t("cta")}
            ctaNote={t("ctaNote")}
          />
        </div>
      </section>

      <section aria-labelledby="how-h" className="py-8 sm:py-12">
        <div className="container-page">
          <h2 id="how-h" className="mb-7 text-balance text-3xl font-extrabold tracking-tight sm:text-4xl"><Phrases text={t("how.title")} /></h2>
          <StepCards steps={steps} />
        </div>
      </section>

      <section aria-labelledby="faq-h" className="py-8 sm:py-12">
        <div className="container-page max-w-3xl">
          <h2 id="faq-h" className="mb-5 text-3xl font-extrabold tracking-tight sm:text-4xl">{t("faq.title")}</h2>
          <FaqList items={faq} />
        </div>
      </section>

      <section className="pb-6 pt-2 sm:pb-10">
        <div className="container-page flex flex-col items-center gap-5 text-center">
          <LinkSays>{t("final.say")}</LinkSays>
          <Link href="/sign-up?type=school" className="btn btn-primary btn-lg">
            {t("cta")}
            <Icon name="arrowR" size={18} />
          </Link>
          <p className="max-w-md text-[13.5px] text-ink-700">{t("ctaNote")}</p>
        </div>
      </section>
    </>
  );
}
