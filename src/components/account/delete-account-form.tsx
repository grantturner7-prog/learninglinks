"use client";

import { useActionState } from "react";
import { deleteMyAccountAction, type DeleteAccountState } from "@/app/[locale]/account/actions";

export interface DeleteLabels { password: string; confirm: string; button: string; wrongPassword: string; server: string }

export function AccountDeleteForm({ locale, labels }: { locale: string; labels: DeleteLabels }) {
  const [state, action, pending] = useActionState<DeleteAccountState, FormData>(deleteMyAccountAction, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="locale" value={locale} />
      {state.error === "wrongPassword" ? <div role="alert" className="notice-error">{labels.wrongPassword}</div> : null}
      {state.error === "server" ? <div role="alert" className="notice-error">{labels.server}</div> : null}
      <div className="max-w-sm">
        <label className="label" htmlFor="acct-del-password">{labels.password}</label>
        <input id="acct-del-password" name="password" type="password" autoComplete="current-password" required className="field" />
      </div>
      <button type="submit" className="btn btn-danger self-start" disabled={pending} onClick={(e) => { if (!window.confirm(labels.confirm)) e.preventDefault(); }}>
        {labels.button}
      </button>
    </form>
  );
}
