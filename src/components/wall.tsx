import { getTranslations } from "next-intl/server";
import { SampleCard } from "@/components/home/sample-card";
import { Building, Heart, Lock } from "@/components/icons";
import { Icon } from "@/components/journey/icons";
import { Link } from "@/i18n/navigation";

/**
 * Nobody sees any educator without a paid membership. Everyone without an active membership gets this wall,
 * with a clearly labelled SAMPLE profile (one per audience, each showing only that audience's side) and no real
 * educator data.
 */
export async function MembersWall() {
  const t = await getTranslations("wall");
  return (
    <>
      <section className="border-b border-ink-100 bg-ink-50">
        <div className="container-wide flex flex-col items-start gap-4 pb-10 pt-9 sm:pb-12 sm:pt-12">
          <span className="inline-flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent-400 text-ink-900">
            <Lock size={28} />
          </span>
          <h1 className="max-w-3xl text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">{t("title")}</h1>
          <p className="max-w-2xl text-lg leading-relaxed text-ink-700">{t("lead")}</p>
        </div>
      </section>

      <div className="bg-white">
      <div className="container-wide py-10 sm:py-12">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section className="card flex flex-col gap-2 p-6 sm:p-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent-300 text-ink-900">
              <Heart size={26} />
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{t("family.title")}</h2>
            <p className="text-4xl font-extrabold tracking-tight">{t("family.price")}</p>
            <p className="text-sm font-semibold text-ink-600">{t("family.note")}</p>
            <p className="mt-2 leading-relaxed text-ink-700">{t("family.body")}</p>
            <Link href="/for-families" className="btn btn-primary btn-lg mt-auto w-full">
              {t("family.cta")}
              <Icon name="arrowR" size={18} />
            </Link>
          </section>
          <section className="card flex flex-col gap-2 p-6 sm:p-8">
            <span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-accent-300 text-ink-900">
              <Building size={26} />
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight">{t("school.title")}</h2>
            <p className="flex flex-wrap items-baseline gap-x-2.5 text-4xl font-extrabold tracking-tight">
              {t("school.price")} <span className="text-base font-semibold tracking-normal text-ink-600">{t("school.per")}</span>
            </p>
            <p className="text-sm font-semibold text-ink-600">{t("school.note")}</p>
            <p className="mt-2 leading-relaxed text-ink-700">{t("school.body")}</p>
            <Link href="/for-schools" className="btn btn-primary btn-lg mt-auto w-full">
              {t("school.cta")}
              <Icon name="arrowR" size={18} />
            </Link>
          </section>
        </div>

        <section className="mt-10">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h2 className="text-2xl font-extrabold tracking-tight">{t("sample.title")}</h2>
            <span className="badge-warn">{t("sample.badge")}</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <SampleCard view="family" />
            <SampleCard view="school" />
          </div>
          <p className="mt-4 flex items-center gap-2.5 text-sm font-semibold text-ink-700">
            <Lock size={16} className="flex-none text-brand-700" />
            {t("sample.locked")}
          </p>
        </section>

        <p className="mt-8 max-w-2xl text-[15px] leading-relaxed text-ink-700">
          <b className="text-ink-900">{t("why.title")}</b> {t("why.body")}
        </p>
      </div>
      </div>
    </>
  );
}
