"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
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
    if (password.length < 10) {
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
      <div role="status" className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{t("reset.doneTitle")}</h2>
        <p className="text-ink-600">{t("reset.doneBody")}</p>
        <Link href="/sign-in" className="btn btn-primary mt-3 self-start">
          {t("signIn.submit")}
        </Link>
      </div>
    );
  }

  if (error === "link") {
    return (
      <div role="alert" className="flex flex-col gap-3">
        <div className="notice-error">{t("reset.invalidLink")}</div>
        <Link href="/forgot-password" className="link">
          {t("reset.requestNew")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <div role="alert" className="notice-error">
          {t(`errors.${error}`)}
        </div>
      ) : null}
      <div>
        <label htmlFor="password" className="label">
          {t("reset.newPassword")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="field"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="hint">{t("signUp.passwordHint")}</p>
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {t("reset.submit")}
      </button>
    </form>
  );
}
