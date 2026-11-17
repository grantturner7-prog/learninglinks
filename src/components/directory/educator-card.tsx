import { getFormatter, getTranslations } from "next-intl/server";
import { areaLabel } from "@/lib/geo-labels";
import type { EducatorCardDto } from "@/lib/visibility";
import type { Subject } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";

const initials = (n: string) => [...n.trim()].slice(0, 2).join("").toUpperCase() || "·";

/** One educator as a member sees it. Takes only the audience-projected DTO, never a raw profile. */
export async function EducatorCard({ e, locale, href }: { e: EducatorCardDto; locale: string; href: string }) {
  const t = await getTranslations("directory.card");
  const tt = await getTranslations("taxonomy");
  const f = await getFormatter();
  const rate = e.rate
    ? e.rate.min !== null && e.rate.max !== null
      ? t("ratePerHour", { min: f.number(e.rate.min), max: f.number(e.rate.max) })
      : e.rate.min !== null
        ? t("rateFrom", { min: f.number(e.rate.min) })
        : t("rateUpTo", { max: f.number(e.rate.max ?? 0) })
    : null;
  return (
    <article className="card flex flex-col gap-3 p-5">
      <div className="flex items-center gap-3">
        {e.hasPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, gated, already-resized photo
          <img src={`/api/photos/${e.id}`} alt="" width={52} height={52} className="h-13 w-13 flex-none rounded-full object-cover" />
        ) : (
          <span aria-hidden className="inline-flex h-13 w-13 flex-none items-center justify-center rounded-full bg-brand-100 text-lg font-extrabold text-brand-800">{initials(e.displayName)}</span>
        )}
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold"><Link href={href} className="no-underline hover:underline">{e.displayName}</Link></h3>
          {e.headline ? <p className="truncate text-sm text-ink-600">{e.headline}</p> : null}
        </div>
      </div>
      <p className="text-sm text-ink-500">{areaLabel(e.city, e.districts, locale)}</p>
      <div className="flex flex-wrap gap-1.5">
        {e.subjects.slice(0, 5).map((s) => <span key={s} className="badge">{tt(`subjects.${s as Subject}`)}</span>)}
        {e.subjects.length > 5 ? <span className="badge-muted">+{e.subjects.length - 5}</span> : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="flex flex-wrap gap-1.5">{e.openTo.map((o) => <span key={o} className="badge-muted">{tt(`openTo.${o}`)}</span>)}</span>
        {rate ? <span className="font-semibold text-brand-800">{rate}</span> : null}
      </div>
      <Link href={href} className="btn btn-secondary w-full">{t("view")}</Link>
    </article>
  );
}
