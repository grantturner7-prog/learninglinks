import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";

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
