"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Icon } from "@/components/journey/icons";

export const AUTH_FIELD = "field !min-h-14 !rounded-2xl !text-[17px]";
export const MIN_PASSWORD = 10;

/**
 * A password box with a Show/Hide button (44px+ target) and, optionally, friendly guidance.
 * The label is either visible or screen-reader only (when a big question above already says what it is).
 */
export function PasswordField({
  id = "password",
  value,
  onChange,
  label,
  labelHidden = false,
  autoComplete,
  autoFocus = false,
  guide = false,
  invalid = false,
  describedBy,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  label: string;
  labelHidden?: boolean;
  autoComplete: "new-password" | "current-password";
  autoFocus?: boolean;
  guide?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const t = useTranslations("auth.ui");
  const [shown, setShown] = useState(false);
  const length = [...value].length;
  const ok = length >= MIN_PASSWORD;
  const guideId = `${id}-guide`;
  return (
    <div>
      <label htmlFor={id} className={labelHidden ? "sr-only" : "label"}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name="password"
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          required
          minLength={guide ? MIN_PASSWORD : undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={[guide ? guideId : null, describedBy].filter(Boolean).join(" ") || undefined}
          className={`${AUTH_FIELD} !pr-24`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? t("hidePassword") : t("showPassword")}
          className="absolute right-2 top-1/2 inline-flex min-h-11 min-w-[4.5rem] -translate-y-1/2 items-center justify-center rounded-full px-3 text-sm font-bold text-brand-700 hover:bg-brand-50"
        >
          {shown ? t("hide") : t("show")}
        </button>
      </div>
      {guide ? (
        <div id={guideId} className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-ink-100" aria-hidden>
            <div
              className={`h-full rounded-full transition-all motion-reduce:transition-none ${ok ? "bg-brand-700" : "bg-accent-400"}`}
              style={{ width: `${Math.min(100, (length / MIN_PASSWORD) * 100)}%` }}
            />
          </div>
          <p aria-live="polite" className={`mt-2 flex items-start gap-2 text-sm ${ok ? "font-bold text-brand-800" : "text-ink-600"}`}>
            {ok ? <Icon name="check" size={18} stroke={3} className="mt-0.5 flex-none text-brand-700" /> : null}
            {ok ? t("pwOk") : t("pwTip")}
          </p>
        </div>
      ) : null}
    </div>
  );
}
