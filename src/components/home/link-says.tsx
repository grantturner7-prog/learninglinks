import type { ReactNode } from "react";
import { LinkGuide } from "@/components/logo";

/**
 * Link, the guide, saying something in a speech bubble. Used at the top of every public and auth screen,
 * so the whole site speaks in one kind voice ("one small question at a time").
 */
export function LinkSays({
  children,
  size = 56,
  tone = "wash",
  className = "",
}: {
  children: ReactNode;
  size?: number;
  tone?: "wash" | "paper";
  className?: string;
}) {
  const bubble = tone === "paper" ? "bg-paper shadow-soft" : "bg-brand-50";
  const tail = tone === "paper" ? "bg-paper" : "bg-brand-50";
  return (
    <div className={`flex items-center gap-4 sm:gap-5 ${className}`}>
      <span className="flex-none">
        <LinkGuide size={size} />
      </span>
      <div className={`relative min-w-0 rounded-[26px] px-5 py-4 ${bubble}`}>
        <span aria-hidden className={`absolute -left-1.5 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 rounded-[4px] ${tail}`} />
        <div className="relative text-pretty text-base font-semibold leading-relaxed text-ink-900 sm:text-[17.5px]">{children}</div>
      </div>
    </div>
  );
}

/** A small rounded label that marks illustrative material (never real people or numbers). */
export function SampleTag({ children, tone = "light" }: { children: ReactNode; tone?: "light" | "night" }) {
  return (
    <span className={`inline-flex min-h-[26px] items-center whitespace-nowrap rounded-full px-3 text-xs font-bold tracking-wide ${tone === "night" ? "bg-night-700 text-accent-400" : "bg-brand-100 text-brand-700"}`}>
      {children}
    </span>
  );
}
