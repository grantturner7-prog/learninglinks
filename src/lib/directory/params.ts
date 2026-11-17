import { CITIES, DISTRICTS } from "@/lib/geo/taiwan";
import { LANGUAGES, LEVELS, SUBJECTS, TEACHING_MODES, isOneOf } from "@/lib/taxonomy";
import type { DirectoryFilters } from "./service";

type Raw = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Turn URL query parameters into filters, dropping anything that is not a known value. */
export function parseDirectoryFilters(sp: Raw): DirectoryFilters {
  const city = one(sp.city);
  const district = one(sp.district);
  const subject = one(sp.subject);
  const level = one(sp.level);
  const language = one(sp.language);
  const mode = one(sp.mode);
  const page = Number(one(sp.page));
  const validCity = CITIES.some((c) => c.key === city) ? city : undefined;
  return {
    subject: isOneOf(SUBJECTS, subject) ? subject : undefined,
    level: isOneOf(LEVELS, level) ? level : undefined,
    language: isOneOf(LANGUAGES, language) ? language : undefined,
    mode: isOneOf(TEACHING_MODES, mode) ? mode : undefined,
    city: validCity,
    district: validCity && DISTRICTS.some((d) => d.key === district && d.city === validCity) ? district : undefined,
    page: Number.isInteger(page) && page > 0 && page < 1000 ? page : 1,
  };
}
