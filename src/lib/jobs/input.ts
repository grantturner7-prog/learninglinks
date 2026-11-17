import { isCityKey } from "@/lib/geo/taiwan";
import { TW_DISTRICT_ANCHORS } from "@/lib/geo/tw-centroids.generated";
import { firstFindingKind } from "@/lib/educators/contact-scan";
import type { FormLike } from "@/lib/educators/profile-input";
import { LEVELS, SUBJECTS, isOneOf } from "@/lib/taxonomy";

export { JOB_LIMITS, MAX_OPEN_JOBS_PER_ORG, looksLikeSubstituteWork } from "./rules";
import { JOB_LIMITS, looksLikeSubstituteWork } from "./rules";

export type JobErrorCode = "required" | "tooShort" | "tooLong" | "invalid" | "substitute" | "idNumber" | "address" | "salaryOrder" | "salaryRange" | "salaryUnit" | "dateRange";
export type JobFieldErrors = Partial<Record<string, JobErrorCode>>;

export interface JobInput {
  title: string;
  type: "full_time" | "part_time";
  description: string | null;
  subjects: string[];
  levels: string[];
  city: string | null;
  district: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryUnit: "month" | "hour" | null;
  startsOn: string | null;
  applyContact: string;
}

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const oneLine = (s: string) => s.replace(CONTROL, "").replace(/\s+/g, " ").trim();
const multiLine = (s: string) => s.replace(CONTROL, "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
const text = (fd: FormLike, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

function pickAll<T extends string>(fd: FormLike, name: string, allowed: readonly T[], max: number): T[] {
  const out: T[] = [];
  for (const v of fd.getAll(name)) {
    if (isOneOf(allowed, v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

function wholeNumber(raw: string): number | null | "bad" {
  const s = raw.replace(/[,\s]/g, "");
  if (!s) return null;
  if (!/^\d{1,8}$/.test(s)) return "bad";
  return Number(s);
}

export function parseJobForm(fd: FormLike, now: Date = new Date()): { values: JobInput; errors: JobFieldErrors } {
  const errors: JobFieldErrors = {};

  const title = oneLine(text(fd, "title"));
  if (!title) errors.title = "required";
  else if (title.length < 3) errors.title = "tooShort";
  else if (title.length > JOB_LIMITS.title) errors.title = "tooLong";

  const typeRaw = text(fd, "type");
  const type = typeRaw === "part_time" ? "part_time" : "full_time";
  if (typeRaw !== "full_time" && typeRaw !== "part_time") errors.type = "required";

  const description = multiLine(text(fd, "description"));
  if (description.length > JOB_LIMITS.description) errors.description = "tooLong";

  for (const [k, v] of [["title", title], ["description", description]] as const) {
    if (errors[k]) continue;
    if (looksLikeSubstituteWork(v)) errors[k] = "substitute";
    else {
      const kind = firstFindingKind(v);
      if (kind === "id_number") errors[k] = "idNumber";
      else if (kind === "address") errors[k] = "address";
    }
  }

  const subjects = pickAll(fd, "subjects", SUBJECTS, JOB_LIMITS.subjects);
  const levels = pickAll(fd, "levels", LEVELS, JOB_LIMITS.levels);

  const cityRaw = text(fd, "city");
  const city = isCityKey(cityRaw) ? cityRaw : null;
  const districtRaw = text(fd, "district");
  const district = city && districtRaw && districtRaw.startsWith(`${city}:`) && districtRaw in TW_DISTRICT_ANCHORS ? districtRaw : null;
  if (!city) errors.city = "required";

  const min = wholeNumber(text(fd, "salaryMin"));
  const max = wholeNumber(text(fd, "salaryMax"));
  const unitRaw = text(fd, "salaryUnit");
  const salaryUnit = unitRaw === "hour" ? "hour" : unitRaw === "month" ? "month" : null;
  if (min === "bad" || max === "bad" || (typeof min === "number" && min > JOB_LIMITS.salaryMax) || (typeof max === "number" && max > JOB_LIMITS.salaryMax)) errors.salaryMin = "salaryRange";
  else if (typeof min === "number" && typeof max === "number" && min > max) errors.salaryMin = "salaryOrder";
  if ((typeof min === "number" || typeof max === "number") && !salaryUnit) errors.salaryUnit = "salaryUnit";

  const startsRaw = text(fd, "startsOn").trim();
  let startsOn: string | null = null;
  if (startsRaw) {
    const t = Date.parse(startsRaw);
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(startsRaw) && !Number.isNaN(t);
    // Not in the past by more than a day, and not more than two years away.
    if (!ok || t < now.getTime() - 86_400_000 || t > now.getTime() + 2 * 365 * 86_400_000) errors.startsOn = "dateRange";
    else startsOn = startsRaw;
  }

  const applyContact = oneLine(text(fd, "applyContact"));
  if (!applyContact) errors.applyContact = "required";
  else if (applyContact.length < 3) errors.applyContact = "tooShort";
  else if (applyContact.length > JOB_LIMITS.applyContact) errors.applyContact = "tooLong";
  else if (firstFindingKind(applyContact) === "id_number") errors.applyContact = "idNumber";

  return {
    values: {
      title, type, description: description || null, subjects, levels, city, district,
      salaryMin: typeof min === "number" ? min : null,
      salaryMax: typeof max === "number" ? max : null,
      salaryUnit: typeof min === "number" || typeof max === "number" ? salaryUnit : null,
      startsOn, applyContact,
    },
    errors,
  };
}
