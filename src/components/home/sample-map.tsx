import { TAIWAN_PATHS, TAIWAN_VIEWBOX } from "@/components/home/taiwan-paths";

/** Counties drawn a shade darker (the big cities), and the one highlighted area. Purely cosmetic. */
const CITY = new Set(["taipei", "new-taipei", "taoyuan", "kaohsiung"]);
const HOT = "taichung";

type Bubble = { x: number; y: number; n: number; halo: number; core: number; hot?: boolean };

/** Made-up counts, one bubble per area. They are an illustration, not data about anyone. */
const BUBBLES: ReadonlyArray<Bubble> = [
  { x: 222, y: 56, n: 30, halo: 19, core: 13.8 },
  { x: 198, y: 33, n: 18, halo: 16.5, core: 11.8 },
  { x: 168, y: 66, n: 14, halo: 15.5, core: 11 },
  { x: 143, y: 88, n: 3, halo: 12, core: 7.8 },
  { x: 148, y: 122, n: 23, halo: 21, core: 12.7, hot: true },
  { x: 108, y: 152, n: 5, halo: 13, core: 8.6 },
  { x: 94, y: 228, n: 6, halo: 13, core: 8.9 },
  { x: 120, y: 252, n: 12, halo: 15, core: 10.5 },
  { x: 185, y: 169, n: 2, halo: 11.5, core: 7.3 },
  { x: 159, y: 254, n: 1, halo: 11, core: 6.6 },
];

export interface SampleMapLabels {
  aria: string;
  taipei: string;
  newTaipei: string;
  taichung: string;
  tainan: string;
  kaohsiung: string;
}

/**
 * A calm, static teaser of the member map: Taiwan with sample bubbles. It is inline SVG on purpose, so the
 * home page never loads the MapLibre bundle, and it carries no real educator, address or profile link.
 */
export function SampleMap({ labels, className, tone = "light" }: { labels: SampleMapLabels; className?: string; tone?: "light" | "dark" }) {
  if (tone === "dark") return <DarkSampleMap labels={labels} className={className} />;
  return (
    <svg viewBox={TAIWAN_VIEWBOX} role="img" aria-label={labels.aria} className={className}>
      <defs>
        <filter id="tw-soft" x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="0" dy="3.5" stdDeviation="3.5" floodColor="currentColor" floodOpacity=".22" className="text-brand-700" />
        </filter>
      </defs>
      <g filter="url(#tw-soft)">
        {TAIWAN_PATHS.map(([id, d]) => (
          <path
            key={id}
            d={d}
            strokeWidth="1.2"
            strokeLinejoin="round"
            className={`stroke-white ${id === HOT ? "fill-accent-300" : CITY.has(id) ? "fill-brand-200" : "fill-brand-100"}`}
          />
        ))}
      </g>
      <g>
        {BUBBLES.map((b) => (
          <g key={`${b.x}-${b.y}`}>
            <circle cx={b.x} cy={b.y} r={b.halo} className={b.hot ? "fill-accent-400/40" : "fill-brand-300/30"} />
            <circle cx={b.x} cy={b.y} r={b.core} className={`fill-white ${b.hot ? "stroke-accent-500" : "stroke-brand-300"}`} strokeWidth={b.hot ? 2 : 1.5} />
            <text x={b.x} y={b.y + 3.2} textAnchor="middle" fontSize="8.4" fontWeight="800" className="fill-ink-900">
              {b.n}
            </text>
          </g>
        ))}
      </g>
      <g fontSize="7.4" fontWeight="700" className="stroke-brand-50 [paint-order:stroke]" strokeWidth="2.6" strokeLinejoin="round">
        <text x="196" y="12" textAnchor="middle" className="fill-ink-900">{labels.taipei}</text>
        <text x="246" y="84" textAnchor="end" className="fill-ink-900">{labels.newTaipei}</text>
        <text x="150" y="150" textAnchor="middle" className="fill-accent-600">{labels.taichung}</text>
        <text x="82" y="230" textAnchor="end" className="fill-ink-900">{labels.tainan}</text>
        <text x="119" y="272" textAnchor="middle" className="fill-ink-900">{labels.kaohsiung}</text>
      </g>
    </svg>
  );
}

/** The same teaser on the night stage of the home page: charcoal land, cream lights, the highlighted area in amber. */
function DarkSampleMap({ labels, className }: { labels: SampleMapLabels; className?: string }) {
  return (
    <svg viewBox={TAIWAN_VIEWBOX} role="img" aria-label={labels.aria} className={className}>
      <g>
        {TAIWAN_PATHS.map(([id, d]) => (
          <path
            key={id}
            d={d}
            strokeWidth={id === HOT ? 1.4 : 0.8}
            strokeLinejoin="round"
            className={id === HOT ? "fill-accent-400 stroke-accent-300" : `stroke-brand-900 ${CITY.has(id) ? "fill-night-500" : "fill-night-700"}`}
          />
        ))}
      </g>
      <g>
        {BUBBLES.map((b) => (
          <g key={`${b.x}-${b.y}`}>
            <circle cx={b.x} cy={b.y} r={b.halo} className={b.hot ? "fill-accent-400/25" : "fill-night-100/15"} />
            <circle cx={b.x} cy={b.y} r={b.core} className={b.hot ? "fill-brand-900 stroke-accent-400" : "fill-night-100 stroke-brand-900"} strokeWidth={b.hot ? 2 : 0.6} />
            <text x={b.x} y={b.y + 3.2} textAnchor="middle" fontSize="8.4" fontWeight="800" className={b.hot ? "fill-accent-400" : "fill-brand-900"}>
              {b.n}
            </text>
          </g>
        ))}
      </g>
      <g fontSize="7.4" fontWeight="700" className="fill-night-100 stroke-brand-900 [paint-order:stroke]" strokeWidth="2.6" strokeLinejoin="round">
        <text x="196" y="12" textAnchor="middle">{labels.taipei}</text>
        <text x="246" y="84" textAnchor="end">{labels.newTaipei}</text>
        <text x="150" y="150" textAnchor="middle">{labels.taichung}</text>
        <text x="82" y="230" textAnchor="end">{labels.tainan}</text>
        <text x="119" y="272" textAnchor="middle">{labels.kaohsiung}</text>
      </g>
    </svg>
  );
}
