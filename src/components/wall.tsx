import { getTranslations } from "next-intl/server";
import { Lock } from "@/components/icons";
import { Link } from "@/i18n/navigation";

/**
 * Nobody sees any educator without a paid membership. Everyone without an active membership gets this wall,
 * with a clearly labelled SAMPLE profile and no real educator data.
 */
export async function MembersWall() {
  const t = await getTranslations("wall");
  return (
    <div className="container-page py-12">
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 text-center">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-brand-100 bg-brand-50 text-brand-700">
          <Lock size={30} />
        </span>
        <h1 className="text-3xl font-extrabold sm:text-4xl">{t("title")}</h1>
        <p className="text-lg leading-relaxed text-ink-600">{t("lead")}</p>
      </div>

      <div className="mx-auto mt-8 grid grid-cols-1 max-w-4xl gap-5 md:grid-cols-2">
        <section className="rounded-2xl border-2 border-ink-200 bg-white p-6">
          <h2 className="text-xl font-bold">{t("school.title")}</h2>
          <p className="mt-2 text-3xl font-extrabold text-brand-800">
            {t("school.price")} <span className="text-base font-semibold text-ink-500">{t("school.per")}</span>
          </p>
          <p className="text-sm text-ink-500">{t("school.note")}</p>
          <p className="mt-3 text-sm">{t("school.body")}</p>
          <Link href="/for-schools" className="btn btn-primary mt-4 w-full">
            {t("school.cta")}
          </Link>
        </section>
        <section className="rounded-2xl border-2 border-ink-200 bg-white p-6">
          <h2 className="text-xl font-bold">{t("family.title")}</h2>
          <p className="mt-2 text-3xl font-extrabold text-brand-800">{t("family.price")}</p>
          <p className="text-sm text-ink-500">{t("family.note")}</p>
          <p className="mt-3 text-sm">{t("family.body")}</p>
          <Link href="/for-families" className="btn btn-accent mt-4 w-full">
            {t("family.cta")}
          </Link>
        </section>
      </div>

      <section className="card mx-auto mt-7 flex max-w-4xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-bold">{t("sample.title")}</h2>
          <span className="badge-warn">{t("sample.badge")}</span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-xl border border-ink-200 p-3.5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-full bg-rose-100 text-lg font-extrabold text-[#8a2447]">S</span>
            <div>
              <div className="font-bold">{t("sample.name")}</div>
              <div className="text-sm text-ink-500">{t("sample.line")}</div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-ink-300 bg-ink-50 px-3.5 py-2.5 text-sm text-ink-600">
            <Lock size={16} />
            {t("sample.locked")}
          </div>
        </div>
      </section>

      <p className="mx-auto mt-6 max-w-xl text-center text-sm text-ink-500">
        <b>{t("why.title")}</b> {t("why.body")}
      </p>
    </div>
  );
}
