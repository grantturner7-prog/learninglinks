"use client";

import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { FlowFrame, type FrameLabels } from "@/components/guided/frame";
import { Pill, Tile, CARD } from "@/components/guided/ui";
import { Icon } from "@/components/journey/icons";
import { isValidTaxId } from "@/lib/billing/tax-id";
import { formatMoney } from "@/lib/plans";
import { useRouter } from "@/i18n/navigation";
import { createFamilyOrderAction, type CheckoutResult } from "@/app/[locale]/family/actions";
import { createSchoolOrderAction } from "@/app/[locale]/school/actions";

interface InvoiceState { company: boolean; taxId: string; title: string; email: string }
const EMPTY_INVOICE: InvoiceState = { company: false, taxId: "", title: "", email: "" };

function useFrameLabels(step: number, total: number): FrameLabels {
  const t = useTranslations("billing.flow");
  return { stepOf: t("stepOf", { n: step, total }), path: t("path"), here: t("here"), stepAria: (n) => t("stepAria", { n }), leave: t("leave") };
}

function InvoiceStep({ value, onChange, error }: { value: InvoiceState; onChange: (v: InvoiceState) => void; error?: string | null }) {
  const t = useTranslations("billing.invoice");
  const te = useTranslations("billing.errors");
  const taxBad = value.company && value.taxId.trim() !== "" && !isValidTaxId(value.taxId.replace(/\s+/g, ""));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2.5">
        <Pill on={!value.company} onClick={() => onChange({ ...value, company: false })}>{t("personal")}</Pill>
        <Pill on={value.company} onClick={() => onChange({ ...value, company: true })}>{t("company")}</Pill>
      </div>
      {value.company ? (
        <div className={`${CARD} grid grid-cols-1 gap-4 md:grid-cols-2`}>
          <div>
            <label className="label" htmlFor="inv-tax">{t("taxId")}</label>
            <input id="inv-tax" className="field" inputMode="numeric" autoComplete="off" maxLength={12} value={value.taxId} onChange={(e) => onChange({ ...value, taxId: e.target.value })} aria-invalid={taxBad} />
            {taxBad ? <p role="alert" className="mt-2 text-sm font-bold text-danger-600">{te("invalid_tax_id")}</p> : null}
          </div>
          <div>
            <label className="label" htmlFor="inv-title">{t("title")}</label>
            <input id="inv-title" className="field" maxLength={120} autoComplete="organization" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
          </div>
        </div>
      ) : null}
      <div className="max-w-md">
        <label className="label" htmlFor="inv-email">{t("email")}</label>
        <input id="inv-email" type="email" className="field" autoComplete="off" value={value.email} onChange={(e) => onChange({ ...value, email: e.target.value })} />
        <p className="hint">{t("emailHint")}</p>
      </div>
      <p className="hint">{t("hint")}</p>
      {error ? <p role="alert" className="text-sm font-bold text-danger-600">{error}</p> : null}
    </div>
  );
}

function Receipt({ lines, total, note, noDiscount }: { lines: string[]; total: string | null; note: string; noDiscount?: boolean }) {
  const t = useTranslations("billing.receipt");
  return (
    <div className="rounded-[36px] bg-paper p-6 shadow-soft" aria-live="polite">
      <p className="text-sm font-extrabold uppercase tracking-wide text-brand-700">{t("title")}</p>
      <ul className="mt-4 flex flex-col gap-2 text-[15.5px] font-semibold">{lines.map((l) => <li key={l} className="flex items-start gap-2"><Icon name="check" size={18} className="mt-0.5 flex-none text-brand-700" />{l}</li>)}</ul>
      <div className="mt-5 border-t-2 border-dotted border-[#cbb8eb] pt-4">
        {total ? (
          <p className="flex items-baseline justify-between gap-3"><span className="text-sm font-bold text-ink-600">{t("total")}</span><span className="text-3xl font-extrabold tabular-nums">{total}</span></p>
        ) : (
          <p className="text-sm text-ink-600">{t("none")}</p>
        )}
      </div>
      <p className="mt-4 text-sm text-ink-600">{note}</p>
      {noDiscount ? <p className="mt-2 text-sm text-ink-600">{t("noDiscount")}</p> : null}
      <p className="mt-2 text-sm font-semibold text-ink-700">{t("never")}</p>
    </div>
  );
}

type Method = "bank_transfer" | "ecpay";
const DEFAULT_METHODS: Method[] = ["bank_transfer"];

/** Only shown while online payment is switched on. */
function MethodChooser({ value, onChange, methods }: { value: Method; onChange: (m: Method) => void; methods: Method[] }) {
  const t = useTranslations("billing.method");
  const opts: { key: Method; title: string; hint: string }[] = ([
    { key: "ecpay", title: t("online"), hint: t("onlineHint") },
    { key: "bank_transfer", title: t("bank"), hint: t("bankHint") },
  ] as { key: Method; title: string; hint: string }[]).filter((o) => methods.includes(o.key));
  return (
    <fieldset>
      <legend className="label">{t("title")}</legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {opts.map((o) => (
          <Tile key={o.key} on={value === o.key} onClick={() => onChange(o.key)}>
            <span className="text-[16px] font-extrabold leading-tight">{o.title}</span>
            <span className="text-sm text-ink-600">{o.hint}</span>
          </Tile>
        ))}
      </div>
    </fieldset>
  );
}

function AckBox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const tn = useTranslations("notice");
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-[26px] bg-brand-50 p-4">
      <input type="checkbox" className="mt-1 h-5 w-5 flex-none accent-[#2b1730]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-[15px] font-semibold leading-relaxed">{tn("acknowledge")}</span>
    </label>
  );
}

function useCheckout(run: () => Promise<CheckoutResult>) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const te = useTranslations("billing.errors");
  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await run();
      if (res.ok) router.push(`/orders/${res.orderId}`);
      else setError(te(res.error as "server"));
    } catch {
      setError(te("server"));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, submit };
}

const invoicePayload = (i: InvoiceState) => ({ company: i.company, taxId: i.taxId, title: i.title, email: i.email });

/* ------------------------------ family ------------------------------ */

export function FamilyJoin({ priceLabel, methods = DEFAULT_METHODS }: { priceLabel: string; methods?: Method[] }) {
  const t = useTranslations("billing.family");
  const tf = useTranslations("billing.flow");
  const top = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [inv, setInv] = useState(EMPTY_INVOICE);
  const [ack, setAck] = useState(false);
  const [method, setMethod] = useState<Method>(methods[0] ?? "bank_transfer");
  const { busy, error, submit } = useCheckout(() => createFamilyOrderAction({ invoice: invoicePayload(inv), acknowledged: ack, method }));
  const labels = { ...useFrameLabels(step, 3), reassure: t("reassure") };
  const go = (n: number) => { setStep(n); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const taxBad = inv.company && (!isValidTaxId(inv.taxId.replace(/\s+/g, "")) || inv.title.trim() === "");
  const sk = `s${step}` as "s1";
  const ck = `c${step}` as "c1";

  return (
    <FlowFrame
      step={step} total={3} labels={labels} cheer={t(`cheer.${ck}`)} say={step === 3 && method === "ecpay" ? t("say.s3Online") : t(`say.${sk}`)} question={t(`q.${sk}`)} error={step === 3 ? error : null}
      leaveHref="/dashboard" topRef={top} onJump={go}
      aside={<Receipt lines={[t("points.p1"), t("points.p3"), t("points.p4")]} total={priceLabel} note={useTranslations("billing.receipt")("familyTerm")} />}
      footer={
        <>
          {step > 1 ? <button type="button" className="btn btn-secondary btn-lg" onClick={() => go(step - 1)} disabled={busy}><Icon name="arrowL" size={18} />{tf("back")}</button> : null}
          {step < 3 ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => go(step + 1)} disabled={step === 2 && taxBad}>{tf("continue")}<Icon name="arrowR" size={18} /></button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void submit()} disabled={busy || !ack}>{busy ? t("placing") : t("place")}</button>
          )}
        </>
      }
    >
      {step === 1 ? (
        <ul className="flex flex-col gap-3">
          {(["p1", "p2", "p3", "p4", "p5"] as const).map((k) => (
            <li key={k} className={`${CARD} flex items-start gap-3 !p-4`}><Icon name="check" size={20} className="mt-0.5 flex-none text-brand-700" /><span className="text-[16px] font-semibold">{t(`points.${k}`)}</span></li>
          ))}
        </ul>
      ) : step === 2 ? (
        <InvoiceStep value={inv} onChange={setInv} />
      ) : (
        <div className="flex flex-col gap-5">
          {methods.length > 1 ? <MethodChooser value={method} onChange={setMethod} methods={methods} /> : null}
          <p className="text-[16px] leading-relaxed">{method === "ecpay" ? t("summaryOnline") : t("summary")}</p>
          <AckBox checked={ack} onChange={setAck} />
        </div>
      )}
    </FlowFrame>
  );
}

/* ------------------------------ school ------------------------------ */

export interface CheckoutCampus {
  id: string;
  name: string;
  place: string;
  /** ISO date the campus's latest term ends, or null if it never paid. */
  endsAt: string | null;
  active: boolean;
}

export function SchoolCheckout({ campuses, preselect, unitPrice, methods = DEFAULT_METHODS }: { campuses: CheckoutCampus[]; preselect: string[]; unitPrice: number; methods?: Method[] }) {
  const t = useTranslations("billing.school");
  const tr = useTranslations("billing.receipt");
  const tf = useTranslations("billing.flow");
  const f = useFormatter();
  const locale = useLocale();
  const top = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string[]>(() => preselect.filter((id) => campuses.some((c) => c.id === id)));
  const [inv, setInv] = useState(EMPTY_INVOICE);
  const [ack, setAck] = useState(false);
  const [method, setMethod] = useState<Method>(methods[0] ?? "bank_transfer");
  const { busy, error, submit } = useCheckout(() => createSchoolOrderAction({ campusIds: picked, invoice: invoicePayload(inv), acknowledged: ack, method }));
  const labels = { ...useFrameLabels(step, 3), reassure: t("reassure") };
  const money = (n: number) => formatMoney(n, "TWD", locale);
  const total = picked.length * unitPrice;
  const go = (n: number) => { setStep(n); top.current?.scrollIntoView({ behavior: "smooth", block: "start" }); };
  const taxBad = inv.company && (!isValidTaxId(inv.taxId.replace(/\s+/g, "")) || inv.title.trim() === "");
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const sk = `s${step}` as "s1";
  const ck = `c${step}` as "c1";

  return (
    <FlowFrame
      step={step} total={3} labels={labels} cheer={t(`cheer.${ck}`)} say={step === 3 && method === "ecpay" ? t("say.s3Online") : t(`say.${sk}`)} question={t(`q.${sk}`)} help={step === 1 ? t("pick") : null} error={step === 3 ? error : null}
      leaveHref="/dashboard" topRef={top} onJump={go}
      aside={<Receipt lines={picked.length > 0 ? [tr("campusLine", { n: picked.length, price: money(unitPrice) })] : []} total={picked.length > 0 ? money(total) : null} note={tr("term")} noDiscount />}
      footer={
        <>
          {step > 1 ? <button type="button" className="btn btn-secondary btn-lg" onClick={() => go(step - 1)} disabled={busy}><Icon name="arrowL" size={18} />{tf("back")}</button> : null}
          {step < 3 ? (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => go(step + 1)} disabled={(step === 1 && picked.length === 0) || (step === 2 && taxBad)}>{tf("continue")}<Icon name="arrowR" size={18} /></button>
          ) : (
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void submit()} disabled={busy || !ack || picked.length === 0}>{busy ? t("placing") : t("place")}</button>
          )}
        </>
      }
    >
      {step === 1 ? (
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {campuses.map((c) => {
            const status = c.endsAt
              ? c.active ? t("campusActive", { date: f.dateTime(new Date(c.endsAt), { dateStyle: "medium" }) }) : t("campusExpired", { date: f.dateTime(new Date(c.endsAt), { dateStyle: "medium" }) })
              : t("campusInactive");
            return (
              <Tile key={c.id} on={picked.includes(c.id)} onClick={() => toggle(c.id)}>
                <Icon name="landmark" size={36} stroke={1.5} className="text-brand-700" />
                <span className="text-[16px] font-extrabold leading-tight">{c.name}</span>
                <span className="text-sm text-ink-600">{c.place}</span>
                <span className="text-xs font-semibold text-ink-600">{status}</span>
              </Tile>
            );
          })}
          {/* On a phone the receipt sits below the form, so keep the running total next to the Continue button. */}
          <p className="flex items-baseline justify-between rounded-[22px] bg-brand-50 px-4 py-3 sm:col-span-2 lg:hidden" aria-live="polite">
            <span className="text-sm font-bold text-ink-700">{tr("total")}</span>
            <span className="text-xl font-extrabold tabular-nums">{picked.length > 0 ? money(total) : "—"}</span>
          </p>
        </div>
      ) : step === 2 ? (
        <InvoiceStep value={inv} onChange={setInv} />
      ) : (
        <div className="flex flex-col gap-5">
          {methods.length > 1 ? <MethodChooser value={method} onChange={setMethod} methods={methods} /> : null}
          <p className="text-[16px] leading-relaxed">{t(method === "ecpay" ? "summaryOnline" : "summary", { n: picked.length, total: money(total) })}</p>
          <AckBox checked={ack} onChange={setAck} />
        </div>
      )}
    </FlowFrame>
  );
}
