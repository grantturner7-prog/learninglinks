import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { AreaMapPanel } from "@/components/directory/area-map-panel";
import { EducatorCard } from "@/components/directory/educator-card";
import { DirectoryFilters, type FilterOption } from "@/components/directory/filters";
import { MembersWall } from "@/components/wall";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { parseDirectoryFilters } from "@/lib/directory/params";
import { getAreaCounts, getMemberAudience, searchEducators } from "@/lib/directory/service";
import { requireCountryMap } from "@/lib/geo";
import { CITIES, DISTRICTS } from "@/lib/geo/taiwan";
import { cityLabel, districtLabel } from "@/lib/geo-labels";
import { getMapLabels } from "@/lib/map-labels";
import { LANGUAGES, LEVELS, SUBJECTS, TEACHING_MODES } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function audienceForRequest() {
  const user = await getCurrentUser();
  return user ? getMemberAudience(getDb(), user) : null;
}

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const audience = await audienceForRequest();
  if (audience) {
    const t = await getTranslations({ locale, namespace: "directory" });
    return { title: t("meta"), robots: { index: false, follow: false } };
  }
  const t = await getTranslations({ locale, namespace: "wall.meta" });
  return { title: t("title"), description: t("description") };
}

/**
 * /educators: a paying member sees the directory for their audience; everyone else gets the members-only
 * wall with a labelled sample and no real educator data.
 */
export default async function EducatorsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const audience = await audienceForRequest();
  if (!audience) return <MembersWall />;

  const filters = parseDirectoryFilters(sp);
  const view = (Array.isArray(sp.view) ? sp.view[0] : sp.view) === "list" ? "list" : "map";
  const db = getDb();
  const result = await searchEducators(db, audience, filters);
  // The map always shows every area (so you can pick another one); only the list below narrows to the selection.
  const bubbles = view === "map" ? await getAreaCounts(db, audience, { ...filters, city: undefined, district: undefined }) : [];
  const mapLabels = view === "map" ? await getMapLabels() : null;
  const selectedKey = filters.district ?? filters.city ?? null;
  const mapTotal = bubbles.reduce((n, b) => n + b.count, 0);
  // The districts of the chosen city that have educators, most first: the same choice as tapping the map, as plain
  // links, for small districts that are hard to tap and for people who do not use the map.
  const cityDistricts = filters.city ? bubbles.filter((b) => b.level === "district" && b.key.startsWith(`${filters.city}:`)) : [];
  const t = await getTranslations("directory");
  const tt = await getTranslations("taxonomy");
  const tc = await getTranslations("common");
  const f = await getFormatter();

  const areaName = (key: string) => requireCountryMap("TW").label(key, locale);
  const areaFullName = (key: string) => requireCountryMap("TW").longLabel(key, locale);
  const districtsByCity: Record<string, FilterOption[]> = {};
  for (const d of DISTRICTS) (districtsByCity[d.city] ??= []).push({ key: d.key, label: districtLabel(d.key, locale) });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filterParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) if (v && k !== "page") filterParams[k] = String(v);
  const withView = (extra: Record<string, string> = {}, v: "map" | "list" = view) => {
    const q = new URLSearchParams({ ...filterParams, ...extra });
    for (const [k, val] of Object.entries(extra)) if (!val) q.delete(k);
    if (v === "list") q.set("view", "list");
    const s = q.toString();
    return `/educators${s ? `?${s}` : ""}`;
  };
  const clearAreaHref = (() => {
    const q = new URLSearchParams(filterParams);
    q.delete("city");
    q.delete("district");
    const qs = q.toString();
    return `/educators${qs ? `?${qs}` : ""}`;
  })();
  const href = (page: number) => {
    const q = new URLSearchParams(filterParams);
    if (view === "list") q.set("view", "list");
    if (page > 1) q.set("page", String(page));
    const s = q.toString();
    return `/educators${s ? `?${s}` : ""}`;
  };

  const tn = await getTranslations("notice");
  const listTitle = selectedKey
    ? t("map.listTitleArea", { area: !filters.district ? cityLabel(filters.city, locale) : locale.startsWith("zh") ? `${cityLabel(filters.city, locale)}${areaFullName(filters.district)}` : `${areaFullName(filters.district)}, ${cityLabel(filters.city, locale)}` })
    : t("map.listTitleAll");

  return (
    <>
      {/* Who you are looking at, and the filters, in one bar across the top. */}
      <section aria-label={t("filters.title")} className="border-b border-ink-100 bg-paper">
        <div className="container-wide flex flex-col gap-4 py-5">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight">{t(`heading.${audience}`)}</h1>
            <p className="rounded-2xl bg-brand-100 px-3.5 py-1 text-[13px] font-bold text-brand-800 sm:rounded-full">{t(`audience.${audience}`)}</p>
            <div role="group" aria-label={t("view.label")} className="ml-auto inline-flex overflow-hidden rounded-full border border-ink-200">
              <Link href={withView({}, "map")} className="seg-link px-4" aria-current={view === "map" ? "true" : undefined}>{t("view.both")}</Link>
              <Link href={withView({}, "list")} className="seg-link px-4" aria-current={view === "list" ? "true" : undefined}>{t("view.list")}</Link>
            </div>
          </div>
          <DirectoryFilters
            key={JSON.stringify(filters)}
            labels={{ title: t("filters.title"), subject: t("filters.subject"), level: t("filters.level"), city: t("filters.city"), district: t("filters.district"), language: t("filters.language"), mode: t("filters.mode"), any: t("filters.any"), apply: t("filters.apply"), clear: t("filters.clear") }}
            subjects={SUBJECTS.map((k) => ({ key: k, label: tt(`subjects.${k}`) }))}
            levels={LEVELS.map((k) => ({ key: k, label: tt(`levels.${k}`) }))}
            cities={CITIES.map((c) => ({ key: c.key, label: cityLabel(c.key, locale) }))}
            districtsByCity={districtsByCity}
            languages={LANGUAGES.map((k) => ({ key: k, label: tt(`languages.${k}`) }))}
            modes={TEACHING_MODES.map((k) => ({ key: k, label: tt(`modes.${k}`) }))}
            values={filters as Record<string, string | undefined>}
            clearHref={`/${locale}/educators${view === "list" ? "?view=list" : ""}`}
            hidden={view === "list" ? { view: "list" } : undefined}
          />
        </div>
      </section>

      {/* The list and the map, side by side: the same filters and the same area on both. On a phone the map is first. */}
      <div className={`container-wide grid grid-cols-1 items-start gap-x-7 gap-y-6 py-6 ${mapLabels ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]" : ""}`}>
        <section aria-label={t("title")} className="order-2 min-w-0 lg:order-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 className={mapLabels ? "text-[22px] font-extrabold tracking-tight" : "sr-only"} data-testid="list-title">{mapLabels ? listTitle : t("title")}</h2>
            <p className="text-sm font-semibold text-ink-600" aria-live="polite">{tc("results", { count: result.total })}</p>
            {mapLabels && selectedKey ? <Link href={clearAreaHref} scroll={false} className="link text-sm">{t("map.clearArea")}</Link> : null}
          </div>
          {audience === "family" ? <p className="mt-2 text-[13.5px] leading-relaxed text-ink-600">{tn("tutoringWork")}</p> : null}
          {result.items.length === 0 ? (
            <div className="card mt-4 text-center"><h3 className="text-xl font-bold">{t("empty.title")}</h3><p className="mt-1 text-ink-600">{t("empty.body")}</p></div>
          ) : (
            <div className={`mt-4 grid grid-cols-1 gap-3.5 ${mapLabels ? "" : "xl:grid-cols-2"}`}>
              {result.items.map((e) => <EducatorCard key={e.id} e={e} locale={locale} href={`/educators/${e.id}`} audience={audience} />)}
            </div>
          )}
          {pages > 1 ? (
            <nav className="mt-6 flex items-center justify-between" aria-label={tc("page", { page: result.page })}>
              {result.page > 1 ? <Link href={href(result.page - 1)} className="btn btn-secondary">{tc("previous")}</Link> : <span />}
              <span className="text-sm text-ink-500">{f.number(result.page)} / {f.number(pages)}</span>
              {result.page < pages ? <Link href={href(result.page + 1)} className="btn btn-secondary">{tc("next")}</Link> : <span />}
            </nav>
          ) : null}
        </section>

        {mapLabels ? (
          <aside aria-label={t("view.map")} className="order-1 min-w-0 lg:sticky lg:top-4 lg:order-2">
            <div className="rounded-[28px] border border-ink-100 bg-paper p-2.5 shadow-card sm:p-3.5">
              <AreaMapPanel bubbles={bubbles} selectedKey={selectedKey} locale={locale} labels={mapLabels} params={{ ...filterParams }} />
              <p className="px-1.5 pb-1 pt-3 text-[13.5px] text-ink-600">{t("map.areaHint")} · {t("map.mapSummary", { count: mapTotal })}</p>
            </div>
            {cityDistricts.length > 0 ? (
              <nav aria-label={t("map.districtsIn", { city: cityLabel(filters.city, locale) })} className="mt-4" data-testid="district-chips">
                <p className="text-sm font-extrabold">{t("map.districtsIn", { city: cityLabel(filters.city, locale) })}</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  <li><Link href={withView({ district: "" })} scroll={false} className="chip" aria-current={filters.district ? undefined : "true"}>{t("map.allOfCity", { city: cityLabel(filters.city, locale) })}</Link></li>
                  {cityDistricts.map((b) => (
                    <li key={b.key}><Link href={withView({ district: b.key })} scroll={false} className="chip" aria-current={filters.district === b.key ? "true" : undefined}>{areaName(b.key)} <span className="chip__n">{f.number(b.count)}</span></Link></li>
                  ))}
                </ul>
              </nav>
            ) : null}
          </aside>
        ) : null}
      </div>
    </>
  );
}
