import { TAICHUNG_LABELS, TAICHUNG_PATHS, TAICHUNG_VIEWBOX } from "@/components/home/taichung-paths";

const SELECTED = "taichung:xitun";

/** The land warms with the (made-up) count, as on the members' night map. */
function fillFor(n: number): string {
  if (n < 0) return "fill-night-850 stroke-brand-800";
  if (n === 0) return "fill-brand-800 stroke-brand-900";
  if (n < 2) return "fill-night-700 stroke-brand-900";
  if (n < 4) return "fill-night-600 stroke-brand-900";
  return "fill-night-500 stroke-brand-900";
}

/**
 * A calm, static picture of "zoom in to your district": Taichung's districts at night, with sample lights, one of
 * them chosen. Inline SVG on purpose (no map library on the home page). Made-up counts, no real educator, no
 * profile link.
 */
export function SampleDistricts({ aria, locale, className }: { aria: string; locale: string; className?: string }) {
  const zh = locale.startsWith("zh");
  return (
    <svg viewBox={TAICHUNG_VIEWBOX} role="img" aria-label={aria} className={className}>
      <rect width="100%" height="100%" className="fill-brand-900" />
      <g strokeLinejoin="round">
        {TAICHUNG_PATHS.filter(([key]) => key !== SELECTED).map(([key, d, n]) => (
          <path key={key} d={d} strokeWidth={n < 0 ? 1 : 1.6} className={fillFor(n)} />
        ))}
        {TAICHUNG_PATHS.filter(([key]) => key === SELECTED).map(([key, d]) => (
          <path key={key} d={d} strokeWidth="4" className="fill-accent-400 stroke-accent-300" />
        ))}
      </g>
      <g fontWeight="800" textAnchor="middle">
        {TAICHUNG_LABELS.map(([key, en, zhName, x, y, n]) => {
          const hot = key === SELECTED;
          const r = hot ? 25 : 15 + Math.min(n, 5);
          return (
            <g key={key}>
              <circle cx={x} cy={y} r={r + (hot ? 9 : 6)} className={hot ? "fill-brand-900/30" : "fill-night-100/15"} />
              <circle cx={x} cy={y} r={r} className={hot ? "fill-brand-900" : "fill-night-100"} />
              <text x={x} y={y + (hot ? 7 : 5.5)} fontSize={hot ? 21 : 16} className={hot ? "fill-accent-400" : "fill-brand-900"}>
                {n}
              </text>
              {hot || n >= 3 ? (
                <text x={x} y={y + r + 23} fontSize={hot ? 19 : 16} strokeWidth="5" strokeLinejoin="round" className="fill-night-100 stroke-brand-900 [paint-order:stroke]">
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
