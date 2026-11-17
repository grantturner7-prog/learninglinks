"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { AUTH_FIELD, PasswordField } from "@/components/auth/password-field";
import { authClient } from "@/lib/auth/client";
import { mapAuthError, type AuthErrorKey } from "@/lib/auth/errors";
import { safeNext } from "@/lib/auth/helpers";
import { Link, useRouter } from "@/i18n/navigation";

export function SignInForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const locale = useLocale();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [resent, setResent] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResent(false);
    const { error: err } = await authClient.signIn.email({ email: email.trim(), password });
    if (err) {
      setError(mapAuthError(err));
      setBusy(false);
      return;
    }
    router.replace(safeNext(next));
    router.refresh();
  }

  async function resend() {
    await authClient.sendVerificationEmail({ email: email.trim(), callbackURL: `${window.location.origin}/${locale}/dashboard` });
    setResent(true);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error ? (
        <div role="alert" className="notice-error">
          {t(`errors.${error}`)}
          {error === "notVerified" ? (
            <button type="button" className="link ml-2 min-h-11" onClick={resend}>
              {t("signIn.resend")}
            </button>
          ) : null}
        </div>
      ) : null}
      {resent ? (
        <div role="status" className="notice">
          {t("signIn.resent")}
        </div>
      ) : null}
      <div>
        <label htmlFor="email" className="label">
          {t("signIn.email")}
        </label>
        <input id="email" name="email" type="email" autoComplete="email" autoFocus required className={AUTH_FIELD} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <PasswordField value={password} onChange={setPassword} label={t("signIn.password")} autoComplete="current-password" />
      <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy}>
        {t("signIn.submit")}
      </button>
      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <Link href="/forgot-password" className="link inline-flex min-h-11 items-center">
          {t("signIn.forgot")}
        </Link>
        <span className="flex flex-wrap items-center gap-x-1.5 text-ink-600">
          {t("signIn.noAccount")}
          <Link href="/sign-up" className="link inline-flex min-h-11 items-center">
            {t("signIn.join")}
          </Link>
        </span>
      </div>
    </form>
  );
}
