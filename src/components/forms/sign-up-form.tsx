"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { Building, Heart, User } from "@/components/icons";
import { authClient } from "@/lib/auth/client";
import { mapAuthError, type AuthErrorKey } from "@/lib/auth/errors";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/db/schema/auth";
import { Link, useRouter } from "@/i18n/navigation";

const ICONS = { educator: User, school: Building, family: Heart } as const;

export function SignUpForm({ initialType }: { initialType: AccountType }) {
  const t = useTranslations("auth");
  const tn = useTranslations("notice");
  const locale = useLocale();
  const router = useRouter();
  const [type, setType] = useState<AccountType>(initialType);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!ack) {
      setError("ackRequired");
      return;
    }
    if (password.length < 10) {
      setError("weak");
      return;
    }
    setBusy(true);
    const { data, error: err } = await authClient.signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
      accountType: type,
      noticeAcknowledged: true,
      callbackURL: `${window.location.origin}/${locale}/dashboard`,
    });
    if (err) {
      setError(mapAuthError(err));
      setBusy(false);
      return;
    }
    if (!data?.token) {
      // Email verification is required: no session until the link is opened.
      setCheckEmail(true);
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  if (checkEmail) {
    return (
      <div role="status" className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">{t("signUp.checkEmailTitle")}</h2>
        <p className="text-ink-600">{t("signUp.checkEmailBody", { email: email.trim() })}</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      {error ? (
        <div role="alert" className="notice-error">
          {t(`errors.${error}`)}
        </div>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="label">{t("signUp.typeLabel")}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {ACCOUNT_TYPES.map((k) => {
            const Icon = ICONS[k];
            return (
              <label key={k} className="radio-card">
                <input type="radio" name="accountType" value={k} checked={type === k} onChange={() => setType(k)} className="sr-only" />
                <span className="flex items-center gap-2 font-bold text-ink-900">
                  <Icon size={20} className="text-brand-700" />
                  {t(`signUp.${k}.title`)}
                </span>
                <span className="text-sm text-ink-600">{t(`signUp.${k}.body`)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div>
        <label htmlFor="name" className="label">
          {t("signUp.name")}
        </label>
        <input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} className="field" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="email" className="label">
          {t("signUp.email")}
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="password" className="label">
          {t("signUp.password")}
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

      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-200 bg-white p-4 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1 h-5 w-5 flex-none accent-brand-700" />
        <span className="text-sm text-ink-700">{tn("acknowledge")}</span>
      </label>

      <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
        {t("signUp.submit")}
      </button>
      <p className="text-sm text-ink-600">
        {t("signUp.haveAccount")}{" "}
        <Link href="/sign-in" className="link">
          {t("signUp.signInLink")}
        </Link>
      </p>
    </form>
  );
}
