"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { joinWaitlist, type WaitlistState } from "@/app/[locale]/actions";

const COUNTRIES = ["TH", "VN", "JP", "KR", "CN"] as const;
const AUDIENCES = ["educator", "school", "family"] as const;
const initial: WaitlistState = { status: "idle" };

export function WaitlistForm() {
  const t = useTranslations("home.waitlist");
  const tc = useTranslations("taxonomy.countries");
  const [state, action, pending] = useActionState(joinWaitlist, initial);

  if (state.status === "success") {
    return (
      <p role="status" className="notice">
        {t("success")}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3.5">
      {state.status === "error" ? (
        <p role="alert" className="notice-error">
          {state.error === "email" ? t("errorEmail") : t("errorEmail")}
        </p>
      ) : null}
      <div>
        <label htmlFor="wl-email" className="label">
          {t("email")}
        </label>
        <input id="wl-email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <label htmlFor="wl-country" className="label">
            {t("country")}
          </label>
          <select id="wl-country" name="country" className="field" defaultValue="TH">
            {COUNTRIES.map((c) => (
              <option key={c} value={c}>
                {tc(c)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="wl-audience" className="label">
            {t("audience")}
          </label>
          <select id="wl-audience" name="audience" className="field" defaultValue="educator">
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>
                {t(`audiences.${a}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      {/* Honeypot, hidden from people and screen readers. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {t("submit")}
      </button>
    </form>
  );
}
