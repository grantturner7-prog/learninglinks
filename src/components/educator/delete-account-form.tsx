"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { deleteAccountAction } from "@/app/[locale]/educator/actions";

export function DeleteAccountForm({ locale }: { locale: string }) {
  const t = useTranslations("educator.settings.account");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(deleteAccountAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {state.error === "wrongPassword" ? <div role="alert" className="notice-error">{t("wrongPassword")}</div> : null}
      {state.error === "server" ? <div role="alert" className="notice-error">{tc("somethingWrong")}</div> : null}
      <div className="max-w-sm">
        <label className="label" htmlFor="del-password">{t("password")}</label>
        <input id="del-password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <button type="submit" className="btn btn-danger self-start" disabled={pending} onClick={(e) => { if (!window.confirm(t("confirm"))) e.preventDefault(); }}>
        {t("button")}
      </button>
    </form>
  );
}

