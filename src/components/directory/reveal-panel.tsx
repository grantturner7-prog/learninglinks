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
  // The panel sits inside the dark contact card on the profile page, so its text is light and its button apricot.
  return (
    <section aria-labelledby="reveal-h">
      <h2 id="reveal-h" className="sr-only">{labels.button}</h2>
      {state.status === "ok" ? (
        <div>
          {state.alreadyRevealed ? <p className="mb-3 text-sm font-semibold text-brand-100">{labels.again}</p> : null}
          <dl className="flex flex-col gap-3 rounded-[20px] bg-brand-800 p-4">
            {state.channels.map((c) => (
              <div key={c.channel}>
                <dt className="text-[13px] font-bold text-brand-200">{labels.channels[c.channel] ?? c.channel}</dt>
                <dd className="break-all text-[17px] font-bold text-white" data-testid={`contact-${c.channel}`}>
                  {c.channel === "email" && EMAIL.test(c.value) ? <a className="text-accent-300 underline underline-offset-2 hover:text-white" href={`mailto:${c.value}`}>{c.value}</a>
                    : c.channel === "phone" && PHONE.test(c.value) ? <a className="text-accent-300 underline underline-offset-2 hover:text-white" href={`tel:${c.value.replace(/[^\d+]/g, "")}`}>{c.value}</a>
                    : c.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-brand-100">{labels.intro}</p>
          <p className="mt-2 text-sm leading-relaxed text-brand-200">{labels.care}</p>
        </div>
      ) : (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="educatorId" value={educatorId} />
          <button type="submit" className="btn btn-accent btn-lg w-full" disabled={pending}>{pending ? labels.working : labels.button}</button>
          <p className="text-sm leading-relaxed text-brand-100">{labels.intro}</p>
          <p className="text-[13px] leading-relaxed text-brand-200">{labels.left} {labels.resets}</p>
          {state.status === "denied" ? <p role="alert" className="notice-error">{labels.denied[state.reason] ?? labels.denied.server}</p> : null}
        </form>
      )}
    </section>
  );
}
