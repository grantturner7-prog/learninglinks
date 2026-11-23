import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { requireCountryMap } from "@/lib/geo";
import { cityLabel } from "@/lib/geo-labels";
import type { SchoolDetail } from "@/lib/jobs/service";
import { Link } from "@/i18n/navigation";

/**
 * What an educator sees after tapping a school on the map: a picture of the establishment (never people), its name,
 * what kind of school it is and where it is. Contact details are not here: a school enters its own when it joins.
 * `actions` is the report button, `children` the school's open job posts.
 */
export async function SchoolCard({ school, locale, closeHref, actions, children }: { school: SchoolDetail; locale: string; closeHref: string; actions?: ReactNode; children?: ReactNode }) {
  const tm = await getTranslations("jobs.map");
  const tt = await getTranslations("taxonomy");
  const tb = await getTranslations("school.bilingual");
  const zh = locale.startsWith("zh");
  const area = school.district
    ? zh
      ? `${cityLabel(school.city, locale)}${requireCountryMap("TW").longLabel(school.district, locale)}`
      : `${requireCountryMap("TW").longLabel(school.district, locale)}, ${cityLabel(school.city, locale)}`
    : cityLabel(school.city, locale);
  const p = school.photo;

  return (
    <div className="card mt-4" data-testid="school-card">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <figure className="m-0">
          {p ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- an already-resized WebP served by our own gated route */}
              <img
                src={`/api/schools/${school.id}/photo?v=${p.version}`}
                alt={tm("photoAlt", { name: school.name })}
                width={p.width}
                height={p.height}
                className="aspect-[16/10] w-full rounded-[24px] bg-brand-50 object-cover"
                data-testid="school-photo"
              />
              <figcaption className="mt-2 text-xs text-ink-600" data-testid="school-photo-credit">
                {p.source === "school_upload" ? (
                  tm("photoFromSchool")
                ) : (
                  <>
                    {p.author ? tm("photoBy", { author: p.author }) : tm("photoByUnknown")}
                    {p.licence ? (
                      <>
                        {" · "}
                        {p.licenceUrl ? <a className="link" href={p.licenceUrl} target="_blank" rel="noopener noreferrer nofollow">{p.licence}</a> : p.licence}
                      </>
                    ) : null}
                    {" · "}
                    {p.sourceUrl ? <a className="link" href={p.sourceUrl} target="_blank" rel="noopener noreferrer nofollow">{tm("photoVia")}</a> : tm("photoVia")}
                  </>
                )}
              </figcaption>
            </>
          ) : (
            <div className="flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-[24px] bg-brand-50 p-4 text-center" data-testid="school-no-photo">
              <svg viewBox="0 0 64 64" width="56" height="56" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="text-brand-700" aria-hidden="true">
                <path d="M8 54h48M14 54V30l18-12 18 12v24M26 54V40h12v14M32 18V8m0 0h9v6h-9" />
                <path d="M20 34h4M40 34h4M20 44h2M42 44h2" />
              </svg>
              <p className="font-bold text-ink-900">{tm("noPhoto")}</p>
              <p className="max-w-[16rem] text-sm text-ink-600">{tm("noPhotoHint")}</p>
            </div>
          )}
        </figure>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <span className="badge">{tm("selected")}</span>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight break-words" data-testid="school-name">{school.name}</h2>
              {school.nameEn && school.nameEn !== school.name ? <p className="text-ink-600">{school.nameEn}</p> : null}
              <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-600">
                <span>{tt(`schoolTypes.${school.type as "cram_school"}`)}</span>
                {school.ownership ? <span className="badge-muted">{tm(school.ownership === "public" ? "government" : "private")}</span> : null}
                {school.bilingual ? <span className="badge-muted">{tb("badge")}</span> : null}
              </p>
            </div>
            <Link href={closeHref} className="btn btn-ghost">{tm("clearSchool")}</Link>
          </div>

          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
            {school.address ? (
              <>
                <dt className="font-bold text-ink-600">{tm("address")}</dt>
                <dd className="font-semibold break-words" data-testid="school-address">{school.address}</dd>
              </>
            ) : (
              <>
                <dt className="font-bold text-ink-600">{tm("area")}</dt>
                <dd data-testid="school-area">
                  <span className="font-semibold">{area}</span>
                  <span className="block text-sm text-ink-600">{tm("areaOnly")}</span>
                </dd>
              </>
            )}
            {school.website ? (
              <>
                <dt className="font-bold text-ink-600">{tm("website")}</dt>
                <dd className="min-w-0"><a className="link break-all" href={school.website} target="_blank" rel="noopener noreferrer nofollow">{school.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></dd>
              </>
            ) : null}
          </dl>
          <p className="hint">{tm("contactLater")}</p>
          {actions ? <div className="self-start">{actions}</div> : null}
        </div>
      </div>
      {children ? <div className="mt-5 flex flex-col gap-3">{children}</div> : null}
    </div>
  );
}
