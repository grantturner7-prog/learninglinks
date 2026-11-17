import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ConfirmButton } from "@/components/educator/confirm-button";
import { DeleteAccountForm } from "@/components/educator/delete-account-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { getEducatorState } from "@/lib/educators/service";
import { Link } from "@/i18n/navigation";
import { deleteProfileAction, hideProfileAction, withdrawWaiverAction } from "../actions";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ done?: string }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "educator.meta" });
  return { title: t("settings"), robots: { index: false } };
}

export default async function SettingsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { done } = await searchParams;
  setRequestLocale(locale);
  const user = (await getCurrentUser())!;
  const t = await getTranslations("educator.settings");
  const state = await getEducatorState(getDb(), user.id);
  const published = state.profile?.status === "published";
  const doneKey = done === "hidden" || done === "withdrawn" || done === "deleted" ? done : null;
  const hidden = <input type="hidden" name="locale" value={locale} />;

  return (
    <div className="container-page max-w-3xl py-10">
      <h1 className="text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-1 text-ink-600">{t("lead")}</p>
      {doneKey ? <div role="status" className="notice mt-4">{t(`done.${doneKey}`)}</div> : null}

      <div className="mt-6 flex flex-col gap-5">
        <section className="card flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t("visibility.title")}</h2>
          <p>{published ? t("visibility.published") : t("visibility.notPublished")}</p>
          <div className="flex flex-wrap gap-2">
            {published ? (
              <form action={hideProfileAction}>{hidden}<button type="submit" className="btn btn-secondary">{t("visibility.hide")}</button></form>
            ) : null}
            <Link href="/educator/profile" className="btn btn-secondary">{t("visibility.edit")}</Link>
          </div>
        </section>

        <section className="card flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t("waiver.title")}</h2>
          <p>{state.waiverValid ? t("waiver.agreed") : t("waiver.none")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/educator/waiver" className="btn btn-secondary">{t("waiver.review")}</Link>
            {state.waiverValid ? (
              <form action={withdrawWaiverAction}>{hidden}<ConfirmButton message={t("waiver.withdrawNote")} className="btn btn-secondary">{t("waiver.withdraw")}</ConfirmButton></form>
            ) : null}
          </div>
          {state.waiverValid ? <p className="text-sm text-ink-500">{t("waiver.withdrawNote")}</p> : null}
        </section>

        {state.profile ? (
          <section className="card flex flex-col gap-3">
            <h2 className="text-xl font-bold">{t("delete.title")}</h2>
            <p className="text-sm text-ink-600">{t("delete.body")}</p>
            <form action={deleteProfileAction}>{hidden}<ConfirmButton message={t("delete.confirm")} className="btn btn-danger">{t("delete.button")}</ConfirmButton></form>
          </section>
        ) : null}

        <section className="card flex flex-col gap-3">
          <h2 className="text-xl font-bold">{t("account.title")}</h2>
          <p className="text-sm text-ink-600">{t("account.body")}</p>
          <DeleteAccountForm locale={locale} />
        </section>
      </div>
    </div>
  );
}
