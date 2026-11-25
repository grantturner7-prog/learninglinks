import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { RevealPanel, type RevealLabels } from "@/components/directory/reveal-panel";
import { Icon } from "@/components/journey/icons";
import { ReportButton } from "@/components/report/report-button";
import { MembersWall } from "@/components/wall";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getEducatorForAudience, getMemberAudience } from "@/lib/directory/service";
import { getEnv } from "@/lib/env";
import { getReportLabels } from "@/lib/report-labels";
import { revealsLeftToday } from "@/lib/reveal/service";
import { areaLabel, cityLabel, districtLabel } from "@/lib/geo-labels";
import type { Subject } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string; id: string }> };

export const metadata: Metadata = { robots: { index: false, follow: false } };

const initials = (n: string) => [...n.trim()].slice(0, 2).join("").toUpperCase() || "·";

/**
 * One educator, for a paying member of the right audience. Anyone else sees the same members-only wall,
 * whether or not the educator exists, so a shared link reveals nothing. There is no public profile page.
 */
export default async function EducatorDetailPage({ params }: Props) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  const user = await getCurrentUser();
  const db = getDb();
  const audience = user ? await getMemberAudience(db, user) : null;
  if (!audience) return <MembersWall />;
  const e = await getEducatorForAudience(db, audience, id);
  if (!e) notFound();

  const t = await getTranslations("directory.detail");
  const tcard = await getTranslations("directory.card");
  const tt = await getTranslations("taxonomy");
  const tc = await getTranslations("common");
  const tn = await getTranslations("notice");
  const f = await getFormatter();
  const tr = await getTranslations("reveal");
  const used = await revealsLeftToday(db, user!, getEnv().REVEAL_DAILY_CAP);
  const revealLabels: RevealLabels = {
    button: tr("button"), working: tr("working"), intro: tr("intro", { name: e.displayName }), left: tr("left", { used: used.used, cap: used.cap }), resets: tr("resets"), again: tr("again"), care: tr("careSchool"),
    channels: Object.fromEntries((["email", "line", "whatsapp", "wechat", "phone"] as const).map((c) => [c, tr(`channels.${c}`)])),
    denied: Object.fromEntries((["no_membership", "daily_cap", "unavailable", "no_contacts", "not_a_member", "rate", "signin", "server"] as const).map((r) => [r, tr(`denied.${r}`)])),
  };
  // The same wording as on the list: "NT$600–900", "From NT$600" or "Up to NT$900".
  const rate = e.rate
    ? e.rate.min !== null && e.rate.max !== null
      ? tcard("range", { min: f.number(e.rate.min), max: f.number(e.rate.max) })
      : e.rate.min !== null
        ? tcard("from", { min: f.number(e.rate.min) })
        : e.rate.max !== null
          ? tcard("upTo", { max: f.number(e.rate.max) })
          : null
    : null;
  const zh = locale.startsWith("zh");
  const join = (items: string[]) => items.join(zh ? "、" : ", ");
  // The facts under the name. Only what this audience was given: see projectEducatorForAudience.
  const facts: Array<[label: string, value: string]> = (
    [
      [t("where"), areaLabel(e.city, e.districts, locale)],
      [t("experience"), e.experienceBand ? tt(`experience.${e.experienceBand as "5-9"}`) : ""],
      [t("languages"), join(e.languages.map((s) => tt(`languages.${s as "en"}`)))],
      [t("modes"), join(e.teachingModes.map((s) => tt(`modes.${s as "online"}`)))],
    ] as Array<[string, string]>
  ).filter(([, v]) => v);
  const places = (e.districts.length > 0 ? e.districts.map((d) => districtLabel(d, locale)) : [cityLabel(e.city, locale)]).filter(Boolean);
  const chips = (label: string, items: string[], tone: string) =>
    items.length > 0 ? (
      <section className="card flex flex-col gap-3">
        <h2 className="text-[19px] font-extrabold tracking-tight">{label}</h2>
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <span key={i} className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${tone}`}>{i}</span>
          ))}
        </div>
      </section>
    ) : null;

  return (
    <div className="container-wide max-w-[1260px] py-5">
      <Link href="/educators" className="inline-flex min-h-11 items-center gap-2 text-[15px] font-bold text-brand-700 no-underline hover:underline">
        <Icon name="arrowL" size={18} />
        {t("backArea")}
      </Link>
      {/* On a phone: who they are, then how to reach them, then the detail. From lg up the contact card stays beside it all. */}
      <article className="mt-2 grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr] lg:gap-6">
        <header className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-7 lg:col-start-1">
          {e.hasPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, gated, already-resized photo
            <img src={`/api/photos/${e.id}`} alt="" width={156} height={156} className="h-39 w-39 flex-none rounded-[36px] object-cover" />
          ) : (
            <span aria-hidden className="inline-flex h-39 w-39 flex-none items-center justify-center rounded-[36px] bg-brand-100 text-5xl font-extrabold text-brand-800">{initials(e.displayName)}</span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight break-words sm:text-[42px]">{e.displayName}</h1>
            {e.headline ? <p className="mt-2 text-lg leading-snug text-ink-700 sm:text-[19px]">{e.headline}</p> : null}
            <dl className="mt-4 grid grid-cols-2 gap-2.5">
              {facts.map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-brand-50 px-3.5 py-2.5">
                  <dt className="text-xs font-bold text-ink-600">{label}</dt>
                  <dd className="text-[15px] font-extrabold leading-snug break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <aside className="flex flex-col gap-5 lg:sticky lg:top-4 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          <section className="flex flex-col gap-4 rounded-[28px] bg-brand-900 p-6 text-white shadow-soft sm:p-7">
            <p className="text-[13px] font-extrabold uppercase tracking-[0.05em] text-accent-300">{audience === "family" ? t("contactFamily") : t("contactSchool")}</p>
            {audience === "family" ? (
              rate ? (
                <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 leading-none">
                  <b className="text-4xl font-extrabold tracking-tight">{rate}</b>
                  <span className="text-[15px] font-semibold text-brand-200">{tcard("perHour")}</span>
                </p>
              ) : (
                <p className="text-xl font-extrabold">{t("rateNone")}</p>
              )
            ) : (
              <p className="text-2xl font-extrabold leading-tight tracking-tight">{e.openTo.map((s) => tt(`openTo.${s}`)).join(" · ")}</p>
            )}
            <RevealPanel educatorId={e.id} labels={revealLabels} />
          </section>

          <section className="card flex flex-col gap-3">
            <h2 className="text-[19px] font-extrabold tracking-tight">{t("whereTitle", { name: e.displayName })}</h2>
            <ul className="flex flex-wrap gap-2">
              {places.map((d) => (
                <li key={d} className="inline-flex items-center gap-1.5 rounded-full bg-accent-300 px-3.5 py-1.5 text-sm font-extrabold text-ink-900">
                  <Icon name="pin" size={16} />
                  {d}
                </li>
              ))}
            </ul>
            <p className="text-[13.5px] leading-relaxed text-ink-600">
              {e.districts.length > 0 && e.city ? `${cityLabel(e.city, locale)}${zh ? "。" : ". "}` : ""}
              {t("districtOnly")}
            </p>
          </section>

          {audience === "family" ? <p className="rounded-[20px] bg-brand-50 px-5 py-3.5 text-[13.5px] leading-relaxed text-brand-800">{tn("tutoringWork")}</p> : null}
          <div className="px-1">
            <ReportButton targetType="educator" targetId={e.id} labels={await getReportLabels("educator")} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-5 lg:col-start-1">
          {e.bio ? (
            <section className="card flex flex-col gap-2.5">
              <h2 className="text-[21px] font-extrabold tracking-tight">{t("aboutName", { name: e.displayName })}</h2>
              <p className="max-w-[62ch] whitespace-pre-line text-[17px] leading-[1.7] text-ink-900">{e.bio}</p>
            </section>
          ) : null}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {chips(t("subjects"), e.subjects.map((s) => tt(`subjects.${s as Subject}`)), "bg-brand-100 text-brand-800")}
            {chips(t("levels"), e.levels.map((s) => tt(`levels.${s as "kindergarten"}`)), "bg-accent-300 text-warn-700")}
          </div>
          {e.workAuthorization ? (
            <section className="card flex flex-col gap-1.5">
              <h2 className="text-[19px] font-extrabold tracking-tight">
                {t("workAuth")} <span className="badge-warn ml-1 align-middle">{tc("selfDeclared")}</span>
              </h2>
              <p className="font-semibold">{tt(`workAuth.${e.workAuthorization as "citizen_or_pr"}`)}</p>
              <p className="text-[13.5px] text-ink-600">{t("workAuthNote")}</p>
            </section>
          ) : null}
          {e.credentials.length > 0 ? (
            <section className="card flex flex-col gap-3">
              <h2 className="text-[19px] font-extrabold tracking-tight">
                {t("credentials")} <span className="badge-warn ml-1 align-middle">{tc("selfDeclared")}</span>
              </h2>
              <ul className="flex flex-col divide-y divide-ink-100">
                {e.credentials.map((c, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 py-2.5 first:pt-0 last:pb-0">
                    <span className="font-bold">
                      {c.label}
                      {c.year ? `, ${c.year}` : ""}
                    </span>
                    {c.proofUrl ? (
                      <a className="link text-sm" href={c.proofUrl} target="_blank" rel="noopener noreferrer nofollow">
                        {t("proof")}
                      </a>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="text-[13.5px] text-ink-600">{t("selfDeclared")}</p>
            </section>
          ) : null}
        </div>
      </article>
    </div>
  );
}
