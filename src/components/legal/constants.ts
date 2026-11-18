/** Date (ISO, UTC) and number of the current draft of the three legal documents. Bump both when the wording changes. */
export const LEGAL_DRAFT_DATE = "2026-11-18";
export const LEGAL_DRAFT_VERSION = 1;

/** URL slug -> key under `legal.docs` in messages/<locale>/legal.json. */
export const LEGAL_DOCS = { terms: "terms", privacy: "privacy", "educator-waiver": "waiver" } as const;
export type LegalDocSlug = keyof typeof LEGAL_DOCS;
export type LegalDocKey = (typeof LEGAL_DOCS)[LegalDocSlug];

export const isLegalDocSlug = (v: string): v is LegalDocSlug => Object.hasOwn(LEGAL_DOCS, v);

/**
 * A point the owner has not decided, or a fact only a lawyer can settle, is written in the text as
 * "[For lawyer: ...]" (English) or "[請律師確認：...]" (Chinese). The page highlights these so they are easy to find,
 * and tests/legal.test.ts counts them. A placeholder may not contain a closing square bracket.
 */
export const LAWYER_PLACEHOLDER_SOURCE = String.raw`\[(?:For lawyer:|請律師確認：)[^\]]*\]`;
