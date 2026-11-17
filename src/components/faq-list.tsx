/** Questions as soft rounded cards. Native <details>, so it works without JavaScript and with a keyboard. */
export function FaqList({ items }: { items: ReadonlyArray<{ q: string; a: string }> }) {
  return (
    <div className="flex flex-col gap-3">
      {items.map((it, i) => (
        <details
          key={it.q}
          open={i === 0}
          className="group rounded-[26px] bg-paper px-5 shadow-card inset-ring-2 inset-ring-ink-100 open:inset-ring-ink-200 sm:px-6"
        >
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl py-3.5 text-[17px] font-bold leading-snug [&::-webkit-details-marker]:hidden">
            {it.q}
            <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-700 transition-transform group-open:rotate-180 motion-reduce:transition-none">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </span>
          </summary>
          <p className="pb-5 pr-10 leading-relaxed text-ink-700">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
