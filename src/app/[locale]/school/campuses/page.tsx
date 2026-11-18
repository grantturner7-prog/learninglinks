import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { areaLabel } from "@/lib/geo-labels";
import { listMyCampuses, listMyOpenClaims, searchOrganizations } from "@/lib/orgs/service";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ q?: string | string[] }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "school.meta" });
  return { title: t("campuses"), robots: { index: false } };
}

export default async function CampusesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  setRequestLocale(locale);
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q)?.trim().slice(0, 80) ?? "";
  const user = (await getCurrentUser())!;
  const db = getDb();
  const t = await getTranslations("school.campuses");
  const f = await getFormatter();
  const [campuses, claims, hits] = await Promise.all([listMyCampuses(db, user.id), listMyOpenClaims(db, user.id), q.length >= 2 ? searchOrganizations(db, q) : Promise.resolve([])]);
  const tt = await getTranslations("taxonomy.schoolTypes");
  const day = (d: Date) => f.dateTime(d, { dateStyle: "medium" });

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-4xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-lg text-ink-600">{t("intro")}</p>

      <section className="mt-8 flex flex-col gap-3">
        {campuses.length === 0 ? <p className="card">{t("empty")}</p> : campuses.map((c) => (
          <div key={c.id} className="card flex flex-wrap items-center gap-3">
            <div className="flex-1">
              <h2 className="text-lg font-extrabold">{c.name}</h2>
              <p className="text-sm text-ink-600">{tt(c.type as "other")} · {areaLabel(c.city, c.district ? [c.district] : [], locale)}</p>
              {c.suspended ? <p className="notice-error mt-2 text-sm">{t("suspendedNote")}</p> : null}
              <p className="mt-1 text-sm font-semibold">{c.suspended ? <span className="badge-warn">{t("suspended")}</span> : c.membership.active ? <span className="badge">{t("active", { date: day(c.membership.endsAt!) })}</span> : c.membership.endsAt ? <span className="badge-warn">{t("expired", { date: day(c.membership.endsAt) })}</span> : <span className="badge-muted">{t("inactive")}</span>}</p>
            </div>
            {c.suspended ? null : <Link href={`/school/checkout?campus=${c.id}` as "/school/checkout"} className="btn btn-secondary">{c.membership.endsAt ? t("renew") : t("pay")}</Link>}
          </div>
        ))}
        {campuses.length > 0 ? <Link href="/school/checkout" className="btn btn-primary self-start">{t("pay")}</Link> : null}
      </section>

      {claims.length > 0 ? (
        <section className="mt-8">
          <h2 className="text-xl font-extrabold">{t("claimsTitle")}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {claims.map((c) => <li key={c.id} className={c.status === "pending" ? "notice" : "notice-error"}>{t(c.status === "pending" ? "claimPending" : "claimRejected", { name: c.organizationName })}</li>)}
          </ul>
        </section>
      ) : null}

      <section className="card mt-10">
        <h2 className="text-2xl font-extrabold">{t("findTitle")}</h2>
        <form method="get" className="mt-4 flex flex-wrap gap-3" role="search">
          <label htmlFor="q" className="sr-only">{t("findTitle")}</label>
          <input id="q" name="q" className="field max-w-md flex-1" defaultValue={q} placeholder={t("placeholder")} maxLength={80} />
          <button type="submit" className="btn btn-primary">{t("search")}</button>
        </form>
        <p className="hint mt-2">{t("findHint")}</p>
        {q.length > 0 && q.length < 2 ? <p className="mt-3 text-sm font-semibold">{t("tooShort")}</p> : null}
        {q.length >= 2 ? (
          hits.length === 0 ? <p className="mt-4">{t("noResults", { q })}</p> : (
            <ul className="mt-4 flex flex-col gap-2">
              {hits.map((h) => (
                <li key={h.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-brand-50 p-4">
                  <div className="flex-1">
                    <p className="font-extrabold">{h.name}</p>
                    <p className="text-sm text-ink-600">{tt(h.type as "other")} · {areaLabel(h.city, h.district ? [h.district] : [], locale)}</p>
                  </div>
                  {h.status === "unclaimed" ? <Link href={`/school/claim/${h.id}` as "/school/claim/[orgId]"} className="btn btn-primary">{t("claimIt")}</Link> : <span className="badge-muted">{t("taken")}</span>}
                </li>
              ))}
            </ul>
          )
        ) : null}
        <p className="mt-5"><Link href="/school/campuses/new" className="link font-bold">{t("notListed")}</Link></p>
      </section>
    </div>
  );
}
