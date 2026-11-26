"use client";

import { startTransition, useActionState, type FormEvent } from "react";
import { refundOrderAction, type AdminResult } from "@/app/[locale]/admin/actions";

export interface EndableMembership {
  id: string;
  label: string;
  runs: string;
}

/**
 * Admin: record a refund and/or end memberships on a paid order. The site never sends money: the admin sends it first
 * (ECPay merchant back office, or a bank transfer) and records it here. `requestId` is rendered by the server, so a
 * double click or a retry is recorded once.
 */
export function RefundForm({ orderId, requestId, today, refundable, endable, buyerEmail }: { orderId: string; requestId: string; today: string; refundable: number; endable: EndableMembership[]; buyerEmail: string | null }) {
  const [state, dispatch, pending] = useActionState<AdminResult | null, FormData>(refundOrderAction, null);
  const id = (k: string) => `${k}-${orderId}`;
  // Not <form action>: React clears every field after a form action finishes, even a refused one, and the admin would
  // have to retype the reason and tick the box again. Here the fields stay as typed; after a success the page is
  // re-rendered with a new requestId, and `key` below gives a fresh, empty form.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return (
    <form key={requestId} onSubmit={submit} className="mt-4 flex flex-col gap-4 rounded-2xl border-2 border-dotted border-ink-300 p-4" data-testid="refund-form">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="requestId" value={requestId} />
      <h3 className="text-lg font-extrabold">Refund or end membership</h3>

      {endable.length > 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="label">End membership now</legend>
          {endable.map((m) => (
            <label key={m.id} className="flex items-start gap-3">
              <input type="checkbox" name="end" value={m.id} className="mt-1 h-5 w-5 flex-none accent-ink-900" />
              <span><b>{m.label}</b> <span className="text-sm text-ink-600">{m.runs}</span></span>
            </label>
          ))}
          <p className="hint">The member loses access the moment you press the button. Nothing else on the account is touched.</p>
        </fieldset>
      ) : (
        <p className="text-sm text-ink-600">No membership on this order is still running, so there is nothing to end.</p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_12rem_10rem]">
        <div>
          <label className="label" htmlFor={id("amount")}>Refund (NT$)</label>
          <input id={id("amount")} name="amount" className="field" inputMode="numeric" defaultValue={0} disabled={refundable === 0} aria-describedby={id("amount-hint")} />
        </div>
        <div>
          <label className="label" htmlFor={id("method")}>Sent back by</label>
          <select id={id("method")} name="method" className="field" defaultValue="ecpay_backoffice" disabled={refundable === 0}>
            <option value="ecpay_backoffice">ECPay back office</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="other">Something else</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor={id("on")}>Sent on</label>
          <input id={id("on")} name="refundedOn" type="date" className="field" defaultValue={today} disabled={refundable === 0} />
        </div>
      </div>
      <p id={id("amount-hint")} className="hint -mt-2">
        {refundable > 0 ? `Up to NT$${refundable.toLocaleString("en-US")} can still be refunded on this order. Leave 0 to end a membership without refunding.` : "The whole amount has already been refunded."} This site does not send money: send it first in the ECPay merchant back office (or by bank transfer), then record it here.
      </p>

      <div>
        <label className="label" htmlFor={id("reason")}>Reason (kept in the record)</label>
        <input id={id("reason")} name="reason" className="field" maxLength={300} required />
      </div>

      {buyerEmail ? (
        <label className="flex items-start gap-3">
          <input type="checkbox" name="notify" defaultChecked className="mt-1 h-5 w-5 flex-none accent-ink-900" />
          <span>Email the buyer ({buyerEmail}) to say what was done</span>
        </label>
      ) : null}

      <label className="flex items-start gap-3">
        <input type="checkbox" name="understood" required className="mt-1 h-5 w-5 flex-none accent-ink-900" />
        <span>I understand this takes effect straight away and cannot be undone from here. Any money has already been sent back, or none is being returned.</span>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Recording…" : "Record it"}</button>
        {state ? <p role="status" className={`text-sm font-bold ${state.ok ? "text-brand-800" : "text-danger-600"}`}>{state.message}</p> : null}
      </div>
    </form>
  );
}
