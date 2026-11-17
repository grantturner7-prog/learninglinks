import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { LinkSays } from "@/components/home/link-says";
import { Phrases } from "@/components/home/phrases";
import { Icon } from "@/components/journey/icons";
import { Link } from "@/i18n/navigation";

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
  const lists = [
    { id: "hirers", title: t("hirers.title"), items: hirers, tint: "bg-brand-100", icon: "clipboard" as const },
    { id: "educators", title: t("educators.title"), items: educators, tint: "bg-accent-300", icon: "check" as const },
  ];

  return (
    <div className="container-page py-8 sm:py-14">
      <LinkSays tone="paper" className="max-w-3xl">{t("say")}</LinkSays>
      <h1 className="mt-8 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-[56px]"><Phrases text={t("title")} /></h1>
      <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-700">{t("intro")}</p>

      <div className="mt-9 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-7">
        {lists.map(({ id, title, items, tint, icon }) => (
          <section key={id} aria-labelledby={`${id}-h`} className={`rounded-[36px] p-6 shadow-soft sm:rounded-[44px] sm:p-9 ${tint}`}>
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-paper/85 text-brand-800">
                <Icon name={icon} size={24} />
              </span>
              <h2 id={`${id}-h`} className="text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">{title}</h2>
            </div>
            <ol className="mt-6 flex flex-col gap-3">
              {items.map((item, i) => (
                <li key={item} className="flex items-start gap-4 rounded-[24px] bg-paper/85 p-4">
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-brand-900 text-base font-extrabold text-white">{i + 1}</span>
                  <span className="pt-1 leading-relaxed">{item}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3 text-center">
        <Link href="/" className="btn btn-secondary btn-lg">
          <Icon name="arrowL" size={18} />
          {t("back")}
        </Link>
      </div>
    </div>
  );
}
