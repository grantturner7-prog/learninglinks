import { getTranslations } from "next-intl/server";
import { Phrases } from "@/components/home/phrases";
import { Icon } from "@/components/journey/icons";
import { LinkGuide } from "@/components/logo";
import { Link } from "@/i18n/navigation";
import en from "../../../messages/en-TW/notice.json";
import zh from "../../../messages/zh-TW/notice.json";

/**
 * Link's "before we begin, one honest thing" presentation of the compliance notice.
 * The wording is never re-written here: it is read straight from messages/<locale>/notice.json (the
 * canonical text guarded by tests/messages.test.ts), shown in both languages. The standing notice in the
 * page layout stays as well.
 */
export async function HonestNotice({ locale }: { locale: string }) {
  const t = await getTranslations("home.honest");
  const tn = await getTranslations("notice");
  const cols = [
    { lang: "en-TW", tag: "ENGLISH", text: en },
    { lang: "zh-TW", tag: "繁體中文", text: zh },
  ];
  if (locale.startsWith("zh")) cols.reverse();

  return (
    <section aria-labelledby="honest-h" className="rounded-[36px] bg-paper p-6 shadow-soft sm:rounded-[44px] sm:p-12">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:gap-6">
        <span className="flex-none"><LinkGuide size={84} /></span>
        <div className="relative rounded-[28px] bg-brand-50 px-6 py-5 sm:px-8 sm:py-6">
          <span aria-hidden className="absolute -top-1.5 left-10 h-4 w-4 rotate-45 rounded-[4px] bg-brand-50 sm:-left-1.5 sm:top-1/2 sm:-translate-y-1/2" />
          <p className="relative text-[13px] font-bold uppercase tracking-[0.08em] text-brand-700">{tn("title")}</p>
          <h2 id="honest-h" className="relative mt-2 text-balance text-3xl font-extrabold leading-tight tracking-tight sm:text-[40px]"><Phrases text={t("title")} /></h2>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-7">
        {cols.map(({ lang, tag, text }) => (
          <div key={lang} lang={lang} className="rounded-[28px] bg-ink-50 p-6 inset-ring-2 inset-ring-ink-200 sm:p-8">
            <span className="inline-flex min-h-7 items-center rounded-full bg-white px-3 text-xs font-bold tracking-[0.08em] text-brand-700">{tag}</span>
            <p className="mt-4 text-2xl font-extrabold leading-snug tracking-tight">{text.lead}</p>
            <p className="mt-3 text-[17px] leading-[1.75] text-ink-900">{text.full}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="flex items-center gap-3 text-[15px] font-medium text-ink-700">
          <Icon name="check" size={20} className="flex-none text-brand-700" />
          {t("foot")}
        </p>
        <Link href="/safety" className="btn btn-secondary">
          {t("safety")}
        </Link>
      </div>
    </section>
  );
}
