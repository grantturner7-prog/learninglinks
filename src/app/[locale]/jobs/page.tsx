import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getCurrentUser, requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { SchoolCard } from "@/components/jobs/school-card";
import { SchoolMapPanel } from "@/components/jobs/school-map-panel";
import { getJobViewer, getSchoolWithJobs, listOpenJobs, type JobDto } from "@/lib/jobs/service";
import { getMapLabels } from "@/lib/map-labels";
import { CITIES } from "@/lib/geo/taiwan";
import { areaLabel, cityLabel } from "@/lib/geo-labels";
import { SUBJECTS, isOneOf, type Subject } from "@/lib/taxonomy";
import { canSeeJobs } from "@/lib/visibility";
import { ReportButton } from "@/components/report/report-button";
import { getReportLabels, type ReportLabels } from "@/lib/report-labels";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "jobs" });
  return { title: t("meta"), robots: { index: false, follow: false } };
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * Job posts: ONLY for signed-in educators who have a profile (owner decision, 17 Nov 2026). Everyone else
 * gets a short explanation and no job data at all.
 */
export default async function JobsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  await requireUser(locale, "/jobs");
  const user = (await getCurrentUser())!;
  const t = await getTranslations("jobs");
  const db = getDb();
  const viewer = await getJobViewer(db, user);

  if (user.accountType !== "educator") {
    return <Panel title={t("forbidden.title")} body={t("forbidden.body")} />;
  }
  if (!canSeeJobs(viewer)) {
    return <Panel title={t("needsProfile.title")} body={t("needsProfile.body")} cta={{ href: "/educator/profile", label: t("needsProfile.cta") }} />;
  }

  const type = first(sp.type) === "full_time" || first(sp.type) === "part_time" ? (first(sp.type) as "full_time" | "part_time") : undefined;
  const city = CITIES.some((c) => c.key === first(sp.city)) ? first(sp.city) : undefined;
  const subject = isOneOf(SUBJECTS, first(sp.subject)) ? (first(sp.subject) as Subject) : undefined;
  const page = Math.max(1, Math.min(999, Number(first(sp.page)) || 1));
  const result = await listOpenJobs(db, viewer, { type, city, subject, page });
  const view = first(sp.view) === "list" ? "list" : "map";
  const withJobs = first(sp.withJobs) === "1";
  const schoolId = first(sp.school);
  const school = schoolId ? await getSchoolWithJobs(db, viewer, schoolId) : null;
  const reportJobLabels = await getReportLabels("job");
  const mapLabels = view === "map" ? await getMapLabels({ attribution: (await getTranslations("jobs.map"))("attribution") }) : null;
  const tm = await getTranslations("jobs.map");
  const baseParams: Record<string, string> = {};
  if (type) baseParams.type = type;
  if (city) baseParams.city = city;
  if (withJobs) baseParams.withJobs = "1";
  const viewHref = (v: "map" | "list") => {
    const q = new URLSearchParams(baseParams);
    if (v === "list") q.set("view", "list");
    const qs = q.toString();
    return `/jobs${qs ? `?${qs}` : ""}`;
  };
  const toggleJobsHref = (() => {
    const q = new URLSearchParams(baseParams);
    if (withJobs) q.delete("withJobs");
    else q.set("withJobs", "1");
    const qs = q.toString();
    return `/jobs${qs ? `?${qs}` : ""}`;
  })();
  const tc = await getTranslations("common");
  const f = await getFormatter();
  const pages = Math.max(1, Math.ceil(result.total / result.pageSize));
  const href = (p: number) => {
    const q = new URLSearchParams();
    if (type) q.set("type", type);
    if (city) q.set("city", city);
    if (view === "list") q.set("view", "list");
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `/jobs${s ? `?${s}` : ""}`;
  };

  return (
    <div className="container-page py-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{t("title")}</h1>
          <p className="mt-1 max-w-3xl text-ink-600">{t("lead")}</p>
        </div>
        <div role="group" aria-label={`${tm("viewMap")} / ${tm("viewList")}`} className="inline-flex overflow-hidden rounded-[10px] border border-ink-200">
          <Link href={viewHref("map")} className="seg-link" aria-current={view === "map" ? "true" : undefined}>{tm("viewMap")}</Link>
          <Link href={viewHref("list")} className="seg-link" aria-current={view === "list" ? "true" : undefined}>{tm("viewList")}</Link>
        </div>
      </div>
      {mapLabels ? (
        <section className="mt-6" aria-label={tm("viewMap")}>
          <SchoolMapPanel key={withJobs ? "jobs" : "all"} selectedId={school?.id ?? null} locale={locale} labels={mapLabels} withJobs={withJobs} params={baseParams} loadError={tm("loadError")} />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-500">
            <span>{tm("mapHint")}</span>
            <Link href={toggleJobsHref} className="link">{withJobs ? `${tm("onlyJobs")} ✓` : tm("onlyJobs")}</Link>
          </div>
          {school ? (
            <SchoolCard school={school} locale={locale} closeHref={viewHref("map")} actions={<ReportButton targetType="organization" targetId={school.id} labels={await getReportLabels("organization")} />}>
              {school.jobs.length === 0 ? <p className="text-ink-600">{tm("noJobsAtSchool")}</p> : (
                <>
                  <h3 className="font-bold">{tm("schoolOpen")}</h3>
                  <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">{school.jobs.map((j) => <li key={j.id}><JobCard j={j} locale={locale} reportLabels={reportJobLabels} /></li>)}</ul>
                </>
              )}
            </SchoolCard>
          ) : null}
        </section>
      ) : null}

      <p className="notice-warn mt-4 max-w-3xl">{t("notice")}</p>

      <form method="get" className="card mt-6 flex flex-wrap items-end gap-4 p-5" aria-label={t("filters.type")}>
        {view === "list" ? <input type="hidden" name="view" value="list" /> : null}
        <div>
          <label className="label" htmlFor="j-type">{t("filters.type")}</label>
          <select id="j-type" name="type" className="field" defaultValue={type ?? ""}>
            <option value="">{t("filters.allTypes")}</option>
            <option value="full_time">{t("filters.fullTime")}</option>
            <option value="part_time">{t("filters.partTime")}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="j-city">{t("filters.city")}</label>
          <select id="j-city" name="city" className="field" defaultValue={city ?? ""}>
            <option value="">{t("filters.anyCity")}</option>
            {CITIES.map((c) => <option key={c.key} value={c.key}>{cityLabel(c.key, locale)}</option>)}
          </select>
        </div>
        <button type="submit" className="btn btn-primary">{t("filters.apply")}</button>
      </form>

      <p className="mt-4 text-sm text-ink-500" aria-live="polite">{tc("results", { count: result.total })}</p>
      {result.items.length === 0 ? (
        <div className="card mt-3 text-center"><h2 className="text-xl font-bold">{t("empty.title")}</h2><p className="mt-1 text-ink-600">{t("empty.body")}</p></div>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.items.map((j) => <li key={j.id}><JobCard j={j} locale={locale} reportLabels={reportJobLabels} /></li>)}
        </ul>
      )}
      {pages > 1 ? (
        <nav className="mt-6 flex items-center justify-between" aria-label={tc("page", { page: result.page })}>
          {result.page > 1 ? <Link href={href(result.page - 1)} className="btn btn-secondary">{tc("previous")}</Link> : <span />}
          <span className="text-sm text-ink-500">{f.number(result.page)} / {f.number(pages)}</span>
          {result.page < pages ? <Link href={href(result.page + 1)} className="btn btn-secondary">{tc("next")}</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}

function Panel({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="container-page max-w-2xl py-16 text-center">
      <h1 className="text-3xl font-extrabold">{title}</h1>
      <p className="mt-3 text-lg text-ink-600">{body}</p>
      {cta ? <Link href={cta.href} className="btn btn-primary btn-lg mt-6">{cta.label}</Link> : null}
    </div>
  );
}

async function JobCard({ j, locale, reportLabels }: { j: JobDto; locale: string; reportLabels: ReportLabels }) {
  const t = await getTranslations("jobs.card");
  const tt = await getTranslations("taxonomy");
  const to = await getTranslations("jobs.filters");
  const tb = await getTranslations("school.bilingual");
  const f = await getFormatter();
  const n = (v: number) => f.number(v);
  let salary: string | null = null;
  if (j.salaryUnit && (j.salaryMin !== null || j.salaryMax !== null)) {
    const both = j.salaryMin !== null && j.salaryMax !== null;
    salary = j.salaryUnit === "month"
      ? both ? t("salaryMonth", { min: n(j.salaryMin!), max: n(j.salaryMax!) }) : t("salaryMonthFrom", { min: n(j.salaryMin ?? j.salaryMax!) })
      : both ? t("salaryHour", { min: n(j.salaryMin!), max: n(j.salaryMax!) }) : t("salaryHourFrom", { min: n(j.salaryMin ?? j.salaryMax!) });
  }
  return (
    <article className="card flex h-full flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge">{j.type === "full_time" ? to("fullTime") : to("partTime")}</span>
        {j.school.bilingual ? <span className="badge-muted">{tb("badge")}</span> : null}
        <span className="text-sm text-ink-500">{t("posted", { date: f.dateTime(j.postedAt, { dateStyle: "medium" }) })}</span>
      </div>
      <h2 className="text-lg font-bold">{j.title}</h2>
      <p className="text-sm text-ink-600">{j.school.name} · {tt(`schoolTypes.${j.school.type as "cram_school"}`)}{j.city ? ` · ${areaLabel(j.city, j.district ? [`${j.city}:${j.district}`] : [], locale)}` : ""}</p>
      {j.description ? <p className="whitespace-pre-line text-sm">{j.description}</p> : null}
      {j.subjects.length > 0 ? <div className="flex flex-wrap gap-1.5">{j.subjects.map((s) => <span key={s} className="badge-muted">{tt(`subjects.${s as Subject}`)}</span>)}</div> : null}
      {salary ? <p className="font-semibold text-brand-800">{salary}</p> : null}
      {j.startsOn ? <p className="text-sm text-ink-500">{t("startsOn", { date: f.dateTime(new Date(j.startsOn), { dateStyle: "medium" }) })}</p> : null}
      <div className="mt-auto rounded-xl bg-ink-50 p-3 text-sm">
        <b>{t("howToApply")}</b>
        <p className="mt-0.5 break-words">{j.applyContact ?? t("noContact")}</p>
        <p className="mt-1 text-xs text-ink-500">{t("applyNote")}</p>
      </div>
      <ReportButton targetType="job" targetId={j.id} labels={reportLabels} />
    </article>
  );
}
