/**
 * Free-text safety scan for educator profiles.
 *
 * Two promises depend on it:
 *  1. Contact details live ONLY in the contact fields, which members see one at a time (logged, capped).
 *     So phone numbers, emails, links and messenger IDs must not leak through the headline, bio or labels.
 *  2. We never store ID, passport or ARC numbers, or home addresses.
 *
 * The scan is deliberately strict about contact details and ID numbers, and lenient about ordinary prose
 * (years, "grades 1-3", prices). It normalises full-width characters first, so "０９１２" cannot slip through.
 */

export type FindingKind =
  | "email"
  | "phone"
  | "link"
  | "messenger"
  | "social_handle"
  | "contact_invitation"
  | "id_number"
  | "address";

export interface Finding {
  kind: FindingKind;
  /** The offending text, trimmed, for showing back to the educator. */
  match: string;
}

const MESSENGERS =
  "line|wechat|weixin|wx|whatsapp|telegram|kakao(?:talk)?|zalo|instagram|facebook|messenger|skype|viber|signal|賴|微信|臉書|ig|fb";

const RE_EMAIL = /[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|＠)\s*[a-z0-9-]+(?:\s*(?:\.|\(dot\)|\[dot\]|\s+dot\s+)\s*[a-z0-9-]+)+/gi;
const RE_LINK = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]{2,}\.(?:com|net|org|tw|io|co|me|info|app|link|ly|gl|be|cc|xyz|shop|site)\b(?:\/\S*)?/gi;
const RE_MESSENGER = new RegExp(`(?:${MESSENGERS})\\s*(?:id|account|no\\.?|number|帳號|號碼)?\\s*[:：=＝]\\s*@?[\\w.-]{3,}`, "gi");
const RE_MESSENGER_ID_WORD = /\b(?:line|wechat|whatsapp|telegram|kakao|zalo)\s+id\b/gi;
const RE_HANDLE = /(?:^|[\s(])@[a-z0-9._]{3,}\b/gi;
const RE_INVITE = /\b(?:add|contact|message|text|call|dm|whatsapp|reach)\s+me\s+(?:on|at|via|through|by)\b|加我|加賴|私訊我|私我|密我|找我請/gi;
// Taiwan / international ID, ARC and passport-like numbers: 1-2 letters followed by 7-9 digits.
const RE_ID = /\b[a-z]{1,2}\d{7,9}\b/gi;
// Chinese-style address (…路/街/巷/弄 … 12號) and English street addresses.
const RE_ADDRESS_ZH = /[路街巷弄道][^\n，,。]{0,14}?\d+\s*(?:號|之\d+|樓)/g;
const RE_ADDRESS_EN = /\b\d{1,5}(?:-\d{1,4})?\s+(?:[a-z]+\s+){0,3}(?:rd|road|st|street|ave|avenue|lane|ln|sec|section|blvd|boulevard)\b\.?/gi;
const RE_ADDRESS_NO = /\bno\.?\s*\d+[,\s]+(?:lane|alley|sec|section|[a-z]+\s+(?:rd|road|st|street))/gi;

const isYear = (s: string) => /^(?:19|20|21)\d{2}$/.test(s);

/** Digit runs that look like a phone number: 8+ digits, allowing spaces, dashes, dots and brackets between. */
function findPhones(text: string): string[] {
  const out: string[] = [];
  const re = /\+?\(?\d[\d\s().-]{6,}\d/g;
  for (const m of text.matchAll(re)) {
    const raw = m[0];
    const groups = raw.split(/[^\d]+/).filter(Boolean);
    const digits = groups.join("");
    if (digits.length < 8) continue;
    // "2018-2021" or "2019 2023": a range of years is ordinary prose, not a phone number.
    if (groups.length > 0 && groups.every(isYear)) continue;
    out.push(raw.trim());
  }
  return out;
}

function collect(kind: FindingKind, re: RegExp, text: string, into: Finding[]): void {
  for (const m of text.matchAll(re)) into.push({ kind, match: m[0].trim() });
}

export function scanFreeText(input: string | null | undefined): Finding[] {
  if (!input) return [];
  const text = input.normalize("NFKC");
  const findings: Finding[] = [];
  // ID numbers first: they are the more serious finding, and their digits must not be reported as a phone.
  collect("id_number", RE_ID, text, findings);
  const withoutIds = text.replace(RE_ID, " ");
  collect("email", RE_EMAIL, text, findings);
  // Don't also report the host part of an email as a link.
  const withoutEmails = text.replace(RE_EMAIL, " ");
  collect("link", RE_LINK, withoutEmails, findings);
  collect("messenger", RE_MESSENGER, text, findings);
  collect("messenger", RE_MESSENGER_ID_WORD, text, findings);
  collect("social_handle", RE_HANDLE, withoutEmails, findings);
  collect("contact_invitation", RE_INVITE, text, findings);
  for (const p of findPhones(withoutIds)) findings.push({ kind: "phone", match: p });
  collect("address", RE_ADDRESS_ZH, text, findings);
  collect("address", RE_ADDRESS_EN, text, findings);
  collect("address", RE_ADDRESS_NO, text, findings);
  return findings;
}

export function hasForbiddenContent(input: string | null | undefined): boolean {
  return scanFreeText(input).length > 0;
}

/** The first finding's kind, used to choose a helpful error message. */
export function firstFindingKind(input: string | null | undefined): FindingKind | null {
  return scanFreeText(input)[0]?.kind ?? null;
}
