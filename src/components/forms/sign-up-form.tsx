"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AUTH_FIELD, MIN_PASSWORD, PasswordField } from "@/components/auth/password-field";
import { StepTrack } from "@/components/auth/step-track";
import { DoorArt, type DoorKind } from "@/components/home/door-art";
import { LinkSays } from "@/components/home/link-says";
import { Phrases } from "@/components/home/phrases";
import { Icon } from "@/components/journey/icons";
import { LinkGuide } from "@/components/logo";
import { authClient } from "@/lib/auth/client";
import { mapAuthError, type AuthErrorKey } from "@/lib/auth/errors";
import type { AccountType } from "@/lib/db/schema/auth";
import { Link, useRouter } from "@/i18n/navigation";

type Step = "type" | "name" | "email" | "password" | "notice";
type FlowError = AuthErrorKey | "email" | "name";

const STEPS: readonly Step[] = ["type", "name", "email", "password", "notice"];
const DOORS: ReadonlyArray<{ type: AccountType; kind: DoorKind; tint: string }> = [
  { type: "educator", kind: "teach", tint: "bg-brand-100" },
  { type: "school", kind: "school", tint: "bg-accent-300" },
  { type: "family", kind: "family", tint: "bg-rose-100" },
];
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Sign-up as a guided conversation: first the three doors, then one question at a time (name, email,
 * password), and last Link's honest notice with the REQUIRED acknowledgement tick-box.
 * `initialType` (from ?type=) preselects the door and skips the first question.
 * The request is exactly the old one: the server rejects any sign-up without noticeAcknowledged: true.
 */
export function SignUpForm({ initialType }: { initialType: AccountType | null }) {
  const t = useTranslations("auth");
  const tn = useTranslations("notice");
  const tc = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialType ? "name" : "type");
  // null until a door has been chosen (a valid ?type= counts as chosen).
  const [picked, setPicked] = useState<AccountType | null>(initialType);
  const type: AccountType = picked ?? "educator";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FlowError | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const ackBox = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // The doors and the notice have no text box to focus, so move focus to the new question for screen readers.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (step === "type" || step === "notice") heading.current?.focus();
  }, [step]);

  const n = STEPS.indexOf(step) + 1;
  // "Emily R." would read "Emily R.." before a full stop, so the guide uses the name without a trailing dot.
  const spoken = name.trim().replace(/[.。\s]+$/u, "") || "…";

  function go(to: Step) {
    setError(null);
    setStep(to);
  }

  function choose(k: AccountType) {
    setPicked(k);
    go("name");
  }

  function next() {
    setError(null);
    if (step === "name") {
      if (!name.trim()) return setError("name");
      go("email");
    } else if (step === "email") {
      if (!EMAIL_SHAPE.test(email.trim())) return setError("email");
      go("password");
    } else if (step === "password") {
      if (password.length < MIN_PASSWORD) return setError("weak");
      go("notice");
    }
  }

  async function create() {
    setError(null);
    if (!ack) {
      setError("ackRequired");
      ackBox.current?.focus();
      return;
    }
    if (password.length < MIN_PASSWORD) {
      setStep("password");
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
      const key = mapAuthError(err);
      // Send people back to the question that needs fixing.
      if (key === "exists") setStep("email");
      else if (key === "weak") setStep("password");
      setError(key);
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (step === "notice") void create();
    else if (step !== "type") next();
  }

  if (checkEmail) {
    return (
      <div className="container-page py-8 sm:py-14">
        <div className="mx-auto flex max-w-2xl flex-col gap-6">
          <LinkSays>{t("signUp.flow.checkEmail.say")}</LinkSays>
          <div role="status" className="flex flex-col items-center gap-4 rounded-[36px] bg-paper p-8 text-center shadow-soft sm:rounded-[48px] sm:p-12">
            <LinkGuide size={88} />
            <h1 className="text-balance text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">{t("signUp.checkEmailTitle")}</h1>
            <p className="max-w-md break-words text-lg leading-relaxed text-ink-700">{t("signUp.checkEmailBody", { email: email.trim() })}</p>
            <p className="max-w-md text-[15px] text-ink-600">{t("signUp.flow.checkEmail.tip")}</p>
            <Link href="/" className="btn btn-secondary btn-lg mt-2">
              {t("signUp.flow.checkEmail.home")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const wide = step === "type";
  const field = (props: { id: string; label: string; type?: string; autoComplete: string; value: string; set: (v: string) => void; invalid: boolean; max?: number }) => (
    <div className="mt-7">
      <label htmlFor={props.id} className="sr-only">
        {props.label}
      </label>
      <input
        id={props.id}
        name={props.id}
        type={props.type ?? "text"}
        autoComplete={props.autoComplete}
        autoFocus
        required
        maxLength={props.max}
        aria-invalid={props.invalid || undefined}
        className={`${AUTH_FIELD} !text-xl`}
        value={props.value}
        onChange={(e) => props.set(e.target.value)}
      />
    </div>
  );

  return (
    <div className="container-page py-8 sm:py-14">
      <div className={`mx-auto ${wide ? "max-w-5xl" : "max-w-2xl"}`}>
        <form onSubmit={onSubmit} noValidate aria-labelledby="su-h" className="rounded-[36px] bg-paper p-6 shadow-soft sm:rounded-[48px] sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-[15px] font-extrabold tracking-wide text-brand-700">{t("signUp.flow.stepOf", { n, total: STEPS.length })}</p>
            {step !== "type" ? (
              <button type="button" onClick={() => go("type")} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-50 px-4 text-sm font-bold text-brand-800 hover:bg-brand-100">
                {t("signUp.flow.joiningAs", { type: t(`signUp.flow.as.${type}`) })}
                <span className="underline underline-offset-4">{t("signUp.flow.change")}</span>
              </button>
            ) : null}
          </div>
          <div className="mt-6 hidden sm:block" role="presentation">
            <StepTrack current={n} total={STEPS.length} />
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100 sm:hidden" aria-hidden>
            <div className="h-full rounded-full bg-ink-900" style={{ width: `${(n / STEPS.length) * 100}%` }} />
          </div>

          <LinkSays className="mt-8">
            {step === "type"
              ? t("signUp.flow.type.say")
              : step === "name"
                ? t(`signUp.flow.name.say.${type}`)
                : step === "email"
                  ? t("signUp.flow.email.say", { name: spoken })
                  : step === "password"
                    ? t("signUp.flow.password.say", { name: spoken })
                    : t("signUp.flow.notice.say")}
          </LinkSays>

          <h1 id="su-h" ref={heading} tabIndex={-1} className="mt-7 text-balance text-4xl font-extrabold leading-[1.1] tracking-tight outline-none sm:text-5xl">
            <Phrases text={t(`signUp.flow.${step}.q`)} />
          </h1>
          {step === "type" ? <p className="mt-3 max-w-2xl text-[15px] text-ink-600">{t("signUp.flow.type.help")}</p> : null}
          {step === "name" ? <p className="mt-3 max-w-2xl text-[15px] text-ink-600">{t(`signUp.flow.name.help.${type}`)}</p> : null}
          {step === "email" ? <p className="mt-3 max-w-2xl text-[15px] text-ink-600">{t("signUp.flow.email.help")}</p> : null}

          {error && step !== "notice" ? (
            <div role="alert" className="notice-error mt-5">
              {t(`errors.${error}`)}
              {error === "exists" ? (
                <>
                  {" "}
                  <Link href="/sign-in" className="link">
                    {t("signUp.signInLink")}
                  </Link>
                </>
              ) : null}
            </div>
          ) : null}

          {step === "type" ? (
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              {DOORS.map(({ type: k, kind, tint }) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={picked ? picked === k : undefined}
                  onClick={() => choose(k)}
                  className={`group flex h-full flex-col items-center rounded-t-[130px] rounded-b-[32px] px-5 pb-6 pt-8 text-center transition-transform hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${tint} ${picked === k ? "ring-4 ring-accent-400" : "inset-ring-2 inset-ring-ink-900/10"}`}
                >
                  <DoorArt kind={kind} className="h-[120px] w-auto" />
                  <span className="mt-3 text-2xl font-extrabold leading-tight tracking-tight">{t(`signUp.${k}.title`)}</span>
                  <span className="mb-4 mt-2 text-[15px] leading-relaxed text-ink-900">{t(`signUp.${k}.body`)}</span>
                  <span className="mt-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-accent-400 text-ink-900" aria-hidden>
                    <Icon name="arrowR" size={20} />
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {step === "name"
            ? field({ id: "name", label: t("signUp.name"), autoComplete: "name", value: name, set: setName, invalid: error === "name", max: 80 })
            : null}
          {step === "email"
            ? field({ id: "email", label: t("signUp.email"), type: "email", autoComplete: "email", value: email, set: setEmail, invalid: error === "email" || error === "exists" })
            : null}
          {step === "password" ? (
            <div className="mt-7">
              <PasswordField value={password} onChange={setPassword} label={t("signUp.password")} labelHidden autoComplete="new-password" autoFocus guide invalid={error === "weak"} />
            </div>
          ) : null}

          {step === "notice" ? (
            <div className="mt-7 flex flex-col gap-5">
              <div className="rounded-[26px] bg-ink-50 p-5 inset-ring-2 inset-ring-ink-200 sm:p-6">
                <p className="text-xl font-extrabold leading-snug tracking-tight">{tn("lead")}</p>
                <p className="mt-2 text-[16px] leading-[1.75]">{tn("full")}</p>
              </div>
              {error ? (
                <div role="alert" className="notice-error">
                  {t(`errors.${error}`)}
                </div>
              ) : null}
              <label className="flex cursor-pointer items-start gap-4 rounded-[24px] bg-brand-50 p-4 ring-2 ring-brand-200 has-[:checked]:ring-brand-700 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus">
                <input
                  ref={ackBox}
                  type="checkbox"
                  name="noticeAcknowledged"
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  aria-invalid={error === "ackRequired" || undefined}
                  className="mt-1 h-6 w-6 flex-none accent-brand-700"
                />
                <span className="text-[15px] leading-relaxed">
                  {tn("acknowledge")} <span className="badge-warn ml-1">{tc("required")}</span>
                </span>
              </label>
            </div>
          ) : null}

          {step !== "type" ? (
            <p className="mt-7 flex items-center justify-center gap-2 rounded-full bg-brand-50 px-4 py-3 text-center text-sm font-medium text-ink-600">
              <Icon name="lock" size={16} className="flex-none text-brand-700" />
              {t("signUp.flow.reassure")}
            </p>
          ) : null}

          {step !== "type" ? (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => go(STEPS[n - 2] ?? "type")} disabled={busy}>
                <Icon name="arrowL" size={18} />
                {t("signUp.flow.back")}
              </button>
              <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
                {step === "notice" ? (busy ? t("signUp.creating") : t("signUp.submit")) : t("signUp.flow.continue")}
                {step === "notice" ? null : <Icon name="arrowR" size={18} />}
              </button>
            </div>
          ) : null}

          <p className="mt-6 flex flex-wrap items-center gap-x-2 text-sm text-ink-600">
            {t("signUp.haveAccount")}
            <Link href="/sign-in" className="link inline-flex min-h-11 min-w-11 items-center justify-center">
              {t("signUp.signInLink")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
