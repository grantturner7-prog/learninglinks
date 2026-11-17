"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState, type ReactNode } from "react";
import { saveProfileAction, type ProfileState } from "@/app/[locale]/educator/actions";
import { PhotoUpload } from "@/components/educator/photo-upload";
import type { PublishBlocker, StrengthKey } from "@/lib/educators/completeness";
import { LIMITS, type FieldErrors, type ProfileInput } from "@/lib/educators/profile-input";
import { EXPERIENCE_BANDS, LANGUAGES, LEVELS, SUBJECTS, TEACHING_MODES, WORK_AUTHORIZATION } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";

export interface Option { key: string; label: string }
export interface ProfileFormProps {
  locale: string;
  initial: ProfileInput;
  status: "draft" | "published" | "hidden" | "suspended" | null;
  strength: { percent: number; missing: StrengthKey[] };
  blockers: PublishBlocker[];
  photoUrl: string | null;
  cities: Option[];
  districtsByCity: Record<string, Option[]>;
}

const initials = (name: string) => [...name.trim()].slice(0, 2).join("").toUpperCase() || "·";

function Section({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">{title}</h2>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Chips({ name, options, selected }: { name: string; options: Option[]; selected: readonly string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <label key={o.key} className="chip">
          <input type="checkbox" name={name} value={o.key} defaultChecked={selected.includes(o.key)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

/**
 * The editable fields. It owns the little bits of live state (chosen city, whether tutoring is ticked, counters)
 * and is remounted (via `key`) after every save attempt, so those always agree with the values just submitted.
 * React 19 resets a form after its action runs; remounting keeps controlled and uncontrolled inputs in step.
 */
function Fields({ p, v, errors, message }: { p: ProfileFormProps; v: ProfileInput; errors: FieldErrors; message: ProfileState["message"] }) {
  const t = useTranslations("educator.profile");
  const tt = useTranslations("taxonomy");
  const tn = useTranslations("notice");
  const tc = useTranslations("common");
  const [city, setCity] = useState(v.city ?? "");
  const [tutors, setTutors] = useState(v.openTo.includes("private_tutoring"));
  const [bioLen, setBioLen] = useState([...(v.bio ?? "")].length);
  const [credRows, setCredRows] = useState(Math.max(2, v.credentials.length + (v.credentials.length < LIMITS.credentials ? 1 : 0)));

  const err = (field: string) => (errors[field] ? <p role="alert" id={`${field}-err`} className="mt-1 text-sm font-semibold text-danger-600">{t(`errors.${errors[field]}`)}</p> : null);
  const aria = (field: string) => (errors[field] ? { "aria-invalid": true, "aria-describedby": `${field}-err` } : {});

  const subjectOpts = SUBJECTS.map((k) => ({ key: k, label: tt(`subjects.${k}`) }));
  const levelOpts = LEVELS.map((k) => ({ key: k, label: tt(`levels.${k}`) }));
  const langOpts = LANGUAGES.map((k) => ({ key: k, label: tt(`languages.${k}`) }));
  const modeOpts = TEACHING_MODES.map((k) => ({ key: k, label: tt(`modes.${k}`) }));
  const districts = p.districtsByCity[city] ?? [];

  return (
      <div className="flex min-w-0 flex-col gap-5">
        {message === "fix" ? <div role="alert" className="notice-error">{t("errors.fix")}</div> : null}
        {message === "server" ? <div role="alert" className="notice-error">{t("errors.server")}</div> : null}

        <Section title={t("sections.about")} badge={<span className="badge">{t("membersOnly")}</span>}>
          <PhotoUpload photoUrl={p.photoUrl} initials={initials(v.displayName)} hasProfile={p.status !== null} />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="displayName">{t("fields.displayName")}</label>
              <input id="displayName" name="displayName" className="field" defaultValue={v.displayName} maxLength={LIMITS.displayName} autoComplete="off" {...aria("displayName")} />
              <p className="hint">{t("fields.displayNameHint")}</p>
              {err("displayName")}
            </div>
            <div>
              <label className="label" htmlFor="headline">{t("fields.headline")}</label>
              <input id="headline" name="headline" className="field" defaultValue={v.headline ?? ""} maxLength={LIMITS.headline} {...aria("headline")} />
              <p className="hint">{t("fields.headlineHint")}</p>
              {err("headline")}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="bio">{t("fields.bio")}</label>
            <textarea id="bio" name="bio" rows={5} className="field" defaultValue={v.bio ?? ""} maxLength={LIMITS.bio} onChange={(e) => setBioLen([...e.target.value].length)} {...aria("bio")} />
            <div className="flex flex-wrap justify-between gap-2">
              <p className="hint">{t("fields.bioHint")}</p>
              <span className="hint tabular-nums" aria-hidden>{bioLen} / {LIMITS.bio}</span>
            </div>
            <p className="hint">{t("fields.bioBoth")}</p>
            {err("bio")}
          </div>
        </Section>

        <Section title={t("sections.teach")} badge={<span className="badge">{t("membersOnly")}</span>}>
          <fieldset><legend className="label">{t("fields.subjects")}</legend><Chips name="subjects" options={subjectOpts} selected={v.subjects} /><p className="hint">{t("fields.subjectsHint")}</p></fieldset>
          <fieldset><legend className="label">{t("fields.levels")}</legend><Chips name="levels" options={levelOpts} selected={v.levels} /></fieldset>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <fieldset><legend className="label">{t("fields.languages")}</legend><Chips name="languages" options={langOpts} selected={v.languages} /></fieldset>
            <fieldset><legend className="label">{t("fields.modes")}</legend><Chips name="teachingModes" options={modeOpts} selected={v.teachingModes} /></fieldset>
          </div>
          <div className="max-w-xs">
            <label className="label" htmlFor="experienceBand">{t("fields.experience")}</label>
            <select id="experienceBand" name="experienceBand" className="field" defaultValue={v.experienceBand ?? ""}>
              <option value="">{t("fields.choose")}</option>
              {EXPERIENCE_BANDS.map((b) => <option key={b} value={b}>{tt(`experience.${b}`)}</option>)}
            </select>
          </div>
        </Section>

        <Section title={t("sections.where")} badge={<span className="badge">{t("membersOnly")}</span>}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="label" htmlFor="city">{t("fields.city")}</label>
              <select id="city" name="city" className="field" defaultValue={v.city ?? ""} onChange={(e) => setCity(e.target.value)}>
                <option value="">{t("fields.choose")}</option>
                {p.cities.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <fieldset>
              <legend className="label">{t("fields.districts")}</legend>
              {city && districts.length > 0 ? (
                <div key={city}><Chips name="districts" options={districts} selected={v.districts} /></div>
              ) : (
                <p className="hint">{city ? t("fields.districtsNone") : t("fields.choose")}</p>
              )}
              <p className="hint">{t("fields.districtsHint")}</p>
            </fieldset>
          </div>

          <fieldset>
            <legend className="label">{t("fields.openTo")}</legend>
            <div className="mt-1.5 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2 rounded-xl border border-ink-100 bg-ink-50 p-4">
                <b>{t("fields.schoolWork")}</b>
                <div className="flex flex-wrap gap-2">
                  <label className="chip"><input type="checkbox" className="sr-only" name="openTo" value="full_time" defaultChecked={v.openTo.includes("full_time")} />{tt("openTo.full_time")}</label>
                  <label className="chip"><input type="checkbox" className="sr-only" name="openTo" value="part_time" defaultChecked={v.openTo.includes("part_time")} />{tt("openTo.part_time")}</label>
                </div>
                <span className="text-sm text-ink-500">{t("fields.schoolWorkHint")}</span>
              </div>
              <div className="flex flex-col gap-2 rounded-xl border border-ink-100 bg-ink-50 p-4">
                <b>{t("fields.tutoring")}</b>
                <div className="flex flex-wrap gap-2">
                  <label className="chip"><input type="checkbox" className="sr-only" name="openTo" value="private_tutoring" defaultChecked={tutors} onChange={(e) => setTutors(e.target.checked)} />{tt("openTo.private_tutoring")}</label>
                </div>
                <span className="text-sm text-ink-500">{t("fields.tutoringHint")}</span>
              </div>
            </div>
            <p className="hint">{t("fields.openToHint")}</p>
            <p className="hint">{t("fields.betweenHint")}</p>
          </fieldset>

          {tutors ? (
            <div className="flex flex-col gap-3 rounded-xl border border-accent-400/40 bg-warn-50 p-4">
              <p className="text-sm font-semibold text-warn-700">{tn("tutoringWork")}</p>
              <fieldset>
                <legend className="label">{t("fields.rate")}</legend>
                <div className="grid max-w-md grid-cols-2 gap-3">
                  <div>
                    <label className="sr-only" htmlFor="rateMin">{t("fields.rateMin")}</label>
                    <input id="rateMin" name="rateMin" inputMode="numeric" placeholder={t("fields.rateMin")} className="field" defaultValue={v.rateMin ?? ""} {...aria("rateMin")} />
                    {err("rateMin")}
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="rateMax">{t("fields.rateMax")}</label>
                    <input id="rateMax" name="rateMax" inputMode="numeric" placeholder={t("fields.rateMax")} className="field" defaultValue={v.rateMax ?? ""} {...aria("rateMax")} />
                    {err("rateMax")}
                  </div>
                </div>
                <p className="hint">{t("fields.rateHint")}</p>
              </fieldset>
            </div>
          ) : null}

          <div className="max-w-lg">
            <label className="label" htmlFor="workAuthorization">{t("fields.workAuth")} <span className="badge-muted ml-1.5">{tc("selfDeclared")}</span></label>
            <select id="workAuthorization" name="workAuthorization" className="field" defaultValue={v.workAuthorization ?? ""}>
              <option value="">{t("fields.choose")}</option>
              {WORK_AUTHORIZATION.map((w) => <option key={w} value={w}>{tt(`workAuth.${w}`)}</option>)}
            </select>
            <p className="hint">{t("fields.workAuthHint")}</p>
          </div>
        </Section>

        <Section title={t("sections.credentials")} badge={<span className="badge-warn">{tc("selfDeclared")}</span>}>
          {Array.from({ length: credRows }, (_, i) => {
            const c = v.credentials[i];
            return (
              <div key={i} className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_1fr_2fr]">
                <div>
                  <label className="label" htmlFor={`credLabel_${i}`}>{t("fields.credential")}</label>
                  <input id={`credLabel_${i}`} name={`credLabel_${i}`} className="field" defaultValue={c?.label ?? ""} maxLength={LIMITS.credentialLabel} {...aria(`credLabel_${i}`)} />
                  {err(`credLabel_${i}`)}
                </div>
                <div>
                  <label className="label" htmlFor={`credYear_${i}`}>{t("fields.year")}</label>
                  <input id={`credYear_${i}`} name={`credYear_${i}`} inputMode="numeric" className="field" defaultValue={c?.year ?? ""} {...aria(`credYear_${i}`)} />
                  {err(`credYear_${i}`)}
                </div>
                <div>
                  <label className="label" htmlFor={`credUrl_${i}`}>{t("fields.proof")}</label>
                  <input id={`credUrl_${i}`} name={`credUrl_${i}`} type="url" className="field" defaultValue={c?.proofUrl ?? ""} {...aria(`credUrl_${i}`)} />
                  {err(`credUrl_${i}`)}
                </div>
              </div>
            );
          })}
          <p className="hint">{t("fields.credentialsHint")}</p>
          {credRows < LIMITS.credentials ? <button type="button" className="btn btn-ghost self-start" onClick={() => setCredRows((n) => Math.min(LIMITS.credentials, n + 1))}>{t("fields.addAnother")}</button> : null}
        </Section>

        <Section title={t("sections.contact")} badge={<span className="badge-warn">{t("membersOnly")}</span>}>
          <p className="text-sm text-ink-600">{t("fields.contactIntro")}</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {([["email", "email", v.contacts.email], ["line", "text", v.contacts.line], ["whatsapp", "tel", v.contacts.whatsapp], ["wechat", "text", v.contacts.wechat], ["phone", "tel", v.contacts.phone]] as const).map(([ch, type, val]) => (
              <div key={ch}>
                <label className="label" htmlFor={`contact_${ch}`}>{t(`fields.${ch}`)}</label>
                <input id={`contact_${ch}`} name={`contact_${ch}`} type={type} className="field" defaultValue={val ?? ""} autoComplete="off" {...aria(`contact_${ch}`)} />
                {err(`contact_${ch}`)}
              </div>
            ))}
          </div>
        </Section>

        <section className="card"><h2 className="text-xl font-bold">{t("sections.visibility")}</h2><p className="mt-2 rounded-xl bg-brand-50 p-4 text-sm">{t("fields.visibilityBody")}</p></section>
      </div>
  );
}

export function ProfileForm(p: ProfileFormProps) {
  const t = useTranslations("educator.profile");
  const [state, action, pending] = useActionState<ProfileState, FormData>(saveProfileAction, {});
  const v: ProfileInput = state.values ?? p.initial;
  const status = p.status;
  const published = status === "published";
  const tt = useTranslations("taxonomy");
  const previewSubjects = v.subjects.slice(0, 4).map((k) => tt(`subjects.${k as (typeof SUBJECTS)[number]}`));
  const blockers = published ? [] : p.blockers;

  return (
    <form action={action} className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px]" noValidate>
      <input type="hidden" name="locale" value={p.locale} />
      <Fields key={state.nonce ?? "initial"} p={p} v={v} errors={state.errors ?? {}} message={state.message} />

      <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-4 lg:self-start" aria-label={t("preview.title")}>
        <div className="card flex flex-col gap-3">
          <h2 className="text-base font-bold">{t("preview.title")}</h2>
          <div className="flex flex-col gap-2.5 rounded-xl border border-ink-100 bg-ink-50 p-4">
            <div className="flex items-center gap-3">
              {p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- private, gated, already-resized photo
                <img src={p.photoUrl} alt="" width={44} height={44} className="h-11 w-11 rounded-full object-cover" />
              ) : (
                <span aria-hidden className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 font-extrabold text-brand-800">{initials(v.displayName)}</span>
              )}
              <div className="min-w-0">
                <div className="truncate font-bold">{v.displayName || t("preview.empty")}</div>
                {v.headline ? <div className="truncate text-sm text-ink-600">{v.headline}</div> : null}
              </div>
            </div>
            {previewSubjects.length > 0 ? <div className="flex flex-wrap gap-1.5">{previewSubjects.map((s) => <span key={s} className="badge">{s}</span>)}</div> : null}
            <p className="text-xs text-ink-500">🔒 {t("preview.contactLocked")}</p>
          </div>
        </div>

        <div className="card flex flex-col gap-3">
          <div className="flex items-center justify-between"><span className="font-bold">{t("strength.title")}</span><span className="font-bold tabular-nums">{p.strength.percent}%</span></div>
          <div role="progressbar" aria-valuenow={p.strength.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("strength.title")} className="h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-600" style={{ width: `${p.strength.percent}%` }} /></div>
          {p.strength.missing.length > 0 ? <ul className="list-disc space-y-1 pl-5 text-sm text-ink-600">{p.strength.missing.slice(0, 3).map((m) => <li key={m}>{t(`strength.tips.${m}`)}</li>)}</ul> : null}

          <p className="text-sm"><b>{t("status.label")}:</b> {t(`status.${status ?? "draft"}`)}</p>
          {blockers.length > 0 ? (
            <div className="notice-warn">
              <b>{t("blockers.title")}</b>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">{blockers.map((b) => <li key={b}>{t(`blockers.${b}`)}{b === "waiver" ? <> · <Link href="/educator/waiver" className="link">→</Link></> : null}</li>)}</ul>
            </div>
          ) : null}
          {state.blockers && state.blockers.length > 0 && state.message !== "published" ? <div role="alert" className="notice-error">{t("blockers.title")} {state.blockers.map((b) => t(`blockers.${b}`)).join("; ")}</div> : null}
          {state.message === "suspended" ? <div role="alert" className="notice-error">{t("blockers.suspended")}</div> : null}
          {state.message === "saved" ? <div role="status" className="notice">{t("actions.saved")}</div> : null}
          {state.message === "published" ? <div role="status" className="notice">{t("actions.publishedNow")}</div> : null}
          {state.message === "unpublished" ? <div role="status" className="notice-warn">{t("actions.unpublishedNow")}</div> : null}

          {status !== "suspended" ? (
            <button type="submit" name="intent" value="publish" className="btn btn-primary btn-lg w-full" disabled={pending}>
              {pending ? t("actions.saving") : published ? t("actions.save") : status === "hidden" ? t("actions.republish") : t("actions.publish")}
            </button>
          ) : null}
          {!published ? <button type="submit" name="intent" value="save" className="btn btn-secondary w-full" disabled={pending}>{t("actions.saveDraft")}</button> : null}
          <p className="text-center text-xs text-ink-500">{t("actions.hideNote")} <Link href="/educator/settings" className="link">{t("actions.settings")}</Link></p>
        </div>
      </aside>
    </form>
  );
}
