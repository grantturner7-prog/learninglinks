"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { AUTH_FIELD } from "@/components/auth/password-field";
import { AuthCard } from "@/components/auth-card";
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
      <AuthCard title={t("sentTitle")} say={t("sentSay")}>
        <div role="status" className="flex flex-col gap-4">
          <p className="text-lg leading-relaxed text-ink-700">{t("sentBody", { email: email.trim() })}</p>
          <Link href="/sign-in" className="btn btn-secondary btn-lg self-start">
            {t("back")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} say={t("say")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        <p className="text-ink-600">{t("body")}</p>
        <div>
          <label htmlFor="email" className="label">
            {t("email")}
          </label>
          <input id="email" name="email" type="email" autoComplete="email" autoFocus required className={AUTH_FIELD} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy}>
          {t("submit")}
        </button>
        <Link href="/sign-in" className="link inline-flex min-h-11 items-center text-sm">
          {t("back")}
        </Link>
      </form>
    </AuthCard>
  );
}
