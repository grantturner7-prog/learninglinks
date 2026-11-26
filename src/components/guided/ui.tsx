"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/journey/icons";

/** Shared look of the guided (one question at a time) flows. Tokens only; colours come from globals.css. */
export const PILL = "inline-flex min-h-11 items-center gap-2 rounded-full bg-paper px-5 text-[15px] font-bold text-ink-900 shadow-[inset_0_0_0_2px_var(--color-ink-300)] transition";
export const PILL_HOVER = "hover:bg-white";
export const PILL_ON = "!bg-accent-300 shadow-[inset_0_0_0_3px_var(--color-ink-900)]";
export const TILE = "relative flex min-h-[132px] w-full flex-col items-center justify-center gap-1.5 rounded-[30px] bg-paper px-3 pb-3.5 pt-4 text-center shadow-[inset_0_0_0_2px_var(--color-ink-300)] transition";
export const TILE_ON = "!bg-accent-300 shadow-[inset_0_0_0_3px_var(--color-ink-900)]";
export const CARD = "rounded-[30px] bg-paper p-5 shadow-[inset_0_0_0_2px_var(--color-ink-300)]";

export function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} className={`${PILL} ${on ? PILL_ON : PILL_HOVER}`}>
      {on ? <Icon name="check" size={16} stroke={3} /> : null}
      {children}
    </button>
  );
}

/** A big selectable tile. `multi` shows a tick when on. */
export function Tile({ on, onClick, children, disabled }: { on: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} disabled={disabled} onClick={onClick} className={`${TILE} ${on ? TILE_ON : PILL_HOVER} ${disabled ? "opacity-60" : ""}`}>
      {on ? <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-white"><Icon name="check" size={16} stroke={3} /></span> : null}
      {children}
    </button>
  );
}
