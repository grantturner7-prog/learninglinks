import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AccountDeleteForm } from "@/components/account/delete-account-form";
import { requireUser } from "@/lib/auth/session";
import { Link, redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "account" });
  return { title: t("meta"), robots: { index: false } };
}

/** Account and privacy for schools and families. Educators have the same controls in their settings. */
export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/account");
  if (user.accountType === "educator") return redirect({ href: "/educator/settings", locale });
  const t = await getTranslations("account");
  const kind = user.accountType === "school" ? "school" : "family";
  const lines = kind === "school" ? (["removed", "kept", "campus"] as const) : (["removed", "kept", "membership"] as const);
  return (
    <div className="container-page max-w-3xl py-10">
      <Link href="/dashboard" className="link text-sm">← {t("back")}</Link>
      <h1 className="mt-3 text-4xl font-extrabold tracking-tight">{t("title")}</h1>
      <p className="mt-2 text-lg text-ink-600">{t("intro")}</p>
      <section className="card mt-6">
        <p className="text-sm font-bold text-ink-600">{t("details")}</p>
        <p className="text-lg font-semibold">{user.name} · {user.email}</p>
      </section>
      <section className="card mt-5" aria-labelledby="del-h">
        <h2 id="del-h" className="text-xl font-extrabold">{t("deleteTitle")}</h2>
        <p className="mt-1 text-ink-600">{t("deleteIntro")}</p>
        <ul className="mt-3 list-disc space-y-1.5 pl-5">
          {lines.map((k) => <li key={k}>{t(`${kind}.${k}` as "family.removed")}</li>)}
        </ul>
        <div className="mt-5">
          <AccountDeleteForm locale={locale} labels={{ password: t("password"), confirm: t("confirm"), button: t("button"), wrongPassword: t("wrongPassword"), server: t("server") }} />
        </div>
      </section>
    </div>
  );
}
