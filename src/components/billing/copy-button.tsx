"use client";

import { useState } from "react";

/** Copies a short text (the bank reference). Falls back to selecting nothing: the code is also shown in plain text. */
export function CopyButton({ text, label, doneLabel }: { text: string; label: string; doneLabel: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          /* clipboard unavailable: the code is visible, the member can copy it by hand */
        }
      }}
    >
      <span aria-live="polite">{done ? doneLabel : label}</span>
    </button>
  );
}
