import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { getHolderMembership, listOrdersForUser } from "@/lib/billing/orders";
import { getDb } from "@/lib/db";
import { profileStrength } from "@/lib/educators/completeness";
import { getEducatorState } from "@/lib/educators/service";
import { getEnv } from "@/lib/env";
import { daysUntil } from "@/lib/membership/engine";
import { formatMoney } from "@/lib/plans";
import { listMyCampuses, listMyOpenClaims } from "@/lib/orgs/service";
import { revealsLeftToday } from "@/lib/reveal/service";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "dashboard" });
  return { title: t("meta"), robots: { index: false } };
}

export default async function DashboardPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/dashboard");
  if (user.accountType === "educator") return <EducatorHome locale={locale} user={user} />;
  if (user.accountType === "family") return <FamilyHome user={user} locale={locale} />;
  return <SchoolHome user={user} locale={locale} />;
}

type HomeUser = { id: string; name: string; accountType: "educator" | "school" | "family"; isAdmin: boolean };

/** Admins get one extra card on any dashboard. */
async function AdminCard() {
  const t = await getTranslations("dashboard");
  return (
    <section className="card mt-5">
      <p>{t("admin")}</p>
      <Link href="/admin" className="btn btn-secondary mt-3">Admin</Link>
    </section>
  );
}

async function OrdersList({ userId, locale }: { userId: string; locale: string }) {
  const t = await getTranslations("dashboard.home");
  const orders = (await listOrdersForUser(getDb(), userId)).slice(0, 5);
  return (
    <section className="card mt-5">
      <h2 className="text-xl font-extrabold">{t("family.ordersTitle")}</h2>
      {orders.length === 0 ? <p className="mt-2 text-ink-600">{t("family.noOrders")}</p> : (
        <ul className="mt-3 flex flex-col gap-2">
          {orders.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-3">
              <span className="flex-1"><span className="font-mono font-bold">{o.referenceCode}</span> · {formatMoney(o.amount, o.currency, locale)}</span>
              <span className={o.status === "paid" ? "badge" : o.status === "pending" ? "badge-warn" : "badge-muted"}>{t(`orderStatus.${o.status}`)}</span>
              <Link href={`/orders/${o.id}` as "/orders/[id]"} className="link font-bold">{t("family.viewOrder")}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function FamilyHome({ user, locale }: { user: HomeUser; locale: string }) {
  const t = await getTranslations("dashboard.home.family");
  const f = await getFormatter();
  const db = getDb();
  const m = await getHolderMembership(db, "user", user.id);
  const used = m.active ? await revealsLeftToday(db, user, getEnv().REVEAL_DAILY_CAP) : null;
  const days = m.endsAt ? daysUntil(m.endsAt, new Date()) : null;
  const day = (d: Date) => f.dateTime(d, { dateStyle: "medium" });
  return (
    <div className="container-page max-w-3xl py-12">
      <span className="badge">{(await getTranslations("dashboard"))("type.family")}</span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title", { name: user.name })}</h1>
      {m.active ? (
        <section className="card mt-8">
          <h2 className="text-2xl font-extrabold">{t("activeTitle")}</h2>
          <p className="mt-1 text-ink-600">{t("activeBody", { date: day(m.endsAt!) })}</p>
          {days !== null && days <= 60 ? <p className="notice mt-3">{t("endsSoon", { days })}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/educators" className="btn btn-primary btn-lg">{t("browse")}</Link>
            {days !== null && days <= 60 ? <Link href="/family/join" className="btn btn-secondary btn-lg">{t("renew")}</Link> : null}
          </div>
          {used ? <p className="hint mt-3">{t("left", { used: used.used, cap: used.cap })}</p> : null}
        </section>
      ) : (
        <section className="card mt-8">
          {m.endsAt ? <p className="notice mb-3">{t("expired", { date: day(m.endsAt) })}</p> : null}
          <h2 className="text-2xl font-extrabold">{t("joinTitle")}</h2>
          <p className="mt-1 text-ink-600">{t("joinBody")}</p>
          <Link href="/family/join" className="btn btn-primary btn-lg mt-4">{t("joinCta")}</Link>
        </section>
      )}
      <OrdersList userId={user.id} locale={locale} />
      {user.isAdmin ? <AdminCard /> : null}
    </div>
  );
}

async function SchoolHome({ user, locale }: { user: HomeUser; locale: string }) {
  const t = await getTranslations("dashboard.home.school");
  const tc = await getTranslations("school.campuses");
  const f = await getFormatter();
  const db = getDb();
  const [campuses, claims] = await Promise.all([listMyCampuses(db, user.id), listMyOpenClaims(db, user.id)]);
  const anyActive = campuses.some((c) => c.membership.active && !c.suspended);
  const used = anyActive ? await revealsLeftToday(db, user, getEnv().REVEAL_DAILY_CAP) : null;
  const now = new Date();
  const soon = campuses.filter((c) => c.membership.active && c.membership.endsAt && daysUntil(c.membership.endsAt, now) <= 60);
  const day = (d: Date) => f.dateTime(d, { dateStyle: "medium" });
  const pending = claims.filter((c) => c.status === "pending").length;
  return (
    <div className="container-page max-w-3xl py-12">
      <span className="badge">{(await getTranslations("dashboard"))("type.school")}</span>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title", { name: user.name })}</h1>
      <section className="card mt-8">
        <h2 className="text-2xl font-extrabold">{t("campusesTitle")}</h2>
        {campuses.length === 0 ? <p className="mt-2 text-ink-600">{t("noCampuses")}</p> : (
          <ul className="mt-3 flex flex-col gap-2">
            {campuses.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3">
                <span className="flex-1 font-semibold">{c.name}</span>
                {c.suspended ? <span className="badge-warn">{tc("suspended")}</span> : c.membership.active ? <span className="badge">{tc("active", { date: day(c.membership.endsAt!) })}</span> : c.membership.endsAt ? <span className="badge-warn">{tc("expired", { date: day(c.membership.endsAt) })}</span> : <span className="badge-muted">{tc("inactive")}</span>}
              </li>
            ))}
          </ul>
        )}
        {pending > 0 ? <p className="notice mt-3">{t("claimsPending", { n: pending })}</p> : null}
        {soon.map((c) => <p key={c.id} className="notice mt-3">{t("endsSoon", { name: c.name, days: daysUntil(c.membership.endsAt!, now) })}</p>)}
        <p className="hint mt-3">{t("price")}</p>
        <div className="mt-4 flex flex-wrap gap-3">
          {campuses.length > 0 ? <Link href="/school/checkout" className="btn btn-primary">{t("pay")}</Link> : null}
          <Link href="/school/campuses" className="btn btn-secondary">{t("manage")}</Link>
        </div>
      </section>
      {anyActive ? (
        <section className="card mt-5">
          <div className="flex flex-wrap gap-3">
            <Link href="/educators" className="btn btn-primary">{t("browse")}</Link>
            <Link href="/school/jobs/new" className="btn btn-secondary">{t("postJob")}</Link>
            <Link href="/school/jobs" className="btn btn-secondary">{t("jobs")}</Link>
          </div>
          {used ? <p className="hint mt-3">{t("left", { used: used.used, cap: used.cap })}</p> : null}
        </section>
      ) : null}
      <OrdersList userId={user.id} locale={locale} />
      {user.isAdmin ? <AdminCard /> : null}
    </div>
  );
}

async function EducatorHome({ user }: { locale: string; user: { id: string; name: string } }) {
  const t = await getTranslations("educator.home");
  const tr = await getTranslations("reveal");
  const state = await getEducatorState(getDb(), user.id);
  const p = state.profile;
  const strength = profileStrength(state.input, !!p?.photoKey);
  const published = p?.status === "published";
  const steps = [
    { label: t("stepWaiver"), done: state.waiverValid, href: "/educator/waiver" as const, cta: t("goWaiver") },
    { label: t("stepProfile"), done: !!p, href: "/educator/profile" as const, cta: t("goProfile") },
    { label: t("stepPublish"), done: published, href: "/educator/profile" as const, cta: t("goProfile") },
  ];
  const next = steps.findIndex((s) => !s.done);
  return (
    <div className="container-page max-w-3xl py-12">
      <span className="badge">Educator · 教師</span>
      <h1 className="mt-3 text-4xl font-extrabold">{t("title", { name: user.name })}</h1>
      <p className="mt-2 text-lg text-ink-600">{t("intro")}</p>
      {p?.status === "suspended" ? <p role="alert" className="notice-error mt-6">{t("suspended")}</p> : null}
      <section className="card mt-8">
        <ol className="flex flex-col gap-4">
          {steps.map((s, i) => (
            <li key={s.label} className="flex flex-wrap items-center gap-3">
              <span className={`inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-sm font-extrabold ${s.done ? "bg-brand-700 text-white" : i === next ? "border-2 border-brand-700 text-brand-800" : "border-2 border-ink-300 text-ink-500"}`}>{s.done ? "✓" : i + 1}</span>
              <span className="flex-1">{s.label} <span className={s.done ? "badge" : "badge-muted"}>{s.done ? t("done") : t("todo")}</span></span>
              {i === next ? <Link href={s.href} className="btn btn-primary">{s.cta}</Link> : null}
            </li>
          ))}
        </ol>
        {p ? <p className="mt-5 text-sm text-ink-500">{t("profileStrength", { percent: strength.percent })} · <Link href="/educator/settings" className="link">{t("settings")}</Link></p> : null}
      </section>
      <section className="card mt-5">
        <h2 className="text-xl font-bold">{t("jobsTitle")}</h2>
        <p className="mt-1 text-ink-600">{p ? t("jobsBody") : t("jobsLocked")}</p>
        {p ? <Link href="/jobs" className="btn btn-secondary mt-3">{t("jobsCta")}</Link> : null}
      </section>
      {p ? (
        <section className="card mt-5">
          <h2 className="text-xl font-bold">{tr("contacts.title")}</h2>
          <p className="mt-1 text-ink-600">{tr("contacts.intro")}</p>
          <Link href="/educator/contacts" className="btn btn-secondary mt-3">{tr("contacts.title")}</Link>
        </section>
      ) : null}
    </div>
  );
}
