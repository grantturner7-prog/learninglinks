"use client";

import type { ReactNode, RefObject } from "react";
import { Icon } from "@/components/journey/icons";
import { LinkGuide } from "@/components/logo";
import { Link } from "@/i18n/navigation";

export interface FrameLabels {
  stepOf: string;
  path: string;
  here: string;
  /** (n, name) => aria label for a progress dot. */
  stepAria: (n: number) => string;
  leave: string;
  reassure?: string;
}

/**
 * The Concierge shell used by checkout, claim and job-post flows: a progress path, Link the guide with a speech
 * bubble, one big question, the step content, and a live preview beside it. The profile journey has its own copy of
 * this markup; the two are deliberately look-alikes.
 */
export function FlowFrame({ step, total, labels: l, cheer, say, question, help, error, children, footer, aside, leaveHref, topRef, onJump }: {
  step: number;
  total: number;
  labels: FrameLabels;
  cheer?: string;
  say: string;
  question: string;
  help?: string | null;
  error?: string | null;
  children: ReactNode;
  footer: ReactNode;
  aside?: ReactNode;
  leaveHref: string;
  topRef?: RefObject<HTMLDivElement | null>;
  onJump?: (n: number) => void;
}) {
  return (
    <div className="container-page py-6 sm:py-8" ref={topRef}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-ink-600">
        <Link href={leaveHref as "/dashboard"} className="link">{l.leave}</Link>
      </div>
      <div className={`grid grid-cols-1 items-start gap-7 ${aside ? "lg:grid-cols-[minmax(0,1fr)_380px]" : ""}`}>
        <section className="rounded-[36px] bg-paper p-6 shadow-soft sm:rounded-[48px] sm:p-10">
          <div className="flex flex-col gap-1">
            <p className="text-[15px] font-extrabold tracking-wide text-brand-700">{l.stepOf}</p>
            {cheer ? <p className="text-base font-semibold">{cheer}</p> : null}
          </div>
          <ol className="relative mt-8 hidden items-center justify-between px-1 sm:flex" aria-label={l.path}>
            <span aria-hidden className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-[3px] border-dotted border-[#cbb8eb]" />
            <span aria-hidden className="absolute left-3 top-1/2 -translate-y-1/2 border-t-4 border-ink-900" style={{ width: `calc((100% - 24px) * ${total > 1 ? (step - 1) / (total - 1) : 0})` }} />
            {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
              <li key={n} className="relative z-10">
                <button type="button" disabled={!onJump || n > step} onClick={() => onJump?.(n)} aria-current={n === step ? "step" : undefined} aria-label={l.stepAria(n)} className="flex h-11 w-11 items-center justify-center rounded-full">
                  {n < step ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-white"><Icon name="check" size={14} stroke={3} /></span>
                  ) : n === step ? (
                    <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-paper shadow-[0_0_0_4px_#f7a96b,0_22px_44px_-18px_rgb(60_25_70/0.24)]"><LinkGuide size={44} /></span>
                  ) : (
                    <span className="h-6 w-6 rounded-full bg-paper shadow-[inset_0_0_0_3px_#cbb8eb]" />
                  )}
                </button>
                {n === step ? <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent-400 px-3 py-1 text-xs font-extrabold">{l.here}</span> : null}
              </li>
            ))}
          </ol>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#f7e8e3] sm:hidden" aria-hidden><div className="h-full rounded-full bg-ink-900" style={{ width: `${(step / total) * 100}%` }} /></div>

          <div className="mt-8 flex items-center gap-4 sm:gap-5">
            <span className="flex-none"><LinkGuide size={56} /></span>
            <div className="rounded-[26px] bg-brand-50 px-5 py-4"><p className="text-base font-semibold leading-relaxed sm:text-[17.5px]">{say}</p></div>
          </div>

          <h1 className="mt-7 text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">{question}</h1>
          {help ? <p className="mt-3 max-w-2xl text-[15px] text-ink-600">{help}</p> : null}
          {error ? <div role="alert" className="notice-error mt-5">{error}</div> : null}

          <div className="mt-7">{children}</div>

          {l.reassure ? <p className="mt-7 flex items-center justify-center gap-2 rounded-full bg-brand-50 px-4 py-3 text-center text-sm font-medium text-ink-600"><Icon name="lock" size={16} className="flex-none text-brand-700" />{l.reassure}</p> : null}

          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{footer}</div>
        </section>
        {aside ? <aside data-testid="flow-aside" className="lg:sticky lg:top-6">{aside}</aside> : null}
      </div>
    </div>
  );
}
