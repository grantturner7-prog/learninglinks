"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { MIN_PASSWORD, PasswordField } from "@/components/auth/password-field";
import { AuthCard } from "@/components/auth-card";
import { authClient } from "@/lib/auth/client";
import { mapAuthError, type AuthErrorKey } from "@/lib/auth/errors";
import { Link } from "@/i18n/navigation";

export function ResetPasswordForm({ token }: { token: string | undefined }) {
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKey | "link" | null>(token ? null : "link");
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < MIN_PASSWORD) {
      setError("weak");
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    if (err) {
      const key = mapAuthError(err);
      setError(key === "generic" ? "link" : key);
      setBusy(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <AuthCard title={t("reset.doneTitle")} say={t("reset.doneSay")}>
        <div role="status" className="flex flex-col gap-4">
          <p className="text-lg leading-relaxed text-ink-700">{t("reset.doneBody")}</p>
          <Link href="/sign-in" className="btn btn-primary btn-lg self-start">
            {t("signIn.submit")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (error === "link") {
    return (
      <AuthCard title={t("reset.title")} say={t("reset.invalidSay")}>
        <div role="alert" className="flex flex-col gap-4">
          <div className="notice-error">{t("reset.invalidLink")}</div>
          <Link href="/forgot-password" className="btn btn-primary btn-lg self-start">
            {t("reset.requestNew")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("reset.title")} say={t("reset.say")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {error ? (
          <div role="alert" className="notice-error">
            {t(`errors.${error}`)}
          </div>
        ) : null}
        <PasswordField value={password} onChange={setPassword} label={t("reset.newPassword")} autoComplete="new-password" autoFocus guide />
        <button type="submit" className="btn btn-primary btn-lg w-full" disabled={busy}>
          {t("reset.submit")}
        </button>
      </form>
    </AuthCard>
  );
}
