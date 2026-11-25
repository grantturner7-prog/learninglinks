"use client";

import { useState } from "react";

export interface FilterOption { key: string; label: string }
export interface FilterLabels {
  title: string; subject: string; level: string; city: string; district: string; language: string; mode: string; any: string; apply: string; clear: string;
}

/**
 * A plain GET form: filters live in the URL, so results are shareable within a session and the back button works.
 * From lg up it is one row across the top of the page; on phones it folds away so the map and the list come first.
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
  const select = (name: string, label: string, options: FilterOption[], value?: string, onChange?: (v: string) => void) => (
    <div className="lg:w-[150px] lg:flex-none">
      <label className="mb-1 block text-xs font-bold text-ink-600" htmlFor={`f-${name}`}>{label}</label>
      <select
        id={`f-${name}`}
        name={name}
        className={`field rounded-full py-2 text-sm font-semibold ${(onChange ? value : values[name]) ? "border-brand-700 bg-brand-50" : ""}`}
        defaultValue={onChange ? undefined : value ?? ""}
        value={onChange ? value : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      >
        <option value="">{l.any}</option>
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </div>
  );
  const active = ["subject", "level", "city", "district", "language", "mode"].filter((k) => values[k]).length;
  return (
    <div>
      <button type="button" className="flex min-h-11 w-full items-center justify-between gap-2 rounded-full border-2 border-ink-200 bg-paper px-5 text-left lg:hidden" aria-expanded={open} aria-controls="dir-filters" onClick={() => setOpen((o) => !o)}>
        <span className="font-bold">{l.title}{active > 0 ? <span className="badge ml-2">{active}</span> : null}</span>
        <span aria-hidden className="text-xl leading-none">{open ? "−" : "+"}</span>
      </button>
      <form id="dir-filters" method="get" className={`${open ? "flex" : "hidden"} mt-3 flex-col gap-3 lg:mt-0 lg:flex lg:flex-row lg:flex-wrap lg:items-end`} aria-label={l.title}>
        {Object.entries(props.hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        {select("city", l.city, props.cities, city, setCity)}
        {districts.length > 0 ? <div key={city} className="contents">{select("district", l.district, districts, values.district)}</div> : null}
        {select("subject", l.subject, props.subjects, values.subject)}
        {select("level", l.level, props.levels, values.level)}
        {select("language", l.language, props.languages, values.language)}
        {select("mode", l.mode, props.modes, values.mode)}
        <button type="submit" className="btn btn-primary lg:flex-none">{l.apply}</button>
        {active > 0 ? <a href={props.clearHref} className="link self-center text-sm lg:ml-1 lg:inline-flex lg:min-h-11 lg:items-center">{l.clear}</a> : null}
      </form>
    </div>
  );
}
