"use client";

import { useActionState } from "react";
import { revealContactAction, type RevealState } from "@/app/[locale]/educators/[id]/reveal-action";

export interface RevealLabels {
  button: string;
  working: string;
  intro: string;
  left: string;
  resets: string;
  again: string;
  care: string;
  /** channel key -> label */
  channels: Record<string, string>;
  /** denied reason -> message */
  denied: Record<string, string>;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^\+?[\d\s()-]{6,20}$/;

/**
 * The one place a member asks for an educator's contact details. Nothing is sent to the page until they press the
 * button; the server decides (active membership, audience, daily cap) and logs it.
 */
export function RevealPanel({ educatorId, labels }: { educatorId: string; labels: RevealLabels }) {
  const [state, action, pending] = useActionState<RevealState, FormData>(revealContactAction, { status: "idle" });
  return (
    <section aria-labelledby="reveal-h" className="rounded-[26px] bg-brand-50 p-5">
      <h2 id="reveal-h" className="sr-only">{labels.button}</h2>
      {state.status === "ok" ? (
        <div>
          {state.alreadyRevealed ? <p className="mb-3 text-sm font-semibold text-ink-700">{labels.again}</p> : null}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-[auto_1fr]">
            {state.channels.map((c) => (
              <div key={c.channel} className="contents">
                <dt className="font-bold text-ink-600">{labels.channels[c.channel] ?? c.channel}</dt>
                <dd className="break-all font-semibold" data-testid={`contact-${c.channel}`}>
                  {c.channel === "email" && EMAIL.test(c.value) ? <a className="link" href={`mailto:${c.value}`}>{c.value}</a>
                    : c.channel === "phone" && PHONE.test(c.value) ? <a className="link" href={`tel:${c.value.replace(/[^\d+]/g, "")}`}>{c.value}</a>
                    : c.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm text-ink-700">{labels.intro}</p>
          <p className="mt-2 text-sm text-ink-600">{labels.care}</p>
        </div>
      ) : (
        <form action={action} className="flex flex-col items-start gap-3">
          <input type="hidden" name="educatorId" value={educatorId} />
          <p className="text-[15px] text-ink-700">{labels.intro}</p>
          <button type="submit" className="btn btn-primary btn-lg" disabled={pending}>{pending ? labels.working : labels.button}</button>
          <p className="hint">{labels.left} {labels.resets}</p>
          {state.status === "denied" ? <p role="alert" className="notice-error">{labels.denied[state.reason] ?? labels.denied.server}</p> : null}
        </form>
      )}
    </section>
  );
}
