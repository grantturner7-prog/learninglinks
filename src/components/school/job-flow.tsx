"use client";

import { useTranslations, useFormatter } from "next-intl";
import { useRef, useState } from "react";
import { FlowFrame } from "@/components/guided/frame";
import { Pill, Tile, CARD } from "@/components/guided/ui";
import { Icon, SubjectIcon } from "@/components/journey/icons";
import { LinkGuide } from "@/components/logo";
import type { GeoOption } from "@/lib/geo-options";
import type { JobFieldErrors } from "@/lib/jobs/input";
import { JOB_LIMITS, looksLikeSubstituteWork } from "@/lib/jobs/rules";
import { LEVELS, SUBJECTS } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";
import { createJobAction } from "@/app/[locale]/school/actions";

export interface JobCampus { id: string; name: string; city: string; district: string }

interface Props { campuses: JobCampus[]; cities: GeoOption[]; districtsByCity: Record<string, GeoOption[]> }
const TOTAL = 6;
const toggle = (list: string[], v: string, max: number) => (list.includes(v) ? list.filter((x) => x !== v) : list.length >= max ? list : [...list, v]);
const STEP_OF_FIELD: Record<string, number> = { title: 1, type: 2, city: 3, district: 3, salaryMin: 4, salaryUnit: 4, startsOn: 4, description: 5, applyContact: 6 };

export function JobFlow({ campuses, cities, districtsByCity }: Props) {
  const t = useTranslations("school.job");
  const tf = useTranslations("school.flow");
  const te = useTranslations("school.errors");
  const tt = useTranslations("taxonomy");
  const f = useFormatter();
  const top = useRef<HTMLDivElement>(null);
  const first = campuses[0]!;
  const [step, setStep] = useState(1);
  const [d, setD] = useState({
    organizationId: first.id, title: "", type: "", city: first.city, district: first.district, salaryMin: "", salaryMax: "", salaryUnit: "month", startsOn: "",
    subjects: [] as string[], levels: [] as string[], description: "", applyContact: "",
  });
  const [errors, setErrors] = useState<JobFieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const patch = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));
  const go = (n: number) => { setStep(n); setServerError(null); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const sk = `s${step}` as "s1";
  const ck = `c${step}` as "c1";

  const err = (field: string) => (errors[field] ? <p role="alert" className="mt-2 text-sm font-bold text-danger-600">{t(`errors.${errors[field]}` as "errors.required")}</p> : null);
  const titleSub = looksLikeSubstituteWork(d.title) || looksLikeSubstituteWork(d.description);
  const canNext = step === 1 ? d.title.trim().length >= 3 && !looksLikeSubstituteWork(d.title) : step === 2 ? d.type !== "" : step === 3 ? d.city !== "" : step === 5 ? !looksLikeSubstituteWork(d.description) : true;

  async function publish() {
    setBusy(true);
    setServerError(null);
    try {
      const res = await createJobAction({ organizationId: d.organizationId, fields: { title: d.title, type: d.type, city: d.city, district: d.district, salaryMin: d.salaryMin, salaryMax: d.salaryMax, salaryUnit: d.salaryUnit, startsOn: d.startsOn, subjects: d.subjects, levels: d.levels, description: d.description, applyContact: d.applyContact } });
      if (res.ok) { setDone(true); return; }
      if (res.errors) {
        setErrors(res.errors);
        const earliest = Math.min(...Object.keys(res.errors).map((k) => STEP_OF_FIELD[k] ?? 1));
        go(earliest);
      }
      setServerError(te(res.error as "server"));
    } catch {
      setServerError(te("server"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="container-page py-10">
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-[36px] bg-paper p-10 text-center shadow-soft">
          <LinkGuide size={96} />
          <h1 className="text-4xl font-extrabold tracking-tight">{t("doneTitle")}</h1>
          <p className="max-w-md text-lg text-ink-600">{t("doneBody")}</p>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            <Link href="/school/jobs" className="btn btn-primary btn-lg">{t("toJobs")}</Link>
            <button type="button" className="btn btn-secondary btn-lg" onClick={() => { setDone(false); setD({ ...d, title: "", description: "", subjects: [], levels: [] }); setStep(1); }}>{t("another")}</button>
          </div>
        </section>
      </div>
    );
  }

  const unit = d.salaryUnit === "hour" ? t("fields.hour") : t("fields.month");
  const min = Number(d.salaryMin.replace(/[,\s]/g, "")) || 0;
  const max = Number(d.salaryMax.replace(/[,\s]/g, "")) || 0;
  const pay = min && max ? t("preview.salary", { min: f.number(min), max: f.number(max), unit }) : min ? t("preview.salaryFrom", { min: f.number(min), unit }) : max ? t("preview.salaryUpTo", { max: f.number(max), unit }) : null;
  const campusName = campuses.find((c) => c.id === d.organizationId)?.name ?? "";
  const districts = districtsByCity[d.city] ?? [];

  const preview = (
    <div className="rounded-[36px] bg-paper p-6 shadow-soft" aria-live="polite">
      <p className="text-sm font-extrabold uppercase tracking-wide text-brand-700">{t("preview.title")}</p>
      <div className={`${CARD} mt-4`}>
        <p className="text-sm font-semibold text-ink-600">{campusName}</p>
        <h2 className="mt-1 text-xl font-extrabold leading-snug">{d.title.trim() || <span className="text-ink-400">{t("preview.empty")}</span>}</h2>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {d.type ? <span className="badge">{d.type === "full_time" ? t("fields.fullTime") : t("fields.partTime")}</span> : null}
          {pay ? <span className="badge-muted">{pay}</span> : null}
          {d.subjects.map((s) => <span key={s} className="badge-muted">{tt(`subjects.${s as "phonics"}`)}</span>)}
        </div>
        {d.description.trim() ? <p className="mt-3 line-clamp-4 whitespace-pre-line text-sm text-ink-700">{d.description.trim()}</p> : null}
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-ink-600"><Icon name="lock" size={16} className="flex-none text-brand-700" />{t("preview.visible")}</p>
    </div>
  );

  return (
    <FlowFrame
      step={step} total={TOTAL} labels={{ stepOf: tf("stepOf", { n: step, total: TOTAL }), path: tf("path"), here: tf("here"), stepAria: (n) => tf("stepAria", { n }), leave: tf("leave"), reassure: t("reassure") }}
      cheer={t(`cheer.${ck}`)} say={t(`say.${sk}`)} question={t(`q.${sk}`)} error={serverError} leaveHref="/school/jobs" topRef={top} onJump={go} aside={preview}
      footer={
        <>
          {step >= 4 && step <= 5 ? <button type="button" className="mr-auto min-h-12 px-1 text-[15px] font-bold text-brand-700 underline underline-offset-4" onClick={() => go(step + 1)}>{t("skip")}</button> : null}
          {step > 1 ? <button type="button" className="btn btn-secondary btn-lg" onClick={() => go(step - 1)} disabled={busy}><Icon name="arrowL" size={18} />{tf("back")}</button> : null}
          {step < TOTAL ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => go(step + 1)} disabled={!canNext}>{tf("continue")}<Icon name="arrowR" size={18} /></button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void publish()} disabled={busy || d.applyContact.trim().length < 3 || titleSub}>{busy ? t("publishing") : t("publish")}</button>
          )}
        </>
      }
    >
      {step === 1 ? (
        <div className="flex flex-col gap-6">
          {campuses.length > 1 ? (
            <fieldset>
              <legend className="label">{t("fields.campus")}</legend>
              <div className="flex flex-wrap gap-2.5">{campuses.map((c) => <Pill key={c.id} on={d.organizationId === c.id} onClick={() => patch({ organizationId: c.id, city: c.city, district: c.district })}>{c.name}</Pill>)}</div>
            </fieldset>
          ) : null}
          <div>
            <label htmlFor="j-title" className="sr-only">{t("fields.title")}</label>
            <input id="j-title" className="field !min-h-14 !text-xl" autoFocus maxLength={JOB_LIMITS.title} autoComplete="off" placeholder={t("fields.titleHint")} value={d.title} onChange={(e) => patch({ title: e.target.value })} aria-invalid={!!errors.title || looksLikeSubstituteWork(d.title)} />
            {looksLikeSubstituteWork(d.title) ? <p role="alert" className="mt-2 text-sm font-bold text-danger-600">{t("errors.substitute")}</p> : err("title")}
          </div>
        </div>
      ) : step === 2 ? (
        <div className="grid max-w-xl grid-cols-2 gap-4">
          {(["full_time", "part_time"] as const).map((k) => (
            <Tile key={k} on={d.type === k} onClick={() => patch({ type: k })}>
              <Icon name={k === "full_time" ? "clipboard" : "calc"} size={42} stroke={1.5} className="text-brand-700" />
              <span className="text-[16px] font-extrabold">{k === "full_time" ? t("fields.fullTime") : t("fields.partTime")}</span>
            </Tile>
          ))}
          {err("type")}
        </div>
      ) : step === 3 ? (
        <div className="flex flex-col gap-7">
          <fieldset>
            <legend className="label">{t("fields.city")}</legend>
            <div className="flex flex-wrap gap-2.5">{cities.map((c) => <Pill key={c.key} on={d.city === c.key} onClick={() => patch({ city: c.key, district: "" })}>{c.label}</Pill>)}</div>
            {err("city")}
          </fieldset>
          {districts.length > 0 ? (
            <fieldset>
              <legend className="label">{t("fields.district")}</legend>
              <div className="flex flex-wrap gap-2.5">{districts.map((x) => <Pill key={x.key} on={d.district === x.key} onClick={() => patch({ district: d.district === x.key ? "" : x.key })}>{x.label}</Pill>)}</div>
            </fieldset>
          ) : null}
        </div>
      ) : step === 4 ? (
        <div className="flex flex-col gap-6">
          <div className="grid max-w-xl grid-cols-2 gap-3">
            <div><label className="label" htmlFor="j-smin">{t("fields.salaryMin")}</label><input id="j-smin" className="field" inputMode="numeric" value={d.salaryMin} onChange={(e) => patch({ salaryMin: e.target.value })} aria-invalid={!!errors.salaryMin} />{err("salaryMin")}</div>
            <div><label className="label" htmlFor="j-smax">{t("fields.salaryMax")}</label><input id="j-smax" className="field" inputMode="numeric" value={d.salaryMax} onChange={(e) => patch({ salaryMax: e.target.value })} /></div>
          </div>
          <fieldset>
            <legend className="label">{t("fields.unit")}</legend>
            <div className="flex gap-2.5"><Pill on={d.salaryUnit === "month"} onClick={() => patch({ salaryUnit: "month" })}>{t("fields.month")}</Pill><Pill on={d.salaryUnit === "hour"} onClick={() => patch({ salaryUnit: "hour" })}>{t("fields.hour")}</Pill></div>
            {err("salaryUnit")}
          </fieldset>
          <div className="max-w-xs"><label className="label" htmlFor="j-start">{t("fields.startsOn")}</label><input id="j-start" type="date" className="field" value={d.startsOn} onChange={(e) => patch({ startsOn: e.target.value })} aria-invalid={!!errors.startsOn} />{err("startsOn")}</div>
        </div>
      ) : step === 5 ? (
        <div className="flex flex-col gap-7">
          <fieldset>
            <legend className="label">{t("fields.subjects")}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SUBJECTS.slice(0, 12).map((s) => (
                <Tile key={s} on={d.subjects.includes(s)} onClick={() => patch({ subjects: toggle(d.subjects, s, JOB_LIMITS.subjects) })}>
                  <span className="text-brand-700"><SubjectIcon subject={s} size={44} /></span>
                  <span className="text-[14.5px] font-bold leading-tight">{tt(`subjects.${s}`)}</span>
                </Tile>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="label">{t("fields.levels")}</legend>
            <div className="flex flex-wrap gap-2.5">{LEVELS.map((l) => <Pill key={l} on={d.levels.includes(l)} onClick={() => patch({ levels: toggle(d.levels, l, JOB_LIMITS.levels) })}>{tt(`levels.${l}`)}</Pill>)}</div>
          </fieldset>
          <div>
            <label className="label" htmlFor="j-desc">{t("fields.description")}</label>
            <textarea id="j-desc" rows={5} className="field" maxLength={JOB_LIMITS.description} value={d.description} onChange={(e) => patch({ description: e.target.value })} aria-invalid={!!errors.description || looksLikeSubstituteWork(d.description)} />
            <p className="hint">{t("fields.descriptionHint")}</p>
            {looksLikeSubstituteWork(d.description) ? <p role="alert" className="mt-2 text-sm font-bold text-danger-600">{t("errors.substitute")}</p> : err("description")}
          </div>
        </div>
      ) : (
        <div className="max-w-xl">
          <label className="label" htmlFor="j-apply">{t("fields.apply")}</label>
          <input id="j-apply" className="field !min-h-14 !text-lg" autoFocus maxLength={JOB_LIMITS.applyContact} autoComplete="off" value={d.applyContact} onChange={(e) => patch({ applyContact: e.target.value })} aria-invalid={!!errors.applyContact} />
          <p className="hint">{t("fields.applyHint")}</p>
          {err("applyContact")}
        </div>
      )}
    </FlowFrame>
  );
}
