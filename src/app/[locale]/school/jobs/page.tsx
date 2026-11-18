import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { listJobsForUser } from "@/lib/jobs/manage";
import { listMyCampuses } from "@/lib/orgs/service";
import { Link } from "@/i18n/navigation";
import { closeJobAction } from "../actions";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "school.meta" });
  return { title: t("jobs"), robots: { index: false } };
}

export default async function SchoolJobsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = (await getCurrentUser())!;
  const db = getDb();
  const t = await getTranslations("school.jobs");
  const tc = await getTranslations("school.campuses");
  const tt = await getTranslations("taxonomy.openTo");
  const f = await getFormatter();
  const [jobs, campuses] = await Promise.all([listJobsForUser(db, user.id), listMyCampuses(db, user.id)]);
  const canPost = campuses.some((c) => c.membership.active && !c.suspended);
  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-4xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-lg text-ink-600">{t("intro")}</p>
      <p className="hint mt-1">{t("types")} {t("lapse")}</p>
      <div className="mt-6">
        {canPost ? <Link href="/school/jobs/new" className="btn btn-primary btn-lg">{t("post")}</Link> : (
          <div className="notice">
            <p>{t("needMembership")}</p>
            <Link href="/school/campuses" className="btn btn-secondary mt-3">{tc("title")}</Link>
          </div>
        )}
      </div>
      <ul className="mt-8 flex flex-col gap-3">
        {jobs.length === 0 ? <li className="card">{t("none")}</li> : jobs.map((j) => (
          <li key={j.id} className="card flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold text-ink-600">{j.organizationName}</p>
              <h2 className="text-lg font-extrabold">{j.title}</h2>
              <p className="mt-1 flex flex-wrap gap-1.5 text-sm"><span className="badge">{tt(j.type)}</span><span className={j.status === "open" ? "badge" : "badge-muted"}>{t(j.status)}</span><span className="text-ink-600">{t("posted", { date: f.dateTime(j.createdAt, { dateStyle: "medium" }) })}</span></p>
            </div>
            {j.status === "open" ? (
              <form action={closeJobAction}><input type="hidden" name="jobId" value={j.id} /><button type="submit" className="btn btn-secondary">{t("close")}</button></form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
