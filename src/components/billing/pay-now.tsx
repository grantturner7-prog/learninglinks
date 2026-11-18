"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { startOnlinePaymentAction } from "@/app/[locale]/orders/[id]/actions";

export interface PayNowLabels { working: string; errors: Record<string, string> }
export interface PayMethodOption { key: string; label: string; hint: string }

/**
 * "Pay now": asks the server for a freshly signed form, then submits it to ECPay's page. Nothing about the card ever
 * touches this site. The form is built here (not rendered in advance) because every visit needs its own trade number.
 */
export function PayNow({ orderId, locale, labels, methods }: { orderId: string; locale: string; labels: PayNowLabels; methods: PayMethodOption[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<{ action: string; fields: Record<string, string> } | null>(null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (form) ref.current?.submit();
  }, [form]);

  async function go(method: string) {
    setBusy(method);
    setError(null);
    try {
      const res = await startOnlinePaymentAction(orderId, locale, method);
      if (res.ok) setForm({ action: res.action, fields: res.fields });
      else {
        setError(labels.errors[res.error] ?? labels.errors.server ?? "");
        setBusy(null);
      }
    } catch {
      setError(labels.errors.server ?? "");
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {methods.map((m, i) => (
          <button key={m.key} type="button" className={`${i === 0 ? "btn btn-primary" : "btn btn-secondary"} btn-lg flex-col items-start gap-1 !rounded-3xl !whitespace-normal text-left`} onClick={() => void go(m.key)} disabled={busy !== null} data-testid={`pay-${m.key}`}>
            <span>{busy === m.key ? labels.working : m.label}</span>
            <span className="text-sm font-semibold opacity-80">{m.hint}</span>
          </button>
        ))}
      </div>
      {error ? <p role="alert" className="notice-error mt-3">{error}</p> : null}
      {form ? (
        <form ref={ref} method="post" action={form.action} hidden>
          {Object.entries(form.fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        </form>
      ) : null}
    </div>
  );
}

/** After the buyer comes back from ECPay the result can take a moment to arrive: refresh the page until it does. */
export function RefreshWhilePending({ seconds = 5, times = 24 }: { seconds?: number; times?: number }) {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= times) clearInterval(t);
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, times]);
  return null;
}
