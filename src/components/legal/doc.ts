import { LAWYER_PLACEHOLDER_SOURCE, type LegalDocKey } from "./constants";

/* ---------- the shape of messages/<locale>/legal.json -> docs.<doc> ---------- */

export interface LegalSection {
  /** Stable anchor, identical in every language. */
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export interface LegalDocMessages {
  intro: string;
  sections: LegalSection[];
}

/** The canonical compliance notice (messages/<locale>/notice.json). Never re-worded here. */
export interface NoticeText {
  lead: string;
  full: string;
  tutoringWork: string;
  /** The wording of the acknowledgement tick box; the waiver's fifth confirmation. */
  acknowledge: string;
}

/** The parts of `educator.waiver` (messages/<locale>/educator.json) that the public waiver page shows. */
export interface WaiverMessages {
  lead: string;
  cols: {
    profile: Record<string, string>;
    contact: Record<string, string>;
    never: Record<string, string>;
  };
  who: { schoolsTitle: string; schoolsBody: string; familiesTitle: string; familiesBody: string; between: string };
  confirm: { required: string; optional: string; termsPrivacy: string; publishToMembers: string; contactOnRequest: string; truthful: string; marketing: string };
  side: { controlBody: string; recordBody: string };
}

export interface ResolvedLegalDoc {
  intro: string;
  /** Shown prominently above the table of contents. */
  notice: Pick<NoticeText, "lead" | "full" | "tutoringWork"> & { showTutoringWork: boolean };
  sections: LegalSection[];
}

/* ---------- the waiver page shows the same words the educator ticks ---------- */

/** "<terms>Terms</terms>" and "<b>x</b>" are rich-text tags in the form; on the public page they are plain words. */
export const stripTags = (s: string): string => s.replace(/<\/?[a-z]+>/gi, "");

const listOf = (group: Record<string, string>): string[] =>
  Object.keys(group)
    .filter((k) => /^i\d+$/.test(k))
    .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
    .map((k) => group[k]!);

interface Embed {
  /** Paragraphs placed before the section's own paragraphs. */
  lead?: string[];
  /** Bullets placed before the section's own bullets. */
  bullets?: string[];
}

/**
 * Sections of the waiver page that quote existing `educator.waiver.*` strings. The consent snapshot
 * (src/lib/consent/waiver-text.ts) stores those very strings, so this page and what an educator ticks cannot drift.
 */
const WAIVER_EMBEDS: Record<string, (w: WaiverMessages, notice: NoticeText) => Embed> = {
  summary: (w) => ({ lead: [w.lead] }),
  "profile-fields": (w) => ({ bullets: listOf(w.cols.profile) }),
  "contact-details": (w) => ({ bullets: listOf(w.cols.contact) }),
  "never-collected": (w) => ({ bullets: listOf(w.cols.never) }),
  "who-sees": (w) => {
    const colon = /[\u3400-\u9fff]/.test(w.who.schoolsTitle) ? "：" : ": ";
    return { bullets: [`${w.who.schoolsTitle}${colon}${w.who.schoolsBody}`, `${w.who.familiesTitle}${colon}${w.who.familiesBody}`] };
  },
  arrangements: (w) => ({ lead: [w.who.between] }),
  confirmations: (w, n) => {
    const c = w.confirm;
    // Same order as the boxes and as the stored snapshot: terms and privacy, publish, contact, truthful, notice, marketing.
    const items: [string, string, boolean][] = [
      [c.termsPrivacy, c.required, true],
      [c.publishToMembers, c.required, true],
      [c.contactOnRequest, c.required, true],
      [c.truthful, c.required, true],
      [n.acknowledge, c.required, true],
      [c.marketing, c.optional, false],
    ];
    return { bullets: items.map(([text, tag]) => `${tag} · ${stripTags(text)}`) };
  },
  record: (w) => ({ lead: [w.side.recordBody] }),
  control: (w) => ({ lead: [w.side.controlBody] }),
};

/** Only the tutoring-related documents add the "private tutoring may not be allowed on some work permits" line. */
const SHOWS_TUTORING_WORK: readonly LegalDocKey[] = ["terms", "waiver"];

export function resolveLegalDoc(key: LegalDocKey, doc: LegalDocMessages, ctx: { notice: NoticeText; waiver?: WaiverMessages }): ResolvedLegalDoc {
  const { lead, full, tutoringWork } = ctx.notice;
  const sections = doc.sections.map((s): LegalSection => {
    const embed = key === "waiver" && ctx.waiver ? WAIVER_EMBEDS[s.id]?.(ctx.waiver, ctx.notice) : undefined;
    if (!embed) return s;
    const bullets = [...(embed.bullets ?? []), ...(s.bullets ?? [])];
    return {
      ...s,
      paragraphs: [...(embed.lead ?? []), ...s.paragraphs],
      ...(bullets.length > 0 ? { bullets } : {}),
    };
  });
  return { intro: doc.intro, notice: { lead, full, tutoringWork, showTutoringWork: SHOWS_TUTORING_WORK.includes(key) }, sections };
}

/* ---------- inline markup inside a paragraph ---------- */

export type Token =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "lawyer"; text: string };

/**
 * The only markup the legal copy uses: `**bold**`, `[text](/internal/path)` and the lawyer placeholders.
 * Everything else is plain text, so a stray character can never inject HTML.
 */
const TOKEN_RE = new RegExp(`(${LAWYER_PLACEHOLDER_SOURCE})|\\[([^\\]]+)\\]\\((\\/[^)\\s]*)\\)|\\*\\*([^*]+)\\*\\*`, "g");

export function tokenize(input: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of input.matchAll(TOKEN_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ type: "text", text: input.slice(last, at) });
    if (m[1] !== undefined) out.push({ type: "lawyer", text: m[1] });
    else if (m[2] !== undefined && m[3] !== undefined) out.push({ type: "link", text: m[2], href: m[3] });
    else if (m[4] !== undefined) out.push({ type: "bold", text: m[4] });
    last = at + m[0].length;
  }
  if (last < input.length) out.push({ type: "text", text: input.slice(last) });
  return out;
}

/** Every piece of text a document shows, in order (used by the tests and by anyone who wants a plain-text copy). */
export function plainText(d: ResolvedLegalDoc): string[] {
  return [
    d.intro,
    d.notice.lead,
    d.notice.full,
    ...(d.notice.showTutoringWork ? [d.notice.tutoringWork] : []),
    ...d.sections.flatMap((s) => [s.title, ...s.paragraphs, ...(s.bullets ?? [])]),
  ];
}
