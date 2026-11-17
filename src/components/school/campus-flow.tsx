"use client";

import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { FlowFrame } from "@/components/guided/frame";
import { Pill, Tile, CARD } from "@/components/guided/ui";
import { Icon } from "@/components/journey/icons";
import { LinkGuide } from "@/components/logo";
import type { GeoOption } from "@/lib/geo-options";
import { SCHOOL_TYPES } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";
import { addCampusAction, claimCampusAction, type ClaimResult } from "@/app/[locale]/school/actions";

const ROLES = ["director", "owner", "admin", "teacher"] as const;

interface Props {
  /** Claim an existing listing (2 steps) or add a missing campus (4 steps). */
  mode: "claim" | "add";
  organizationId?: string;
  organizationName?: string;
  cities: GeoOption[];
  districtsByCity: Record<string, GeoOption[]>;
}

export function CampusFlow(p: Props) {
  const tc = useTranslations("school.claim");
  const ta = useTranslations("school.add");
  const tf = useTranslations("school.flow");
  const te = useTranslations("school.errors");
  const tn = useTranslations("notice");
  const tt = useTranslations("taxonomy");
  const tcamp = useTranslations("school.campuses");
  const top = useRef<HTMLDivElement>(null);

  const total = p.mode === "claim" ? 2 : 4;
  const [step, setStep] = useState(1);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [campus, setCampus] = useState({ name: "", type: "", city: "", district: "" });
  const [who, setWho] = useState({ name: "", role: "", phone: "", note: "" });
  const go = (n: number) => { setStep(n); setError(null); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  // In "add" mode the first two steps are about the campus; the last two are about the person (same as "claim").
  const campusSteps = p.mode === "add" ? 2 : 0;
  const personStep = step - campusSteps; // 1 = who, 2 = phone
  const sk = `s${step}` as "s1";

  const canNext =
    p.mode === "add" && step === 1 ? campus.name.trim().length >= 2 && campus.type !== ""
    : p.mode === "add" && step === 2 ? campus.city !== ""
    : personStep === 1 ? who.name.trim().length >= 2 && who.role.trim().length >= 2
    : true;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const claim = { contactName: who.name, contactRole: who.role, contactPhone: who.phone, note: who.note };
      const res: ClaimResult = p.mode === "claim"
        ? await claimCampusAction({ organizationId: p.organizationId!, claim, acknowledged: ack })
        : await addCampusAction({ campus: { ...claim, name: campus.name, type: campus.type, city: campus.city, district: campus.district || undefined }, acknowledged: ack });
      if (res.ok) setDone(true);
      else setError(te(res.error as "server"));
    } catch {
      setError(te("server"));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="container-page py-10">
        <section className="mx-auto flex max-w-2xl flex-col items-center gap-4 rounded-[36px] bg-paper p-10 text-center shadow-soft">
          <LinkGuide size={96} />
          <h1 className="text-4xl font-extrabold tracking-tight">{tc("doneTitle")}</h1>
          <p className="max-w-md text-lg text-ink-600">{tc("doneBody")}</p>
          <Link href="/school/campuses" className="btn btn-primary btn-lg mt-2">{tcamp("title")}</Link>
        </section>
      </div>
    );
  }

  const labels = { stepOf: tf("stepOf", { n: step, total }), path: tf("path"), here: tf("here"), stepAria: (n: number) => tf("stepAria", { n }), leave: tf("leave"), reassure: p.mode === "claim" ? tc("reassure") : ta("reassure") };
  const districts = p.districtsByCity[campus.city] ?? [];
  const cheer = p.mode === "claim" ? tc(`cheer.c${step}` as "cheer.c1") : ta(`cheer.c${step}` as "cheer.c1");
  const say = p.mode === "claim" ? tc(`say.${sk}` as "say.s1") : ta(`say.${sk}` as "say.s1");
  const question = p.mode === "claim" ? tc(`q.${sk}` as "q.s1") : ta(`q.${sk}` as "q.s1");

  return (
    <FlowFrame
      step={step} total={total} labels={labels} cheer={cheer} say={say} question={question} error={error} leaveHref="/school/campuses" topRef={top} onJump={go}
      help={p.mode === "claim" && step === 1 && p.organizationName ? tc("claiming", { name: p.organizationName }) : null}
      footer={
        <>
          {step > 1 ? <button type="button" className="btn btn-secondary btn-lg" onClick={() => go(step - 1)} disabled={busy}><Icon name="arrowL" size={18} />{tf("back")}</button> : null}
          {step < total ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => go(step + 1)} disabled={!canNext}>{tf("continue")}<Icon name="arrowR" size={18} /></button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void submit()} disabled={busy || !ack || who.phone.replace(/\D/g, "").length < 8}>{busy ? tc("sending") : tc("submit")}</button>
          )}
        </>
      }
    >
      {p.mode === "add" && step === 1 ? (
        <div className="flex flex-col gap-7">
          <div>
            <label htmlFor="c-name" className="sr-only">{ta("fields.name")}</label>
            <input id="c-name" className="field !min-h-14 !text-xl" autoFocus maxLength={120} autoComplete="off" placeholder={ta("fields.name")} value={campus.name} onChange={(e) => setCampus({ ...campus, name: e.target.value })} />
          </div>
          <fieldset>
            <legend className="label">{ta("fields.type")}</legend>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {SCHOOL_TYPES.map((k) => <Tile key={k} on={campus.type === k} onClick={() => setCampus({ ...campus, type: k })}><span className="text-[15px] font-bold leading-tight">{tt(`schoolTypes.${k}` as "schoolTypes.cram_school")}</span></Tile>)}
            </div>
          </fieldset>
        </div>
      ) : p.mode === "add" && step === 2 ? (
        <div className="flex flex-col gap-7">
          <fieldset>
            <legend className="label">{ta("fields.city")}</legend>
            <div className="flex flex-wrap gap-2.5">{p.cities.map((c) => <Pill key={c.key} on={campus.city === c.key} onClick={() => setCampus({ ...campus, city: c.key, district: "" })}>{c.label}</Pill>)}</div>
          </fieldset>
          {districts.length > 0 ? (
            <fieldset>
              <legend className="label">{ta("fields.district")}</legend>
              <div className="flex flex-wrap gap-2.5">{districts.map((d) => <Pill key={d.key} on={campus.district === d.key} onClick={() => setCampus({ ...campus, district: campus.district === d.key ? "" : d.key })}>{d.label}</Pill>)}</div>
            </fieldset>
          ) : null}
        </div>
      ) : personStep === 1 ? (
        <div className="flex flex-col gap-6">
          <div>
            <label className="label" htmlFor="w-name">{tc("fields.name")}</label>
            <input id="w-name" className="field !min-h-14 !text-xl" autoFocus maxLength={80} autoComplete="name" value={who.name} onChange={(e) => setWho({ ...who, name: e.target.value })} />
          </div>
          <fieldset>
            <legend className="label">{tc("fields.role")}</legend>
            <div className="flex flex-wrap gap-2.5">
              {ROLES.map((r) => <Pill key={r} on={who.role === tc(`roles.${r}`)} onClick={() => setWho({ ...who, role: tc(`roles.${r}`) })}>{tc(`roles.${r}`)}</Pill>)}
            </div>
          </fieldset>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="max-w-md">
            <label className="label" htmlFor="w-phone">{tc("fields.phone")}</label>
            <input id="w-phone" className="field !min-h-14 !text-xl" inputMode="tel" autoFocus autoComplete="tel" maxLength={20} value={who.phone} onChange={(e) => setWho({ ...who, phone: e.target.value })} />
          </div>
          <div className="max-w-xl">
            <label className="label" htmlFor="w-note">{tc("fields.note")}</label>
            <textarea id="w-note" rows={3} className="field" maxLength={500} value={who.note} onChange={(e) => setWho({ ...who, note: e.target.value })} />
          </div>
          <label className={`${CARD} flex cursor-pointer items-start gap-3`}>
            <input type="checkbox" className="mt-1 h-5 w-5 flex-none accent-[#2b1730]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
            <span className="text-[15px] font-semibold leading-relaxed">{tn("acknowledge")}</span>
          </label>
        </div>
      )}
    </FlowFrame>
  );
}
