import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WaiverForm } from "@/components/educator/waiver-form";
import { EducatorSteps } from "@/components/educator/steps";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getEducatorState } from "@/lib/educators/service";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "educator.meta" });
  return { title: t("waiver"), robots: { index: false } };
}

export default async function WaiverPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = (await getCurrentUser())!;
  const t = await getTranslations("educator.waiver");
  const tc = await getTranslations("common");
  const sp = await getTranslations("educator.profile.actions");
  const state = await getEducatorState(getDb(), user.id);
  const cols = ["profile", "contact", "never"] as const;
  const counts = { profile: 6, contact: 5, never: 4 } as const;
  const badgeClass = { profile: "badge", contact: "badge-warn", never: "badge-muted" } as const;

  return (
    <div className="container-page py-10">
      <EducatorSteps waiverDone={state.waiverValid} profileDone={!!state.profile} published={state.profile?.status === "published"} />
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="flex flex-col gap-6" aria-label={t("title")}>
          <div>
            <span className="badge">{t("badge")}</span>
            <h1 className="mt-3 text-3xl font-extrabold">{t("title")}</h1>
            <p className="mt-2 max-w-2xl text-lg text-ink-600">{t("lead")}</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {cols.map((c) => (
              <div key={c} className="card">
                <span className={badgeClass[c]}>{t(`cols.${c}.badge`)}</span>
                <h2 className="mt-2.5 text-base font-bold">{t(`cols.${c}.title`)}</h2>
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                  {Array.from({ length: counts[c] }, (_, i) => (
                    <li key={i}>{t(`cols.${c}.i${i + 1}` as `cols.profile.i1`)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="card flex flex-col gap-3">
            <h2 className="text-xl font-bold">{t("who.title")}</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-brand-50 p-4"><b>{t("who.schoolsTitle")}</b><p className="mt-1 text-sm">{t("who.schoolsBody")}</p></div>
              <div className="rounded-xl bg-brand-50 p-4"><b>{t("who.familiesTitle")}</b><p className="mt-1 text-sm">{t("who.familiesBody")}</p></div>
            </div>
            <p className="text-sm text-ink-500">{t("who.between")}</p>
          </div>

          {state.waiverValid ? (
            <div className="card flex flex-wrap items-center justify-between gap-3">
              <p role="status">{t("alreadyAgreed")}</p>
              <div className="flex gap-2">
                <Link href="/educator/settings" className="btn btn-secondary">{tc("edit")} · {sp("settings")}</Link>
                <Link href="/educator/profile" className="btn btn-primary">{tc("continue")}</Link>
              </div>
            </div>
          ) : (
            <WaiverForm locale={locale} />
          )}
        </section>

        <aside className="flex flex-col gap-4" aria-label={t("side.controlTitle")}>
          <div className="rounded-2xl bg-brand-50 p-5">
            <h2 className="text-base font-bold">{t("side.controlTitle")}</h2>
            <p className="mt-2 text-sm">{t("side.controlBody")}</p>
          </div>
          <div className="card-flat rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="text-base font-bold">{t("side.recordTitle")}</h2>
            <p className="mt-2 text-sm text-ink-600">{t("side.recordBody")}</p>
          </div>
          <div className="notice-warn">{tc("draftBanner")}</div>
        </aside>
      </div>
    </div>
  );
}
