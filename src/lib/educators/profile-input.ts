import type { Credential } from "@/lib/db/schema/domain";
import { CITIES, DISTRICTS } from "@/lib/geo/taiwan";
import {
  EXPERIENCE_BANDS, LANGUAGES, LEVELS, OPEN_TO, SUBJECTS, TEACHING_MODES, WORK_AUTHORIZATION, isOneOf,
} from "@/lib/taxonomy";
import { scanFreeText, type FindingKind } from "./contact-scan";

export const LIMITS = {
  displayName: 40,
  headline: 100,
  bio: 600,
  credentialLabel: 80,
  credentialUrl: 300,
  credentials: 6,
  maxRate: 20_000,
} as const;

export type ContactChannel = "email" | "line" | "whatsapp" | "wechat" | "phone";
export const CONTACT_CHANNELS: readonly ContactChannel[] = ["email", "line", "whatsapp", "wechat", "phone"];
export type ContactsInput = Partial<Record<ContactChannel, string>>;

export interface ProfileInput {
  displayName: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  districts: string[];
  subjects: string[];
  levels: string[];
  languages: string[];
  teachingModes: string[];
  openTo: string[];
  workAuthorization: string | null;
  experienceBand: string | null;
  rateMin: number | null;
  rateMax: number | null;
  credentials: Credential[];
  contacts: ContactsInput;
}

/** Stable codes; the UI looks up the wording under `educator.errors.<code>` in both languages. */
export type FieldErrorCode =
  | "required" | "tooLong" | "nameChars" | "contactInfo" | "idNumber" | "address" | "rateOrder" | "rateRange"
  | "invalidEmail" | "invalidPhone" | "invalidLine" | "invalidWechat" | "invalidUrl" | "invalidYear";

export type FieldErrors = Partial<Record<string, FieldErrorCode>>;

export interface FormLike {
  get(name: string): FormDataEntryValue | null;
  getAll(name: string): FormDataEntryValue[];
}

const str = (fd: FormLike, name: string): string => {
  const v = fd.get(name);
  return typeof v === "string" ? v : "";
};
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
const oneLine = (s: string) => s.replace(CONTROL, "").replace(/\s+/g, " ").trim();
const multiLine = (s: string) => s.replace(CONTROL, "").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();

function pickAll<T extends string>(fd: FormLike, name: string, allowed: readonly T[], max = allowed.length): T[] {
  const out: T[] = [];
  for (const v of fd.getAll(name)) {
    if (isOneOf(allowed, v) && !out.includes(v)) out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

const SCAN_CODE: Record<FindingKind, FieldErrorCode> = {
  email: "contactInfo", phone: "contactInfo", link: "contactInfo", messenger: "contactInfo",
  social_handle: "contactInfo", contact_invitation: "contactInfo", id_number: "idNumber", address: "address",
};

/** Letters from any script, marks, spaces and . ' ’ - · only: no digits, @ or links in a display name. */
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’·-]*$/u;

function checkText(value: string, field: string, max: number, errors: FieldErrors): void {
  if (!value) return;
  if ([...value].length > max) {
    errors[field] = "tooLong";
    return;
  }
  const hit = scanFreeText(value)[0];
  if (hit) errors[field] = SCAN_CODE[hit.kind];
}

export function normalizePhone(raw: string): string | null {
  const s = raw.normalize("NFKC").replace(/[\s().-]/g, "");
  if (!/^\+?\d{8,15}$/.test(s)) return null;
  return s;
}

const EMAIL_RE = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;
const LINE_RE = /^[a-z0-9._-]{3,30}$/i;
const WECHAT_RE = /^[a-z][a-z0-9_-]{5,19}$/i;

export function parseContacts(fd: FormLike, errors: FieldErrors): ContactsInput {
  const contacts: ContactsInput = {};
  const email = str(fd, "contact_email").normalize("NFKC").trim().toLowerCase();
  if (email) {
    if (email.length > 254 || !EMAIL_RE.test(email)) errors.contact_email = "invalidEmail";
    else contacts.email = email;
  }
  const line = str(fd, "contact_line").normalize("NFKC").trim().replace(/^@/, "");
  if (line) {
    if (!LINE_RE.test(line)) errors.contact_line = "invalidLine";
    else contacts.line = line;
  }
  const wechat = str(fd, "contact_wechat").normalize("NFKC").trim();
  if (wechat) {
    if (!WECHAT_RE.test(wechat)) errors.contact_wechat = "invalidWechat";
    else contacts.wechat = wechat;
  }
  for (const ch of ["whatsapp", "phone"] as const) {
    const raw = str(fd, `contact_${ch}`).trim();
    if (!raw) continue;
    const n = normalizePhone(raw);
    if (!n) errors[`contact_${ch}`] = "invalidPhone";
    else contacts[ch] = n;
  }
  return contacts;
}

/** https only, no embedded credentials, no local or numeric hosts. We store links, never documents. */
export function parseProofUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || !host.includes(".") || /^\d+(\.\d+){3}$/.test(host) || host.startsWith("[")) return null;
    if (u.href.length > LIMITS.credentialUrl) return null;
    return u.href;
  } catch {
    return null;
  }
}

export function parseProfileForm(fd: FormLike, now: Date = new Date()): { values: ProfileInput; errors: FieldErrors } {
  const errors: FieldErrors = {};

  const displayName = oneLine(str(fd, "displayName"));
  if (!displayName) errors.displayName = "required";
  else if ([...displayName].length > LIMITS.displayName) errors.displayName = "tooLong";
  else if (!NAME_RE.test(displayName)) errors.displayName = "nameChars";
  else {
    const hit = scanFreeText(displayName)[0];
    if (hit) errors.displayName = SCAN_CODE[hit.kind];
  }

  const headline = oneLine(str(fd, "headline"));
  checkText(headline, "headline", LIMITS.headline, errors);
  const bio = multiLine(str(fd, "bio"));
  checkText(bio, "bio", LIMITS.bio, errors);

  const cityRaw = str(fd, "city");
  const city = CITIES.some((c) => c.key === cityRaw) ? cityRaw : null;
  const validDistricts = new Set(DISTRICTS.filter((d) => d.city === city).map((d) => d.key));
  const districts = pickAll(fd, "districts", [...validDistricts]);

  const openTo = pickAll(fd, "openTo", OPEN_TO);
  const tutors = openTo.includes("private_tutoring");

  let rateMin: number | null = null;
  let rateMax: number | null = null;
  if (tutors) {
    for (const [field, set] of [["rateMin", (n: number) => (rateMin = n)], ["rateMax", (n: number) => (rateMax = n)]] as const) {
      const raw = str(fd, field).normalize("NFKC").replace(/[,\s]/g, "");
      if (!raw) continue;
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > LIMITS.maxRate) errors[field] = "rateRange";
      else set(n);
    }
    if (rateMin !== null && rateMax !== null && rateMin > rateMax) errors.rateMax = "rateOrder";
  }

  const credentials: Credential[] = [];
  for (let i = 0; i < LIMITS.credentials; i++) {
    const label = oneLine(str(fd, `credLabel_${i}`));
    const yearRaw = str(fd, `credYear_${i}`).normalize("NFKC").trim();
    const urlRaw = str(fd, `credUrl_${i}`).trim();
    if (!label && !yearRaw && !urlRaw) continue;
    const fieldLabel = `credLabel_${i}`;
    if (!label) errors[fieldLabel] = "required";
    else checkText(label, fieldLabel, LIMITS.credentialLabel, errors);
    const c: Credential = { label };
    if (yearRaw) {
      const y = Number(yearRaw);
      if (!/^\d{4}$/.test(yearRaw) || y < 1950 || y > now.getUTCFullYear() + 1) errors[`credYear_${i}`] = "invalidYear";
      else c.year = y;
    }
    if (urlRaw) {
      const u = parseProofUrl(urlRaw);
      if (!u) errors[`credUrl_${i}`] = "invalidUrl";
      else c.proofUrl = u;
    }
    credentials.push(c);
  }

  const wa = str(fd, "workAuthorization");
  const exp = str(fd, "experienceBand");

  const values: ProfileInput = {
    displayName,
    headline: headline || null,
    bio: bio || null,
    city,
    districts,
    subjects: pickAll(fd, "subjects", SUBJECTS, 12),
    levels: pickAll(fd, "levels", LEVELS),
    languages: pickAll(fd, "languages", LANGUAGES),
    teachingModes: pickAll(fd, "teachingModes", TEACHING_MODES),
    openTo,
    workAuthorization: isOneOf(WORK_AUTHORIZATION, wa) ? wa : null,
    experienceBand: isOneOf(EXPERIENCE_BANDS, exp) ? exp : null,
    rateMin,
    rateMax,
    credentials,
    contacts: parseContacts(fd, errors),
  };
  return { values, errors };
}
