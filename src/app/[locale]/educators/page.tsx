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
  const t = await getTranslations("directory");
  const tt = await getTranslations("taxonomy");
  const tc = await getTranslations("common");
  const f = await getFormatter();

  const districtsByCity: Record<string, FilterOption[]> = {};
  for (const d of DISTRICTS) (districtsByCity[d.city] ??= []).push({ key: d.key, label: districtLabel(d.key, locale) });
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const filterParams: Record<string, string> = {};
  for (const [k, v] of Object.entries(filters)) if (v && k !== "page") filterParams[k] = String(v);
  const withView = (extra: Record<string, string> = {}, v: "map" | "list" = view) => {
    const q = new URLSearchParams({ ...filterParams, ...extra });
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

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 text-ink-600">{t(`audience.${audience}`)}</p>
        </div>
        <div role="group" aria-label={t("view.list") + " / " + t("view.map")} className="inline-flex overflow-hidden rounded-[10px] border border-ink-200">
          <Link href={withView({}, "map")} className="seg-link" aria-current={view === "map" ? "true" : undefined}>{t("view.map")}</Link>
          <Link href={withView({}, "list")} className="seg-link" aria-current={view === "list" ? "true" : undefined}>{t("view.list")}</Link>
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside>
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
        </aside>
        <section aria-label={t("title")} className="min-w-0">
          {mapLabels ? (
            <div className="mb-5">
              <AreaMapPanel bubbles={bubbles} selectedKey={selectedKey} locale={locale} labels={mapLabels} params={{ ...filterParams }} />
              <p className="mt-2 text-sm text-ink-500">{t("map.areaHint")} · {t("map.mapSummary", { count: mapTotal })}</p>
              {selectedKey ? (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {t("map.area", { area: filters.district ? districtLabel(filters.district, locale) : cityLabel(filters.city, locale) })}
                  <Link href={clearAreaHref} className="link font-normal">{t("map.clearArea")}</Link>
                </p>
              ) : null}
              <h2 className="mt-4 text-lg font-bold">{t("map.listTitle")}</h2>
            </div>
          ) : null}
          <p className="mb-3 text-sm text-ink-500" aria-live="polite">{tc("results", { count: result.total })}</p>
          {result.items.length === 0 ? (
            <div className="card text-center"><h2 className="text-xl font-bold">{t("empty.title")}</h2><p className="mt-1 text-ink-600">{t("empty.body")}</p></div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {result.items.map((e) => <EducatorCard key={e.id} e={e} locale={locale} href={`/educators/${e.id}`} />)}
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
      </div>
    </div>
  );
}
