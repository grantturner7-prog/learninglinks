import { getFormatter, getTranslations } from "next-intl/server";
import { areaLabel } from "@/lib/geo-labels";
import type { Audience, EducatorCardDto } from "@/lib/visibility";
import type { Subject } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";

const initials = (n: string) => [...n.trim()].slice(0, 2).join("").toUpperCase() || "·";

/** The soft band behind the picture alternates down the list, so neighbouring cards are easy to tell apart. */
const BANDS = ["bg-accent-300", "bg-ink-100"] as const;

/**
 * One educator as a member sees it: a card with the picture on top, as on a familiar booking site. Takes only the
 * audience-projected DTO, never a raw profile: a rate is there for families only, and "open to" is this audience's
 * side only.
 */
export async function EducatorCard({ e, locale, href, audience, index = 0 }: { e: EducatorCardDto; locale: string; href: string; audience: Audience; index?: number }) {
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
    <article className="flex flex-col overflow-hidden rounded-[22px] border border-ink-100 bg-paper shadow-card">
      <div aria-hidden className={`h-[72px] ${BANDS[index % BANDS.length]}`} />
      <div className="-mt-12 px-4 sm:px-5">
        {e.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, gated, already-resized photo
          <img src={`/api/photos/${e.id}`} alt="" width={96} height={96} className="h-24 w-24 rounded-full object-cover ring-4 ring-paper" />
        ) : (
          <span aria-hidden className="inline-flex h-24 w-24 items-center justify-center rounded-full bg-ink-900 text-3xl font-extrabold text-white ring-4 ring-paper">{initials(e.displayName)}</span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-2.5 sm:px-5 sm:pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="min-w-0 text-[19px] font-extrabold leading-snug"><Link href={href} className="no-underline hover:underline">{e.displayName}</Link></h3>
          {rate ? (
            <p className="whitespace-nowrap text-base font-extrabold">
              {rate} <span className="text-[13px] font-semibold text-ink-600">{t("perHour")}</span>
            </p>
          ) : null}
        </div>
        {e.headline ? <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-ink-900">{e.headline}</p> : null}
        <p className="text-[13px] font-semibold leading-snug text-ink-600">{facts.join(" · ")}</p>
        <div className="mb-3 mt-1 flex flex-wrap gap-1.5">
          {e.subjects.slice(0, 4).map((s) => <span key={s} className="badge-muted">{tt(`subjects.${s as Subject}`)}</span>)}
          {e.subjects.length > 4 ? <span className="badge-muted">+{e.subjects.length - 4}</span> : null}
          {audience === "school" ? e.openTo.map((o) => <span key={o} className="badge">{tt(`openTo.${o}`)}</span>) : null}
        </div>
        <Link href={href} className="btn btn-secondary mt-auto w-full" aria-label={t("viewOf", { name: e.displayName })}>{t("view")}</Link>
      </div>
    </article>
  );
}
