export function FaqList({ items }: { items: ReadonlyArray<{ q: string; a: string }> }) {
  return (
    <div>
      {items.map((it, i) => (
        <details key={it.q} open={i === 0} className="border-b border-ink-100 py-3.5">
          <summary className="cursor-pointer text-[17px] font-bold">{it.q}</summary>
          <p className="mt-2 text-ink-600">{it.a}</p>
        </details>
      ))}
    </div>
  );
}
