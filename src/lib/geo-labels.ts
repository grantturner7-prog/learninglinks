import { CITIES, DISTRICTS } from "@/lib/geo/taiwan";

const pick = (locale: string, n: { zh: string; en: string }) => (locale.startsWith("zh") ? n.zh : n.en);

export function cityLabel(key: string | null | undefined, locale: string): string {
  if (!key) return "";
  const c = CITIES.find((x) => x.key === key);
  return c ? pick(locale, c) : key;
}

export function districtLabel(key: string, locale: string): string {
  const d = DISTRICTS.find((x) => x.key === key);
  return d ? pick(locale, d) : key.split(":")[1] ?? key;
}

/** "Xitun, Nantun · Taichung City" style area text for a profile. */
export function areaLabel(city: string | null, districts: readonly string[], locale: string): string {
  const ds = districts.map((d) => districtLabel(d, locale));
  const c = cityLabel(city, locale);
  return [ds.join(locale.startsWith("zh") ? "、" : ", "), c].filter(Boolean).join(" · ");
}
