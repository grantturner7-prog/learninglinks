import { CONTACT_CHANNELS, LIMITS, parseProfileForm, type ContactChannel, type ProfileInput } from "./profile-input";

/**
 * What the guided flow edits in the browser: every field as plain text or a list of keys, exactly what a person
 * types or taps. It is turned into the same form fields the server already validates (`parseProfileForm`), so
 * the flow and the server can never disagree about what a field means.
 */
export interface Draft {
  displayName: string;
  headline: string;
  bio: string;
  city: string;
  districts: string[];
  subjects: string[];
  levels: string[];
  languages: string[];
  teachingModes: string[];
  openTo: string[];
  workAuthorization: string;
  experienceBand: string;
  rateMin: string;
  rateMax: string;
  creds: { label: string; year: string; url: string }[];
  contacts: Record<ContactChannel, string>;
}

export function toDraft(v: ProfileInput): Draft {
  const creds = Array.from({ length: LIMITS.credentials }, (_, i) => {
    const c = v.credentials[i];
    return { label: c?.label ?? "", year: c?.year ? String(c.year) : "", url: c?.proofUrl ?? "" };
  });
  return {
    displayName: v.displayName, headline: v.headline ?? "", bio: v.bio ?? "", city: v.city ?? "",
    districts: [...v.districts], subjects: [...v.subjects], levels: [...v.levels], languages: [...v.languages],
    teachingModes: [...v.teachingModes], openTo: [...v.openTo], workAuthorization: v.workAuthorization ?? "",
    experienceBand: v.experienceBand ?? "", rateMin: v.rateMin?.toString() ?? "", rateMax: v.rateMax?.toString() ?? "", creds,
    contacts: { email: v.contacts.email ?? "", line: v.contacts.line ?? "", whatsapp: v.contacts.whatsapp ?? "", wechat: v.contacts.wechat ?? "", phone: v.contacts.phone ?? "" },
  };
}

export function buildFormData(d: Draft, locale: string, intent: "save" | "publish"): FormData {
  const fd = new FormData();
  fd.set("locale", locale);
  fd.set("intent", intent);
  fd.set("displayName", d.displayName);
  fd.set("headline", d.headline);
  fd.set("bio", d.bio);
  fd.set("city", d.city);
  for (const k of ["districts", "subjects", "levels", "languages", "teachingModes", "openTo"] as const) for (const v of d[k]) fd.append(k, v);
  fd.set("workAuthorization", d.workAuthorization);
  fd.set("experienceBand", d.experienceBand);
  fd.set("rateMin", d.rateMin);
  fd.set("rateMax", d.rateMax);
  d.creds.forEach((c, i) => {
    fd.set(`credLabel_${i}`, c.label);
    fd.set(`credYear_${i}`, c.year);
    fd.set(`credUrl_${i}`, c.url);
  });
  for (const ch of CONTACT_CHANNELS) fd.set(`contact_${ch}`, d.contacts[ch]);
  return fd;
}

/** The draft as the rules see it (lenient: validation errors are ignored here, the server reports them). */
export function draftToInput(d: Draft): ProfileInput {
  return parseProfileForm(buildFormData(d, "en-TW", "save")).values;
}

export function toggle(list: readonly string[], value: string, max = Infinity): string[] {
  if (list.includes(value)) return list.filter((x) => x !== value);
  return list.length >= max ? [...list] : [...list, value];
}
