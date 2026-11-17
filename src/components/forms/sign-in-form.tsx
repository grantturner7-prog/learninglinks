"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
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
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <div role="alert" className="notice-error">
          {t(`errors.${error}`)}
          {error === "notVerified" ? (
            <button type="button" className="link ml-2" onClick={resend}>
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
        <input id="email" name="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="label">
          {t("signIn.password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t("signIn.submit")}
      </button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <Link href="/forgot-password" className="link">
          {t("signIn.forgot")}
        </Link>
        <span className="text-ink-600">
          {t("signIn.noAccount")}{" "}
          <Link href="/sign-up" className="link">
            {t("signIn.join")}
          </Link>
        </span>
      </div>
    </form>
  );
}
