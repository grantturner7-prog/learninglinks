"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";

export interface StartOption {
  key: string;
  label: string;
}
export type StartWho = "family" | "school" | "educator";
export interface StartLabels {
  label: string;
  who: string;
  family: string;
  school: string;
  educator: string;
  subject: string;
  anySubject: string;
  near: string;
  anywhere: string;
  go: string;
}

function Segment({ id, caption, first, children }: { id: string; caption: string; first?: boolean; children: ReactNode }) {
  return (
    <label
      htmlFor={id}
      className={`relative flex min-h-[62px] min-w-0 flex-1 cursor-pointer flex-col justify-center rounded-2xl px-4 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus has-[:disabled]:cursor-default ${first ? "bg-accent-300" : "bg-white md:rounded-none md:border-l md:border-ink-200"}`}
    >
      <span className="text-xs font-bold text-ink-600">{caption}</span>
      {children}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute bottom-3.5 right-3.5 text-ink-900">
        <path d="M6 9l6 6 6-6" />
      </svg>
    </label>
  );
}

const SELECT = "w-full cursor-pointer appearance-none truncate bg-transparent pr-7 text-[17px] font-extrabold text-ink-900 outline-none disabled:cursor-default disabled:opacity-50";

/**
 * The start bar on the home page: who you are, what you are looking for and where. It only chooses where to go next.
 * Families and schools go to the find page (which shows educators to paying members only, and the members-only page
 * to everyone else); educators go to the jobs map, or to the free sign-up. Without JavaScript it is a plain form to
 * the find page.
 */
export function StartBar({ labels: l, cities, subjects, initialWho = "family", educatorHref, action }: {
  labels: StartLabels;
  cities: StartOption[];
  subjects: StartOption[];
  initialWho?: StartWho;
  /** Where "An educator" goes: the jobs map when signed in as one, the free sign-up otherwise. */
  educatorHref: string;
  /** The find page of this locale, for the plain-form fallback. */
  action: string;
}) {
  const router = useRouter();
  const [who, setWho] = useState<StartWho>(initialWho);
  const [subject, setSubject] = useState("");
  const [city, setCity] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = new URLSearchParams();
    if (city) q.set("city", city);
    if (who === "educator") {
      const s = q.toString();
      router.push(educatorHref === "/jobs" && s ? `/jobs?${s}` : educatorHref);
      return;
    }
    if (subject) q.set("subject", subject);
    const s = q.toString();
    router.push(`/educators${s ? `?${s}` : ""}`);
  };

  return (
    <form action={action} method="get" onSubmit={onSubmit} role="search" aria-label={l.label} className="flex w-full flex-col gap-1.5 rounded-[24px] border border-ink-200 bg-white p-2 text-left shadow-soft md:flex-row md:items-stretch" data-testid="start-bar">
      <Segment id="start-who" caption={l.who} first>
        <select id="start-who" className={SELECT} value={who} onChange={(e) => setWho(e.target.value as StartWho)}>
          <option value="family">{l.family}</option>
          <option value="school">{l.school}</option>
          <option value="educator">{l.educator}</option>
        </select>
      </Segment>
      <Segment id="start-subject" caption={l.subject}>
        <select id="start-subject" name="subject" className={SELECT} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={who === "educator"}>
          <option value="">{l.anySubject}</option>
          {subjects.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </Segment>
      <Segment id="start-city" caption={l.near}>
        <select id="start-city" name="city" className={SELECT} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">{l.anywhere}</option>
          {cities.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </Segment>
      <button type="submit" className="btn btn-primary btn-lg flex-none md:min-h-[62px] md:px-8">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        {l.go}
      </button>
    </form>
  );
}
