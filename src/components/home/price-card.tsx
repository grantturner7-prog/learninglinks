import { DoorArt, type DoorKind } from "@/components/home/door-art";
import { Icon } from "@/components/journey/icons";
import { Link } from "@/i18n/navigation";

/**
 * The membership price, shown as one big friendly card (the same tint and picture as the matching door on the
 * home page). Prices and facts come from the page's messages; this component only lays them out.
 */
export function PriceCard({
  kind,
  tint,
  label,
  amount,
  per,
  note,
  bullets,
  href,
  cta,
  ctaNote,
}: {
  kind: DoorKind;
  tint: string;
  label: string;
  amount: string;
  per?: string;
  note: string;
  bullets: string[];
  href: string;
  cta: string;
  ctaNote: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-[40px] p-6 shadow-soft sm:rounded-[48px] sm:p-9 ${tint}`}>
      <div className="flex items-start justify-between gap-4">
        <span className="inline-flex min-h-8 items-center rounded-full bg-paper/85 px-4 text-sm font-extrabold tracking-wide text-brand-800">{label}</span>
        <DoorArt kind={kind} className="-mt-3 h-24 w-auto flex-none sm:h-28" />
      </div>
      <p className="mt-2 flex flex-wrap items-baseline gap-x-3 text-5xl font-extrabold tracking-tight sm:text-6xl">
        {amount}
        {per ? <span className="text-lg font-semibold tracking-normal text-ink-700">{per}</span> : null}
      </p>
      <p className="mt-1.5 text-[15px] font-semibold text-ink-700">{note}</p>
      <ul className="mt-6 flex flex-col gap-3 rounded-[28px] bg-paper/85 p-5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-3 text-[15.5px] leading-snug">
            <span className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-brand-900 text-white">
              <Icon name="check" size={14} stroke={3} />
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link href={href} className="btn btn-primary btn-lg mt-6 w-full">
        {cta}
        <Icon name="arrowR" size={18} />
      </Link>
      <p className="mt-3 text-center text-[13.5px] text-ink-700">{ctaNote}</p>
    </div>
  );
}
