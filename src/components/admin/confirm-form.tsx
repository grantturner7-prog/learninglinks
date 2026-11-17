"use client";

import { useActionState } from "react";
import { confirmOrderAction, type AdminResult } from "@/app/[locale]/admin/actions";

/** Admin: "the transfer arrived". The amount must equal the order total or the server refuses. */
export function ConfirmForm({ orderId, amount, today, locale }: { orderId: string; amount: number; today: string; locale: string }) {
  const [state, action, pending] = useActionState<AdminResult | null, FormData>(confirmOrderAction, null);
  return (
    <form action={action} className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-[8rem_10rem_1fr_auto]">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="locale" value={locale} />
      <div><label className="label" htmlFor={`amt-${orderId}`}>Received (NT$)</label><input id={`amt-${orderId}`} name="amount" className="field" inputMode="numeric" defaultValue={amount} required /></div>
      <div><label className="label" htmlFor={`on-${orderId}`}>Received on</label><input id={`on-${orderId}`} name="receivedOn" type="date" className="field" defaultValue={today} required /></div>
      <div><label className="label" htmlFor={`note-${orderId}`}>Note (optional)</label><input id={`note-${orderId}`} name="note" className="field" maxLength={300} /></div>
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Confirming…" : "Confirm payment"}</button>
      {state ? <p role="status" className={`sm:col-span-4 text-sm font-bold ${state.ok ? "text-brand-800" : "text-danger-600"}`}>{state.message}</p> : null}
    </form>
  );
}
