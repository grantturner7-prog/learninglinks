import type { ReactNode } from "react";
import { ShieldAlert } from "@/components/icons";
import type { ResolvedLegalDoc } from "./doc";
import { RichText } from "./rich-text";

export interface LegalDocumentLabels {
  title: string;
  /** "Draft 1" */
  version: string;
  lastUpdatedLabel: string;
  /** "18 November 2026" */
  lastUpdated: string;
  /** "2026-11-18" */
  lastUpdatedIso: string;
  contents: string;
  noticeTitle: string;
  /** Explains the highlighted "[For lawyer: ...]" points. Only passed while the text is a draft. */
  legend?: string;
  backToTop: string;
}

/** The "Contact and reports" block: the support address when it is configured, otherwise a plain sentence. */
export interface LegalContact {
  email?: string;
  emailText: string;
  pendingText: string;
}

/**
 * A readable long document: title, version and date, the compliance notice (prominent, wording straight from
 * notice.json), a table of contents with anchor links and numbered sections. Only design tokens are used.
 */
export function LegalDocument({ doc, labels, contact, related }: { doc: ResolvedLegalDoc; labels: LegalDocumentLabels; contact: LegalContact; related?: ReactNode }) {
  return (
    <article id="top">
      <header>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
          <span className="badge-warn">{labels.version}</span>
          <span>
            {labels.lastUpdatedLabel}: <time dateTime={labels.lastUpdatedIso}>{labels.lastUpdated}</time>
          </span>
        </p>
        <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">{labels.title}</h1>
        <p className="mt-4 text-lg text-ink-700"><RichText text={doc.intro} /></p>
        {labels.legend ? <p className="notice mt-4">{labels.legend}</p> : null}
      </header>

      <aside role="note" aria-label={labels.noticeTitle} className="compliance mt-6">
        <ShieldAlert size={22} className="mt-0.5 flex-none" />
        <div>
          <p><b>{doc.notice.lead}</b> {doc.notice.full}</p>
          {doc.notice.showTutoringWork ? <p className="mt-2">{doc.notice.tutoringWork}</p> : null}
        </div>
      </aside>

      <nav aria-label={labels.contents} className="card mt-8 !p-0">
        <details open className="group">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-[28px] px-6 py-3 text-base font-bold text-ink-900">
            {labels.contents}
            <span aria-hidden className="text-brand-700 transition-transform group-open:rotate-180">▾</span>
          </summary>
          <ol className="grid list-decimal gap-x-8 gap-y-1 px-6 pb-5 pl-11 text-[15px] marker:font-semibold marker:text-ink-500 sm:grid-cols-2">
            {doc.sections.map((s) => (
              <li key={s.id} className="pl-1">
                <a href={`#${s.id}`} className="inline-block py-1 font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-900">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </details>
      </nav>

      <div className="mt-10 flex flex-col gap-10">
        {doc.sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-6">
            <h2 id={`${s.id}-h`} className="flex items-baseline gap-3 text-xl font-extrabold sm:text-2xl">
              <span aria-hidden className="min-w-7 text-brand-700">{i + 1}.</span>
              <span>{s.title}</span>
            </h2>
            <div className="mt-3 flex flex-col gap-3 text-[16px] leading-relaxed [overflow-wrap:anywhere] sm:pl-10">
              {s.paragraphs.map((p, n) => (
                <p key={n}><RichText text={p} /></p>
              ))}
              {s.bullets && s.bullets.length > 0 ? (
                <ul className="list-disc space-y-2 pl-6 marker:text-brand-500">
                  {s.bullets.map((b, n) => (
                    <li key={n}><RichText text={b} /></li>
                  ))}
                </ul>
              ) : null}
              {s.id === "contact" ? (
                <p className="card !p-4 font-semibold">
                  {contact.email ? (
                    <>
                      {contact.emailText}{" "}
                      <a href={`mailto:${contact.email}`} className="link">{contact.email}</a>
                    </>
                  ) : (
                    contact.pendingText
                  )}
                </p>
              ) : null}
            </div>
          </section>
        ))}
      </div>

      <footer className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-ink-100 pt-6 text-sm text-ink-600">
        <div className="flex flex-wrap gap-x-5 gap-y-1">{related}</div>
        <a href="#top" className="link">{labels.backToTop}</a>
      </footer>
    </article>
  );
}
