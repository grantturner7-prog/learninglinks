"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { authClient } from "@/lib/auth/client";
import { Link } from "@/i18n/navigation";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgot");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    // The result is deliberately ignored so the page never reveals whether an account exists.
    await authClient.requestPasswordReset({ email: email.trim(), redirectTo: `${window.location.origin}/${locale}/reset-password` });
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{t("sentTitle")}</h2>
        <p className="text-ink-600">{t("sentBody", { email: email.trim() })}</p>
        <Link href="/sign-in" className="link mt-2">
          {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-ink-600">{t("body")}</p>
      <div>
        <label htmlFor="email" className="label">
          {t("email")}
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t("submit")}
      </button>
      <Link href="/sign-in" className="link text-sm">
        {t("back")}
      </Link>
    </form>
  );
}
