"use client";

import { useState } from "react";

export interface FilterOption { key: string; label: string }
export interface FilterLabels {
  title: string; subject: string; level: string; city: string; district: string; language: string; mode: string; any: string; apply: string; clear: string;
}

/**
 * A plain GET form: filters live in the URL, so results are shareable within a session and the back button works.
 * From lg up it is one white bar across the top of the page, each choice a soft pill that turns amber once it is
 * set; on phones it folds away so the map and the list come first.
 */
export function DirectoryFilters(props: {
  labels: FilterLabels;
  subjects: FilterOption[];
  levels: FilterOption[];
  cities: FilterOption[];
  districtsByCity: Record<string, FilterOption[]>;
  languages: FilterOption[];
  modes: FilterOption[];
  values: Record<string, string | undefined>;
  clearHref: string;
  hidden?: Record<string, string>;
}) {
  const { labels: l, values } = props;
  const [city, setCity] = useState(values.city ?? "");
  const [open, setOpen] = useState(false);
  const districts = props.districtsByCity[city] ?? [];
  const select = (name: string, label: string, options: FilterOption[], value?: string, onChange?: (v: string) => void) => {
    const set = Boolean(onChange ? value : values[name]);
    return (
      <label
        htmlFor={`f-${name}`}
        className={`relative flex min-h-[56px] min-w-0 cursor-pointer flex-col justify-center rounded-[14px] px-3.5 py-1.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus lg:flex-1 ${set ? "bg-accent-300" : "bg-ink-50"}`}
      >
        <span className="text-xs font-bold text-ink-600">{label}</span>
        <select
          id={`f-${name}`}
          name={name}
          className="w-full cursor-pointer appearance-none truncate bg-transparent pr-6 text-[15px] font-extrabold text-ink-900 outline-none"
          defaultValue={onChange ? undefined : value ?? ""}
          value={onChange ? value : undefined}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        >
          <option value="">{l.any}</option>
          {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute bottom-3 right-3 text-ink-900">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </label>
    );
  };
  const active = ["subject", "level", "city", "district", "language", "mode"].filter((k) => values[k]).length;
  return (
    <div>
      <button type="button" className="flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl border-[1.5px] border-ink-400 bg-paper px-5 text-left lg:hidden" aria-expanded={open} aria-controls="dir-filters" onClick={() => setOpen((o) => !o)}>
        <span className="font-bold">{l.title}{active > 0 ? <span className="badge ml-2">{active}</span> : null}</span>
        <span aria-hidden className="text-xl leading-none">{open ? "−" : "+"}</span>
      </button>
      <form id="dir-filters" method="get" className={`${open ? "flex" : "hidden"} mt-3 flex-col gap-1.5 rounded-[22px] border border-ink-200 bg-white p-2 shadow-card lg:mt-0 lg:flex lg:flex-row lg:items-stretch`} aria-label={l.title}>
        {Object.entries(props.hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {select("city", l.city, props.cities, city, setCity)}
        {districts.length > 0 ? <div key={city} className="contents">{select("district", l.district, districts, values.district)}</div> : null}
        {select("subject", l.subject, props.subjects, values.subject)}
        {select("level", l.level, props.levels, values.level)}
        {select("language", l.language, props.languages, values.language)}
        {select("mode", l.mode, props.modes, values.mode)}
        <button type="submit" className="btn btn-primary min-h-[56px] rounded-[14px] lg:flex-none">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          {l.apply}
        </button>
        {active > 0 ? <a href={props.clearHref} className="link self-center px-2 text-sm lg:inline-flex lg:min-h-11 lg:flex-none lg:items-center">{l.clear}</a> : null}
      </form>
    </div>
  );
}
