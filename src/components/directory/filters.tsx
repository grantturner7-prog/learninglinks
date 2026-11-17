"use client";

import { useState } from "react";

export interface FilterOption { key: string; label: string }
export interface FilterLabels {
  title: string; subject: string; level: string; city: string; district: string; language: string; mode: string; any: string; apply: string; clear: string;
}

/** A plain GET form: filters live in the URL, so results are shareable within a session and the back button works. */
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
    <div>
      <label className="label" htmlFor={`f-${name}`}>{label}</label>
      <select id={`f-${name}`} name={name} className="field" defaultValue={onChange ? undefined : value ?? ""} value={onChange ? value : undefined} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
        <option value="">{l.any}</option>
        {options.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
      </select>
    </div>
  );
  const active = ["subject", "level", "city", "district", "language", "mode"].filter((k) => values[k]).length;
  return (
    <div className="card p-5">
      {/* On phones the filters fold away so the map comes first; from lg up they are always open. */}
      <button type="button" className="flex w-full items-center justify-between gap-2 text-left lg:hidden" aria-expanded={open} aria-controls="dir-filters" onClick={() => setOpen((o) => !o)}>
        <span className="font-bold">{l.title}{active > 0 ? <span className="badge ml-2">{active}</span> : null}</span>
        <span aria-hidden className="text-xl leading-none">{open ? "−" : "+"}</span>
      </button>
    <form id="dir-filters" method="get" className={`${open ? "flex" : "hidden"} mt-3 flex-col gap-3 lg:mt-0 lg:flex`} aria-label={l.title}>
      {Object.entries(props.hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <h2 className="hidden text-base font-bold lg:block">{l.title}</h2>
      {select("subject", l.subject, props.subjects, values.subject)}
      {select("level", l.level, props.levels, values.level)}
      {select("city", l.city, props.cities, city, setCity)}
      {districts.length > 0 ? <div key={city}>{select("district", l.district, districts, values.district)}</div> : null}
      {select("language", l.language, props.languages, values.language)}
      {select("mode", l.mode, props.modes, values.mode)}
      <button type="submit" className="btn btn-primary">{l.apply}</button>
      <a href={props.clearHref} className="link text-center text-sm">{l.clear}</a>
    </form>
    </div>
  );
}
