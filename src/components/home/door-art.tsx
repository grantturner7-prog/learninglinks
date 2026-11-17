/**
 * The three door illustrations (teach, school, family). Brand colours come from the theme tokens through
 * Tailwind classes; the few skin and hair tones are the illustration's own palette, not brand colours.
 */
const SKIN = "#F6CDAE";
const SKIN_DARK = "#E4B48C";
const SKIN_NECK = "#F1C09A";
const HAIR_BROWN = "#8F4A2E";
const WOOD = "#8B5A3C";

const OUT = "stroke-ink-900";

function Shadow({ rx }: { rx: number }) {
  return <ellipse cx="120" cy="176" rx={rx} ry="8" className="fill-ink-900" opacity=".07" />;
}

function Sparkle({ d, className }: { d: string; className: string }) {
  return <path d={d} className={className} />;
}

function Teach() {
  return (
    <>
      <Shadow rx={88} />
      <Sparkle d="M38 62l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" className="fill-accent-400" />
      <Sparkle d="M206 112l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" className="fill-white" />
      <path d="M70 152c2-24 22-35 50-35s48 11 50 35z" className={`fill-brand-300 ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M110 104h20v15c-6 6-14 6-20 0z" fill={SKIN_NECK} className={OUT} strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="120" cy="82" r="26" fill={SKIN} className={OUT} strokeWidth="2.6" />
      <path d="M94 80c-2-22 14-34 28-33 15 1 26 13 24 33-6-9-14-14-26-14-9 0-20 5-26 14z" className="fill-ink-900" />
      <circle cx="110" cy="86" r="2.4" className="fill-ink-900" />
      <circle cx="130" cy="86" r="2.4" className="fill-ink-900" />
      <path d="M112 95q8 8 16 0" fill="none" className={OUT} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M52 170q34-17 68 0v-34q-34-17-68 0z" className={`fill-white ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M120 170q34-17 68 0v-34q-34-17-68 0z" className={`fill-white ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M62 146q22-9 48 0M62 156q22-9 48 0M130 146q22-9 48 0M130 156q22-9 48 0" fill="none" className="stroke-brand-300" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="50" cy="152" r="6" fill={SKIN} className={OUT} strokeWidth="2.6" />
      <circle cx="190" cy="152" r="6" fill={SKIN} className={OUT} strokeWidth="2.6" />
      <path d="M150 30h42a10 10 0 0110 10v18a10 10 0 01-10 10h-22l-12 10v-10h-8a10 10 0 01-10-10V40a10 10 0 0110-10z" className={`fill-white ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <text x="154" y="58" fontWeight="800" fontSize="20" className="fill-brand-700" fontFamily="inherit">Aa</text>
      <path d="M52 76V46l20-6v30" fill="none" className={OUT} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="45" cy="78" r="7" className={`fill-accent-400 ${OUT}`} strokeWidth="2.6" />
      <circle cx="65" cy="72" r="7" className={`fill-accent-400 ${OUT}`} strokeWidth="2.6" />
    </>
  );
}

function School() {
  return (
    <>
      <Shadow rx={92} />
      <rect x="26" y="146" width="7" height="24" fill={WOOD} />
      <circle cx="30" cy="130" r="19" className={`fill-brand-300 ${OUT}`} strokeWidth="2.6" />
      <rect x="52" y="86" width="136" height="84" rx="4" className={`fill-white ${OUT}`} strokeWidth="2.6" />
      <path d="M42 90l78-44 78 44z" className={`fill-accent-400 ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="120" cy="72" r="10" className={`fill-white ${OUT}`} strokeWidth="2.6" />
      <path d="M120 66v6l4 3" fill="none" className={OUT} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M120 46V20" className={OUT} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M120 20l24 7-24 7z" className={`fill-rose-300 ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <rect x="66" y="104" width="24" height="28" rx="5" className={`fill-brand-100 ${OUT}`} strokeWidth="2.6" />
      <rect x="150" y="104" width="24" height="28" rx="5" className={`fill-brand-100 ${OUT}`} strokeWidth="2.6" />
      <path d="M104 170v-28a16 16 0 0132 0v28z" className={`fill-brand-700 ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="130" cy="156" r="2.2" className="fill-accent-400" />
      <rect x="94" y="170" width="52" height="6" rx="3" className={`fill-white ${OUT}`} strokeWidth="2.2" />
      <path d="M206 36a12 12 0 0112 12c0 10-12 22-12 22S194 58 194 48a12 12 0 0112-12z" className={`fill-rose-300 ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="206" cy="48" r="4.5" className={`fill-white ${OUT}`} strokeWidth="2.2" />
      <Sparkle d="M40 54l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" className="fill-white" />
    </>
  );
}

function Family() {
  return (
    <>
      <Shadow rx={90} />
      <rect x="148" y="104" width="68" height="66" rx="4" className={`fill-white ${OUT}`} strokeWidth="2.6" />
      <path d="M140 108l42-38 42 38z" className={`fill-rose-300 ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <rect x="172" y="136" width="20" height="34" rx="3" className={`fill-accent-400 ${OUT}`} strokeWidth="2.6" />
      <circle cx="160" cy="124" r="6" className={`fill-brand-100 ${OUT}`} strokeWidth="2.2" />
      <circle cx="204" cy="124" r="6" className={`fill-brand-100 ${OUT}`} strokeWidth="2.2" />
      <path d="M58 170v-62a22 22 0 0144 0v62z" className={`fill-brand-700 ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="80" cy="74" r="17" fill={SKIN_DARK} className={OUT} strokeWidth="2.6" />
      <path d="M62 72c-2-15 8-24 19-23 11 1 18 9 17 23-4-6-10-9-18-9s-13 3-18 9z" className="fill-ink-900" />
      <circle cx="74" cy="77" r="2" className="fill-ink-900" />
      <circle cx="87" cy="77" r="2" className="fill-ink-900" />
      <path d="M75 84q5.5 5 11 0" fill="none" className={OUT} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M106 170v-32a12 12 0 0124 0v32z" className={`fill-accent-400 ${OUT}`} strokeWidth="2.6" strokeLinejoin="round" />
      <circle cx="118" cy="120" r="12" fill={SKIN} className={OUT} strokeWidth="2.6" />
      <path d="M106 118c0-9 6-14 13-13 7 1 10 6 10 13-3-4-7-6-11-6s-8 2-12 6z" fill={HAIR_BROWN} />
      <circle cx="114" cy="123" r="1.7" className="fill-ink-900" />
      <circle cx="123" cy="123" r="1.7" className="fill-ink-900" />
      <path d="M114.5 128q3.5 3 7 0" fill="none" className={OUT} strokeWidth="2" strokeLinecap="round" />
      <path d="M101 128q6 2 8 12" fill="none" className={OUT} strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="109.5" cy="142" r="4.5" fill={SKIN_DARK} className={OUT} strokeWidth="2.2" />
      <path d="M118 78c0-6 4-8 8-5 4-3 8-1 8 5 0 7-8 12-8 12s-8-5-8-12z" className={`fill-white ${OUT}`} strokeWidth="2.4" strokeLinejoin="round" transform="translate(-6 -22)" />
      <Sparkle d="M40 44l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" className="fill-white" />
      <Sparkle d="M200 52l2.5 6 6 2.5-6 2.5-2.5 6-2.5-6-6-2.5 6-2.5z" className="fill-accent-400" />
    </>
  );
}

export type DoorKind = "teach" | "school" | "family";

/** A friendly line illustration for one door. Decorative: the text next to it carries the meaning. */
export function DoorArt({ kind, className }: { kind: DoorKind; className?: string }) {
  return (
    <svg viewBox="0 0 240 190" aria-hidden="true" focusable="false" className={className}>
      {kind === "teach" ? <Teach /> : kind === "school" ? <School /> : <Family />}
    </svg>
  );
}
