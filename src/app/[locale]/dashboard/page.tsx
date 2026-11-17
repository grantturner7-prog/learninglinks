import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { profileStrength } from "@/lib/educators/completeness";
import { getEducatorState } from "@/lib/educators/service";
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
  const t = await getTranslations("dashboard");
  const type = user.accountType;
  const steps = [t(`${type}.s1`), t(`${type}.s2`), t(`${type}.s3`)];

  return (
    <div className="container-page max-w-3xl py-12">
      <span className="badge">{t(`type.${type}`)}</span>
      <h1 className="mt-3 text-4xl font-extrabold">{t("title", { name: user.name })}</h1>
      <p className="mt-2 text-lg text-ink-600">{t("intro")}</p>
      {user.isAdmin ? <p className="notice mt-4">{t("admin")}</p> : null}
      <section className="card mt-8">
        <h2 className="text-2xl font-bold">{t("next")}</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {steps.map((s, i) => (
            <li key={s} className="flex items-start gap-3">
              <span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-brand-700 text-sm font-extrabold text-white">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm text-ink-500">{t("soon")}</p>
      </section>
    </div>
  );
}

async function EducatorHome({ user }: { locale: string; user: { id: string; name: string } }) {
  const t = await getTranslations("educator.home");
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
    </div>
  );
}
