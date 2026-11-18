"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type ReactNode } from "react";
import { publishJourneyAction, saveProfileAction } from "@/app/[locale]/educator/actions";
import { PhotoUpload } from "@/components/educator/photo-upload";
import { Icon, SubjectIcon, type IconName } from "@/components/journey/icons";
import { JourneyPreview } from "@/components/journey/journey-preview";
import { LinkGuide } from "@/components/logo";
import { WAIVER_REQUIRED_ITEMS } from "@/lib/consent/waiver-items";
import type { PublishBlocker } from "@/lib/educators/completeness";
import { STEP_COUNT, earliestErrorStep, stepForBlocker } from "@/lib/educators/journey";
import { buildFormData, toDraft, toggle, type Draft } from "@/lib/educators/journey-draft";
import { LIMITS, type FieldErrors, type ProfileInput } from "@/lib/educators/profile-input";
import { EXPERIENCE_BANDS, LANGUAGES, LEVELS, SUBJECTS, WORK_AUTHORIZATION } from "@/lib/taxonomy";
import type { Audience } from "@/lib/visibility";
import { Link } from "@/i18n/navigation";

export interface Option { key: string; label: string }
export interface JourneyProps {
  locale: string;
  initial: ProfileInput;
  initialStep: number;
  hasProfile: boolean;
  suspended: boolean;
  waiverValid: boolean;
  photoUrl: string | null;
  cities: Option[];
  districtsByCity: Record<string, Option[]>;
}

type SayKey = `s${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;
const skey = (n: number) => `s${n}` as SayKey;
const ckey = (n: number) => `c${n}` as `c${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}`;

const PILL = "inline-flex min-h-11 items-center gap-2 rounded-full bg-paper px-5 text-[15px] font-bold text-ink-900 shadow-[inset_0_0_0_2px_#e2cdd0] transition hover:bg-white";
const PILL_ON = "!bg-accent-300 shadow-[inset_0_0_0_3px_#f08f45]";
const TILE = "relative flex min-h-[150px] w-full flex-col items-center justify-center gap-1.5 rounded-[30px] bg-[#fff8f4] px-2 pb-3.5 pt-4 text-center shadow-[inset_0_0_0_2px_#e2cdd0] transition hover:bg-white";
const TILE_ON = "!bg-accent-300 shadow-[inset_0_0_0_3px_#f08f45,0_14px_24px_-14px_rgb(240_143_69/0.8)]";
const CARD = "rounded-[30px] bg-[#fff8f4] p-5 shadow-[inset_0_0_0_2px_#e2cdd0]";

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${PILL} ${on ? PILL_ON : ""}`}>
      {on ? <Icon name="check" size={16} stroke={3} /> : null}
      {children}
    </button>
  );
}

export function ProfileJourney(p: JourneyProps) {
  const t = useTranslations("journey");
  const tp = useTranslations("educator.profile");
  const tt = useTranslations("taxonomy");
  const tw = useTranslations("educator.waiver");
  const tn = useTranslations("notice");
  const tc = useTranslations("common");
  const [d, setD] = useState<Draft>(() => toDraft(p.initial));
  const [step, setStep] = useState(p.initialStep);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [hasProfile, setHasProfile] = useState(p.hasProfile);
  const [done, setDone] = useState(false);
  const [view, setView] = useState<Audience>("family");
  const [items, setItems] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState(false);
  const [suspended, setSuspended] = useState(p.suspended);
  const [blockers, setBlockers] = useState<PublishBlocker[]>([]);
  const [credRows, setCredRows] = useState(Math.max(2, p.initial.credentials.length + (p.initial.credentials.length < LIMITS.credentials ? 1 : 0)));
  const top = useRef<HTMLDivElement>(null);

  const patch = (part: Partial<Draft>) => {
    setD((prev) => ({ ...prev, ...part }));
    setDirty(true);
    setErrors({});
    setServerError(false);
  };

  async function save(): Promise<boolean> {
    setBusy(true);
    setServerError(false);
    try {
      const res = await saveProfileAction({}, buildFormData(d, p.locale, "save"));
      if (res.errors && Object.keys(res.errors).length > 0) {
        setErrors(res.errors);
        setStep(earliestErrorStep(res.errors));
        return false;
      }
      if (res.message === "server") {
        setServerError(true);
        return false;
      }
      setHasProfile(true);
      setDirty(false);
      return true;
    } catch {
      setServerError(true);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function go(n: number) {
    if (n === step || busy) return;
    if (n > step && !d.displayName.trim()) {
      setErrors({ displayName: "required" });
      setStep(1);
      return;
    }
    if (dirty && d.displayName.trim() && !(await save())) return;
    setStep(n);
    top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function publish() {
    setBusy(true);
    setServerError(false);
    setBlockers([]);
    try {
      const fd = buildFormData(d, p.locale, "publish");
      for (const [k, v] of Object.entries(items)) if (v) fd.set(`item_${k}`, "on");
      const res = await publishJourneyAction({}, fd);
      if (res.errors && Object.keys(res.errors).length > 0) {
        setErrors(res.errors);
        setStep(earliestErrorStep(res.errors));
      } else if (res.message === "published") {
        setHasProfile(true);
        setDirty(false);
        setDone(true);
        top.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else if (res.message === "suspended") {
        setSuspended(true);
      } else if (res.blockers && res.blockers.length > 0) {
        setBlockers(res.blockers);
        if (res.message === "saved") {
          setHasProfile(true);
          setDirty(false);
        }
      } else {
        setServerError(true);
      }
    } catch {
      setServerError(true);
    } finally {
      setBusy(false);
    }
  }

  const err = (field: string) => (errors[field] ? <p role="alert" className="mt-2 text-sm font-bold text-danger-600">{tp(`errors.${errors[field]}`)}</p> : null);
  const name = d.displayName.trim();
  // "Emily R." would read "Emily R.." before a full stop, so the guide uses the name without a trailing dot.
  const spoken = name.replace(/[.。\s]+$/u, "");
  const say = (n: number) => (n === 2 || n === 4 ? t(`say.${skey(n)}` as "say.s2", { name: spoken || "…" }) : t(`say.${skey(n)}` as "say.s1"));
  const districts = p.districtsByCity[d.city] ?? [];
  const tutors = d.openTo.includes("private_tutoring");
  const allTicked = WAIVER_REQUIRED_ITEMS.every((k) => items[k]);
  const help = step === 1 ? t("help.s1") : step === 2 ? t("help.s2") : step === 8 ? t("help.s8") : null;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="mt-7">
            <label htmlFor="j-name" className="sr-only">{tp("fields.displayName")}</label>
            <input id="j-name" className="field !min-h-14 !text-xl" value={d.displayName} maxLength={LIMITS.displayName} autoComplete="off" autoFocus
              onChange={(e) => patch({ displayName: e.target.value })} aria-invalid={!!errors.displayName} />
            {err("displayName")}
          </div>
        );
      case 2:
        return (
          <div className="mt-7 flex flex-col gap-6">
            <PhotoUpload photoUrl={p.photoUrl} initials={[...name].slice(0, 2).join("").toUpperCase() || "·"} hasProfile={hasProfile} />
            <div>
              <label className="label" htmlFor="j-headline">{tp("fields.headline")}</label>
              <input id="j-headline" className="field" value={d.headline} maxLength={LIMITS.headline} onChange={(e) => patch({ headline: e.target.value })} aria-invalid={!!errors.headline} />
              <p className="hint">{tp("fields.headlineHint")}</p>
              {err("headline")}
            </div>
            <div>
              <label className="label" htmlFor="j-bio">{tp("fields.bio")}</label>
              <textarea id="j-bio" rows={5} className="field" value={d.bio} maxLength={LIMITS.bio} onChange={(e) => patch({ bio: e.target.value })} aria-invalid={!!errors.bio} />
              <div className="flex flex-wrap justify-between gap-2"><p className="hint">{tp("fields.bioBoth")}</p><span className="hint tabular-nums" aria-hidden>{[...d.bio].length} / {LIMITS.bio}</span></div>
              {err("bio")}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="mt-7 flex flex-col gap-7">
            <fieldset>
              <legend className="label">{tp("fields.languages")}</legend>
              <div className="flex flex-wrap gap-2.5">{LANGUAGES.map((l) => <Pill key={l} on={d.languages.includes(l)} onClick={() => patch({ languages: toggle(d.languages, l) })}>{tt(`languages.${l}`)}</Pill>)}</div>
            </fieldset>
            <fieldset>
              <legend className="label">{tp("fields.modes")}</legend>
              <div className="grid max-w-md grid-cols-2 gap-3.5">
                {([["in_person", "pin"], ["online", "laptop"]] as const).map(([k, icon]) => {
                  const label = tt(`modes.${k}`);
                  const on = d.teachingModes.includes(k);
                  return (
                    <button key={k} type="button" aria-pressed={on} onClick={() => patch({ teachingModes: toggle(d.teachingModes, k) })} className={`${TILE} ${on ? TILE_ON : ""}`}>
                      {on ? <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-white"><Icon name="check" size={16} stroke={3} /></span> : null}
                      <Icon name={icon as IconName} size={42} stroke={1.5} className="text-brand-700" />
                      <span className="text-[15.5px] font-bold">{label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">{tp("fields.experience")}</legend>
              <div className="flex flex-wrap gap-2.5">{EXPERIENCE_BANDS.map((b) => <Pill key={b} on={d.experienceBand === b} onClick={() => patch({ experienceBand: d.experienceBand === b ? "" : b })}>{tt(`experience.${b}`)}</Pill>)}</div>
            </fieldset>
          </div>
        );
      case 4:
        return (
          <div className="mt-7">
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
              {SUBJECTS.map((s) => {
                const on = d.subjects.includes(s);
                return (
                  <button key={s} type="button" aria-pressed={on} onClick={() => patch({ subjects: toggle(d.subjects, s, 12) })} className={`${TILE} ${on ? TILE_ON : ""}`}>
                    {on ? <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-white"><Icon name="check" size={16} stroke={3} /></span> : null}
                    <span className="text-brand-700"><SubjectIcon subject={s} size={52} /></span>
                    <span className="text-[15px] font-bold leading-tight">{tt(`subjects.${s}`)}</span>
                  </button>
                );
              })}
            </div>
            <p className="hint mt-3">{t("nav.choose")} {t("nav.max12")}</p>
            {err("subjects")}
          </div>
        );
      case 5:
        return (
          <div className="mt-7 flex flex-col gap-7">
            <fieldset>
              <legend className="label">{tp("fields.levels")}</legend>
              <div className="flex flex-wrap gap-2.5">{LEVELS.map((l) => <Pill key={l} on={d.levels.includes(l)} onClick={() => patch({ levels: toggle(d.levels, l) })}>{tt(`levels.${l}`)}</Pill>)}</div>
            </fieldset>
            <fieldset>
              <legend className="label">{tp("fields.city")}</legend>
              <div className="flex flex-wrap gap-2.5">{p.cities.map((c) => <Pill key={c.key} on={d.city === c.key} onClick={() => patch({ city: d.city === c.key ? "" : c.key, districts: [] })}>{c.label}</Pill>)}</div>
            </fieldset>
            {d.city ? (
              <fieldset>
                <legend className="label">{tp("fields.districts")}</legend>
                {districts.length > 0 ? (
                  <div className="flex flex-wrap gap-2.5">{districts.map((o) => <Pill key={o.key} on={d.districts.includes(o.key)} onClick={() => patch({ districts: toggle(d.districts, o.key) })}>{o.label}</Pill>)}</div>
                ) : (
                  <p className="hint">{tp("fields.districtsNone")}</p>
                )}
                <p className="hint">{t("help.s5")}</p>
              </fieldset>
            ) : null}
          </div>
        );
      case 6:
        return (
          <div className="mt-7 flex flex-col gap-6">
            <p className="text-sm font-semibold text-ink-600">{t("fields.workOpen")}</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className={CARD}>
                <h2 className="flex items-center gap-2 text-lg font-extrabold"><Icon name="landmark" size={22} className="text-brand-700" />{t("fields.schoolWorkTitle")}</h2>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  {(["full_time", "part_time"] as const).map((k) => <Pill key={k} on={d.openTo.includes(k)} onClick={() => patch({ openTo: toggle(d.openTo, k) })}>{tt(`openTo.${k}`)}</Pill>)}
                </div>
                <p className="mt-3 text-sm text-ink-600">{tp("fields.schoolWorkHint")}</p>
              </div>
              <div className={CARD}>
                <h2 className="flex items-center gap-2 text-lg font-extrabold"><Icon name="book" size={22} className="text-brand-700" />{t("fields.tutoringTitle")}</h2>
                <div className="mt-4 flex flex-wrap gap-2.5">
                  <Pill on={tutors} onClick={() => patch({ openTo: toggle(d.openTo, "private_tutoring") })}>{tt("openTo.private_tutoring")}</Pill>
                </div>
                <p className="mt-3 text-sm text-ink-600">{tp("fields.tutoringHint")}</p>
              </div>
            </div>
            <p className="hint">{tp("fields.openToHint")}</p>
            {err("openTo")}
            {tutors ? (
              <div className="rounded-[26px] bg-warn-50 p-5 ring-1 ring-accent-300">
                <p className="text-sm font-bold text-warn-700">{tn("tutoringWork")}</p>
                <fieldset className="mt-4">
                  <legend className="label">{tp("fields.rate")}</legend>
                  <div className="grid max-w-md grid-cols-2 gap-3">
                    <div><label className="sr-only" htmlFor="j-rmin">{tp("fields.rateMin")}</label><input id="j-rmin" inputMode="numeric" className="field" placeholder={tp("fields.rateMin")} value={d.rateMin} onChange={(e) => patch({ rateMin: e.target.value })} aria-invalid={!!errors.rateMin} />{err("rateMin")}</div>
                    <div><label className="sr-only" htmlFor="j-rmax">{tp("fields.rateMax")}</label><input id="j-rmax" inputMode="numeric" className="field" placeholder={tp("fields.rateMax")} value={d.rateMax} onChange={(e) => patch({ rateMax: e.target.value })} aria-invalid={!!errors.rateMax} />{err("rateMax")}</div>
                  </div>
                  <p className="hint">{t("fields.rateGoes")}</p>
                </fieldset>
              </div>
            ) : null}
            <fieldset>
              <legend className="label">{tp("fields.workAuth")} <span className="badge-muted ml-1.5">{tc("selfDeclared")}</span></legend>
              <div className="flex flex-wrap gap-2.5">{WORK_AUTHORIZATION.map((w) => <Pill key={w} on={d.workAuthorization === w} onClick={() => patch({ workAuthorization: d.workAuthorization === w ? "" : w })}>{tt(`workAuth.${w}`)}</Pill>)}</div>
              <p className="hint">{tp("fields.workAuthHint")}</p>
            </fieldset>
          </div>
        );
      case 7:
        return (
          <div className="mt-7 flex flex-col gap-4">
            {Array.from({ length: credRows }, (_, i) => {
              const c = d.creds[i]!;
              const set = (part: Partial<Draft["creds"][number]>) => patch({ creds: d.creds.map((x, j) => (j === i ? { ...x, ...part } : x)) });
              return (
                <div key={i} className={`${CARD} grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_2fr]`}>
                  <div><label className="label" htmlFor={`j-cl-${i}`}>{tp("fields.credential")}</label><input id={`j-cl-${i}`} className="field" value={c.label} maxLength={LIMITS.credentialLabel} onChange={(e) => set({ label: e.target.value })} aria-invalid={!!errors[`credLabel_${i}`]} />{err(`credLabel_${i}`)}</div>
                  <div><label className="label" htmlFor={`j-cy-${i}`}>{tp("fields.year")}</label><input id={`j-cy-${i}`} inputMode="numeric" className="field" value={c.year} onChange={(e) => set({ year: e.target.value })} aria-invalid={!!errors[`credYear_${i}`]} />{err(`credYear_${i}`)}</div>
                  <div><label className="label" htmlFor={`j-cu-${i}`}>{tp("fields.proof")}</label><input id={`j-cu-${i}`} type="url" className="field" value={c.url} onChange={(e) => set({ url: e.target.value })} aria-invalid={!!errors[`credUrl_${i}`]} />{err(`credUrl_${i}`)}</div>
                </div>
              );
            })}
            <p className="hint">{t("help.s7")}</p>
            {credRows < LIMITS.credentials ? <button type="button" className="btn btn-secondary self-start" onClick={() => setCredRows((n) => Math.min(LIMITS.credentials, n + 1))}><Icon name="plus" size={18} />{tp("fields.addAnother")}</button> : null}
          </div>
        );
      case 8:
        return (
          <div className="mt-7 grid grid-cols-1 gap-4 md:grid-cols-2">
            {([["email", "mail", "email"], ["line", "chat", "text"], ["whatsapp", "chat", "tel"], ["wechat", "chat", "text"], ["phone", "phone", "tel"]] as const).map(([ch, icon, type]) => (
              <div key={ch} className={CARD}>
                <label className="label flex items-center gap-2" htmlFor={`j-c-${ch}`}><Icon name={icon} size={18} className="text-brand-700" />{tp(`fields.${ch}`)}</label>
                <input id={`j-c-${ch}`} type={type} className="field" autoComplete="off" value={d.contacts[ch]} onChange={(e) => patch({ contacts: { ...d.contacts, [ch]: e.target.value } })} aria-invalid={!!errors[`contact_${ch}`]} />
                {err(`contact_${ch}`)}
              </div>
            ))}
          </div>
        );
      default:
        return (
          <div className="mt-7 flex flex-col gap-6">
            {p.waiverValid ? (
              <p className="flex items-center gap-3 rounded-2xl bg-brand-50 p-4 font-semibold"><Icon name="check" size={20} className="text-brand-700" />{t("publish.alreadyAgreed")}</p>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {(["profile", "contact", "never"] as const).map((c) => (
                    <div key={c} className={CARD}>
                      <span className="badge">{tw(`cols.${c}.badge`)}</span>
                      <h2 className="mt-2.5 text-base font-extrabold">{tw(`cols.${c}.title`)}</h2>
                      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
                        {Array.from({ length: { profile: 6, contact: 5, never: 4 }[c] }, (_, i) => <li key={i}>{tw(`cols.${c}.i${i + 1}` as `cols.profile.i1`)}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
                <div className="rounded-[26px] bg-brand-50 p-5 ring-1 ring-brand-200">
                  <h2 className="text-lg font-extrabold">{tw("who.title")}</h2>
                  <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                    <p className="rounded-2xl bg-paper p-4 text-sm"><b>{tw("who.schoolsTitle")}</b><br />{tw("who.schoolsBody")}</p>
                    <p className="rounded-2xl bg-paper p-4 text-sm"><b>{tw("who.familiesTitle")}</b><br />{tw("who.familiesBody")}</p>
                  </div>
                  <p className="mt-3 text-sm text-ink-600">{tw("who.between")}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <h2 className="text-lg font-extrabold">{tw("confirm.title")}</h2>
                  {([
                    ["terms_privacy", tw.rich("confirm.termsPrivacy", { terms: (c) => <Link href="/legal/terms" target="_blank" className="link">{c}</Link>, privacy: (c) => <Link href="/legal/privacy" target="_blank" className="link">{c}</Link> }), true],
                    ["publish_to_members", tw.rich("confirm.publishToMembers", { b: (c) => <b>{c}</b> }), true],
                    ["contact_on_request", tw("confirm.contactOnRequest"), true],
                    ["truthful", tw("confirm.truthful"), true],
                    ["notice", tn("acknowledge"), true],
                    ["marketing", tw("confirm.marketing"), false],
                  ] as const).map(([k, body, required]) => (
                    <label key={k} className="flex cursor-pointer items-start gap-4 rounded-[24px] bg-brand-50 p-4 ring-2 ring-brand-200 has-[:checked]:ring-brand-700 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-500">
                      <input type="checkbox" className="mt-1 h-6 w-6 flex-none accent-brand-700" checked={!!items[k]} onChange={(e) => setItems((s) => ({ ...s, [k]: e.target.checked }))} />
                      <span className="text-[15px] leading-relaxed">{body} <span className={required ? "badge-warn ml-1" : "badge-muted ml-1"}>{required ? tw("confirm.required") : tw("confirm.optional")}</span></span>
                    </label>
                  ))}
                </div>
              </>
            )}
            {blockers.length > 0 ? (
              <div role="alert" className="notice-warn">
                <b>{t("publish.missing")}</b>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {blockers.filter((b) => b !== "waiver").map((b) => (
                    <li key={b} className="flex flex-wrap items-center gap-2">{tp(`blockers.${b}`)} <button type="button" className="link" onClick={() => void go(stepForBlocker(b))}>{t("publish.goStep", { n: stepForBlocker(b) })}</button></li>
                  ))}
                  {blockers.includes("waiver") ? <li>{t("publish.needAgree")}</li> : null}
                </ul>
              </div>
            ) : null}
            {suspended ? <div role="alert" className="notice-error">{t("publish.suspended")}</div> : null}
            <button type="button" className="btn btn-primary btn-lg w-full" disabled={busy || suspended || (!p.waiverValid && !allTicked)} onClick={() => void publish()}>
              {busy ? t("publish.publishing") : t("publish.button")}
            </button>
            {!p.waiverValid && !allTicked ? <p className="text-center text-sm text-ink-600">{t("publish.needAgree")}</p> : null}
          </div>
        );
    }
  };

  const savedLabel = busy ? t("top.saving") : dirty || !hasProfile ? t("top.unsaved") : t("top.saved");
  const fixNeeded = Object.keys(errors).some((f) => earliestErrorStep({ [f]: errors[f] }) === step);

  return (
    <div className="container-page py-6 sm:py-8" ref={top}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-ink-600">
        <Link href="/dashboard" className="link">{t("top.finishLater")}</Link>
        <span className="inline-flex items-center gap-2" aria-live="polite"><Icon name="check" size={16} className="text-brand-700" />{savedLabel}</span>
      </div>

      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_396px]">
        <section className="rounded-[36px] bg-paper p-6 shadow-soft sm:rounded-[48px] sm:p-10" aria-label={t("meta")}>
          {done ? (
            <div className="flex flex-col items-center gap-4 py-10 text-center">
              <LinkGuide size={96} />
              <h1 className="text-4xl font-extrabold tracking-tight">{t("publish.doneTitle")}</h1>
              <p className="max-w-md text-lg text-ink-600">{t("publish.doneBody")}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-3">
                <Link href="/dashboard" className="btn btn-primary btn-lg">{t("publish.toDashboard")}</Link>
                <button type="button" className="btn btn-secondary btn-lg" onClick={() => { setDone(false); setStep(1); }}>{t("publish.keepEditing")}</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <p className="text-[15px] font-extrabold tracking-wide text-brand-700">{t("top.stepOf", { n: step, total: STEP_COUNT })}</p>
                <p className="text-base font-semibold">{t(`cheer.${ckey(step)}`)}</p>
              </div>
              <ol className="relative mt-9 hidden items-center justify-between px-1 sm:flex" aria-label={t("top.path")}>
                <span aria-hidden className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-[3px] border-dotted border-[#cbb8eb]" />
                <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 border-t-4 border-ink-900" style={{ width: `calc((100% - 24px) * ${(step - 1) / (STEP_COUNT - 1)})` }} />
                {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((n) => (
                  <li key={n} className="relative z-10">
                    <button type="button" onClick={() => void go(n)} aria-current={n === step ? "step" : undefined} aria-label={t("top.stepAria", { n, name: t(`name.${skey(n)}`) })}
                      className="flex h-11 w-11 items-center justify-center rounded-full">
                      {n < step ? (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-white"><Icon name="check" size={14} stroke={3} /></span>
                      ) : n === step ? (
                        <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-paper shadow-[0_0_0_4px_#f7a96b,0_22px_44px_-18px_rgb(60_25_70/0.24)]"><LinkGuide size={44} /></span>
                      ) : (
                        <span className="h-6 w-6 rounded-full bg-paper shadow-[inset_0_0_0_3px_#cbb8eb]" />
                      )}
                    </button>
                    {n === step ? <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-400 px-3 py-1 text-xs font-extrabold">{t("top.here")}</span> : null}
                  </li>
                ))}
              </ol>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#f7e8e3] sm:hidden" aria-hidden><div className="h-full rounded-full bg-ink-900" style={{ width: `${(step / STEP_COUNT) * 100}%` }} /></div>

              <div className="mt-8 flex items-center gap-4 sm:gap-5">
                <span className="flex-none"><LinkGuide size={56} /></span>
                <div className="rounded-[26px] bg-brand-50 px-5 py-4"><p className="text-base font-semibold leading-relaxed sm:text-[17.5px]">{say(step)}</p></div>
              </div>

              <h1 className="mt-7 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">{t(`q.${skey(step)}`)}</h1>
              {help ? <p className="mt-3 max-w-2xl text-[15px] text-ink-600">{help}</p> : null}

              {fixNeeded ? <div role="alert" className="notice-error mt-5">{t("errors.fixStep")}</div> : null}
              {serverError ? <div role="alert" className="notice-error mt-5">{t("errors.server")}</div> : null}

              {renderStep()}

              <p className="mt-7 flex items-center justify-center gap-2 rounded-full bg-brand-50 px-4 py-3 text-center text-sm font-medium text-ink-600"><Icon name="lock" size={16} className="flex-none text-brand-700" />{t("reassure")}</p>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                {step >= 2 && step <= 8 ? <button type="button" className="min-h-12 px-1 text-[15px] font-bold text-brand-700 underline underline-offset-4" onClick={() => void go(step + 1)} disabled={busy}>{t("nav.skip")}</button> : <span />}
                <div className="flex gap-3">
                  {step > 1 ? <button type="button" className="btn btn-secondary btn-lg" onClick={() => void go(step - 1)} disabled={busy}><Icon name="arrowL" size={18} />{t("nav.back")}</button> : null}
                  {step < STEP_COUNT ? <button type="button" className="btn btn-primary btn-lg" onClick={() => void go(step + 1)} disabled={busy}>{t("nav.continue")}<Icon name="arrowR" size={18} /></button> : null}
                </div>
              </div>
            </>
          )}
        </section>

        <aside className="lg:sticky lg:top-4">
          <JourneyPreview d={d} step={step} view={view} onView={setView} photoUrl={p.photoUrl} locale={p.locale} />
        </aside>
      </div>
    </div>
  );
}
