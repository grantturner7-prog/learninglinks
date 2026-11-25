import { getFormatter, getTranslations } from "next-intl/server";
import { areaLabel } from "@/lib/geo-labels";
import type { Audience, EducatorCardDto } from "@/lib/visibility";
import type { Subject } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";

const initials = (n: string) => [...n.trim()].slice(0, 2).join("").toUpperCase() || "·";

/**
 * One educator as a member sees it, as a row in the list beside the map. Takes only the audience-projected DTO,
 * never a raw profile: a rate is there for families only, and "open to" is this audience's side only.
 */
export async function EducatorCard({ e, locale, href, audience }: { e: EducatorCardDto; locale: string; href: string; audience: Audience }) {
  const t = await getTranslations("directory.card");
  const tt = await getTranslations("taxonomy");
  const f = await getFormatter();
  const rate = e.rate
    ? e.rate.min !== null && e.rate.max !== null
      ? t("range", { min: f.number(e.rate.min), max: f.number(e.rate.max) })
      : e.rate.min !== null
        ? t("from", { min: f.number(e.rate.min) })
        : e.rate.max !== null
          ? t("upTo", { max: f.number(e.rate.max) })
          : null
    : null;
  const facts = [
    areaLabel(e.city, e.districts, locale),
    e.experienceBand ? tt(`experience.${e.experienceBand as "5-9"}`) : "",
    e.languages.length > 0 ? t("teachesIn", { languages: f.list(e.languages.map((l) => tt(`languages.${l as "en"}`)), { type: "conjunction" }) }) : "",
  ].filter(Boolean);
  return (
    <article className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:p-5">
      <div className="flex min-w-0 flex-1 gap-4">
        {e.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, gated, already-resized photo
          <img src={`/api/photos/${e.id}`} alt="" width={76} height={76} className="h-19 w-19 flex-none rounded-[20px] object-cover" />
        ) : (
          <span aria-hidden className="inline-flex h-19 w-19 flex-none items-center justify-center rounded-[20px] bg-brand-100 text-2xl font-extrabold text-brand-800">{initials(e.displayName)}</span>
        )}
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-[19px] font-extrabold leading-snug"><Link href={href} className="no-underline hover:underline">{e.displayName}</Link></h3>
          {e.headline ? <p className="line-clamp-2 text-[15px] leading-snug text-ink-700">{e.headline}</p> : null}
          <p className="text-[13px] font-semibold leading-snug text-ink-600">{facts.join(" · ")}</p>
          <div className="mt-0.5 flex flex-wrap gap-1.5">
            {e.subjects.slice(0, 4).map((s) => <span key={s} className="badge">{tt(`subjects.${s as Subject}`)}</span>)}
            {e.subjects.length > 4 ? <span className="badge-muted">+{e.subjects.length - 4}</span> : null}
            {audience === "school" ? e.openTo.map((o) => <span key={o} className="badge-muted">{tt(`openTo.${o}`)}</span>) : null}
          </div>
        </div>
      </div>
      <div className="flex flex-none items-center justify-between gap-3 sm:flex-col sm:items-end">
        {rate ? (
          <p className="sm:text-right">
            <b className="block text-lg font-extrabold leading-tight">{rate}</b>
            <span className="text-[13px] font-semibold text-ink-600">{t("perHour")}</span>
          </p>
        ) : <span aria-hidden />}
        <Link href={href} className="btn btn-primary" aria-label={t("viewOf", { name: e.displayName })}>{t("view")}</Link>
      </div>
    </article>
  );
}
