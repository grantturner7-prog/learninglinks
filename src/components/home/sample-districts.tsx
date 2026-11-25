import { TAICHUNG_LABELS, TAICHUNG_PATHS, TAICHUNG_VIEWBOX } from "@/components/home/taichung-paths";

const SELECTED = "taichung:xitun";

/** Lilac deepens with the (made-up) count, as on the members' map. */
function fillFor(n: number): string {
  if (n < 0) return "fill-brand-50 stroke-brand-100";
  if (n === 0) return "fill-paper stroke-brand-200";
  if (n < 2) return "fill-brand-100 stroke-brand-300";
  if (n < 4) return "fill-brand-200 stroke-brand-300";
  return "fill-brand-300 stroke-brand-400";
}

/**
 * A calm, static picture of "zoom in to your district": Taichung's districts with sample bubbles, one of them chosen.
 * Inline SVG on purpose (no map library on the home page). Made-up counts, no real educator, no profile link.
 */
export function SampleDistricts({ aria, locale, className }: { aria: string; locale: string; className?: string }) {
  const zh = locale.startsWith("zh");
  return (
    <svg viewBox={TAICHUNG_VIEWBOX} role="img" aria-label={aria} className={className}>
      <g strokeLinejoin="round">
        {TAICHUNG_PATHS.filter(([key]) => key !== SELECTED).map(([key, d, n]) => (
          <path key={key} d={d} strokeWidth={n < 0 ? 1 : 1.6} className={fillFor(n)} />
        ))}
        {TAICHUNG_PATHS.filter(([key]) => key === SELECTED).map(([key, d]) => (
          <path key={key} d={d} strokeWidth="4" className="fill-accent-300 stroke-accent-500" />
        ))}
      </g>
      <g fontWeight="800" textAnchor="middle">
        {TAICHUNG_LABELS.map(([key, en, zhName, x, y, n]) => {
          const hot = key === SELECTED;
          const r = hot ? 25 : 15 + Math.min(n, 5);
          return (
            <g key={key}>
              {hot ? <circle cx={x} cy={y} r={r + 9} className="fill-accent-400/40" /> : null}
              <circle cx={x} cy={y} r={r} strokeWidth="3" className={hot ? "fill-accent-400 stroke-white" : "fill-brand-900 stroke-white"} />
              <text x={x} y={y + (hot ? 7 : 5.5)} fontSize={hot ? 21 : 16} className={hot ? "fill-ink-900" : "fill-white"}>
                {n}
              </text>
              {hot || n >= 3 ? (
                <text x={x} y={y + r + 21} fontSize={hot ? 19 : 16} strokeWidth="5" strokeLinejoin="round" className="fill-ink-900 stroke-paper [paint-order:stroke]">
                  {zh ? zhName : en}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
