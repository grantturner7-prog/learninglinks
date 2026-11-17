import { CITIES, DISTRICTS } from "@/lib/geo/taiwan";
import { cityLabel, districtLabel } from "@/lib/geo-labels";

export interface GeoOption { key: string; label: string }

/** City and district choices (pill labels) for a locale. Same lists the educator profile uses. */
export function geoOptions(locale: string): { cities: GeoOption[]; districtsByCity: Record<string, GeoOption[]> } {
  const cities = CITIES.map((c) => ({ key: c.key, label: cityLabel(c.key, locale) }));
  const districtsByCity: Record<string, GeoOption[]> = {};
  for (const d of DISTRICTS) (districtsByCity[d.city] ??= []).push({ key: d.key, label: districtLabel(d.key, locale) });
  return { cities, districtsByCity };
}
