import { Icon } from "@/components/journey/icons";
import { LinkGuide } from "@/components/logo";

/**
 * A dotted path of steps with Link standing on the current one. Purely visual (aria-hidden): the readable
 * "Step 2 of 5" text next to it carries the meaning.
 */
export function StepTrack({ current, total }: { current: number; total: number }) {
  return (
    <ol aria-hidden className="relative flex items-center justify-between px-1">
      <span className="absolute left-3 right-3 top-1/2 -translate-y-1/2 border-t-[3px] border-dotted border-brand-300" />
      <span
        className="absolute left-3 top-1/2 -translate-y-1/2 border-t-4 border-ink-900 transition-all motion-reduce:transition-none"
        style={{ width: `calc((100% - 24px) * ${(current - 1) / (total - 1)})` }}
      />
      {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
        <li key={n} className="relative z-10 flex h-[50px] w-[50px] items-center justify-center">
          {n < current ? (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-white">
              <Icon name="check" size={14} stroke={3} />
            </span>
          ) : n === current ? (
            <span className="flex h-[50px] w-[50px] items-center justify-center rounded-full bg-paper shadow-soft ring-4 ring-accent-400">
              <LinkGuide size={42} />
            </span>
          ) : (
            <span className="h-6 w-6 rounded-full bg-paper ring-[3px] ring-brand-300" />
          )}
        </li>
      ))}
    </ol>
  );
}
