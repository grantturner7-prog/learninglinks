"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/journey/icons";
import { profileStrength } from "@/lib/educators/completeness";
import { draftToInput, type Draft } from "@/lib/educators/journey-draft";
import { areaLabel } from "@/lib/geo-labels";
import { isOneOf, SUBJECTS } from "@/lib/taxonomy";
import { openToForAudience, type Audience } from "@/lib/visibility";

const initials = (n: string) => [...n.trim()].slice(0, 2).join("").toUpperCase() || "·";
const ghost = "inline-flex min-h-7 items-center rounded-full border-2 border-dashed border-ink-300 px-3 text-[12.5px] font-semibold text-brand-700";

/** "Your card builds as you answer": the card members will see, rebuilt on every change. */
export function JourneyPreview({ d, step, view, onView, photoUrl, locale }: {
  d: Draft;
  step: number;
  view: Audience;
  onView: (v: Audience) => void;
  photoUrl: string | null;
  locale: string;
}) {
  const t = useTranslations("journey.preview");
  const tf = useTranslations("journey.fields");
  const tp = useTranslations("educator.profile");
  const tt = useTranslations("taxonomy");
  const input = draftToInput(d);
  const strength = profileStrength(input, !!photoUrl);
  const visibleTo = (a: Audience) => openToForAudience(input.openTo, a).length > 0;
  const visible = visibleTo(view);
  const filled = Math.round(strength.percent / 20);
  const rate = input.rateMin !== null || input.rateMax !== null ? [input.rateMin, input.rateMax].filter((n): n is number => n !== null).map((n) => n.toLocaleString(locale)).join("–") : null;
  const modeLine = input.teachingModes.map((m) => tt(`modes.${m as "online"}`)).join(" · ");
  const langLine = input.languages.map((l) => tt(`languages.${l as "en"}`)).join(" · ");
  const area = areaLabel(input.city, input.districts, locale);

  return (
    <div className="flex flex-col gap-4" aria-label={t("title")}>
      <div className="flex flex-col gap-1">
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight"><Icon name="sparkle" size={20} className="text-accent-500" />{t("title")}</h2>
      </div>
      <div role="group" aria-label={`${t("families")} / ${t("schools")}`} className="flex rounded-full bg-ink-100 p-1.5">
        {(["family", "school"] as const).map((a) => (
          <button key={a} type="button" aria-pressed={view === a} onClick={() => onView(a)}
            className={`min-h-11 flex-1 rounded-full text-sm font-bold ${view === a ? "bg-paper text-ink-900 shadow-card" : "text-ink-600"}`}>
            {a === "family" ? t("families") : t("schools")}
          </button>
        ))}
      </div>

      <div className={`relative rounded-[36px] bg-paper p-6 shadow-soft ${visible ? "" : "opacity-75"}`}>
        <span className="absolute right-5 top-4 rounded-full bg-brand-100 px-3 py-1 text-xs font-bold text-brand-700">{t("tag")}</span>
        <div className="flex items-center gap-4 pt-3">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, gated, already-resized photo
            <img src={photoUrl} alt="" width={88} height={88} className="h-[88px] w-[88px] rounded-full object-cover shadow-[0_0_0_3px_#fff,0_8px_18px_-8px_rgb(31_26_28/0.35)]" />
          ) : (
            <span aria-hidden className="inline-flex h-[88px] w-[88px] flex-none items-center justify-center rounded-full bg-brand-100 text-2xl font-extrabold text-brand-700 shadow-[0_0_0_3px_#fff,0_8px_18px_-8px_rgb(31_26_28/0.35)]">{initials(d.displayName)}</span>
          )}
          <div className="min-w-0">
            <p className="truncate text-2xl font-extrabold tracking-tight">{d.displayName.trim() || t("yourName")}</p>
            {d.headline.trim() ? <p className="mt-0.5 text-sm font-semibold">{d.headline}</p> : null}
          </div>
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">{t("teaches")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {input.subjects.length === 0 ? <span className={ghost}>{tp("fields.subjects")}</span> : null}
            {input.subjects.map((s) => (
              <span key={s} className={`inline-flex min-h-8 items-center rounded-full px-3.5 text-sm font-bold ${step === 4 ? "bg-accent-300 text-ink-900 shadow-[inset_0_0_0_2px_var(--color-ink-900)]" : "bg-brand-100 text-brand-700"}`}>
                {isOneOf(SUBJECTS, s) ? tt(`subjects.${s}`) : s}
              </span>
            ))}
          </div>
          {langLine || modeLine ? (
            <div className="mt-3 flex flex-col gap-1.5 text-sm font-semibold text-ink-600">
              {langLine ? <p className="flex items-center gap-2"><Icon name="globe" size={16} className="text-brand-700" />{langLine}</p> : null}
              {modeLine ? <p className="flex items-center gap-2"><Icon name="laptop" size={16} className="text-brand-700" />{modeLine}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-wider text-ink-500">{t("where")}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Icon name="pin" size={16} className="text-brand-700" />
            {area || <span className={ghost}>{tp("fields.city")}</span>}
            {input.city && input.districts.length === 0 ? <span className={ghost}>{t("districtsNext")}</span> : null}
          </p>
        </div>

        <div className="mt-5">
          {view === "family" ? (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">{t("rate")}</p>
              <p className="mt-1.5 text-sm font-semibold">
                {rate && input.openTo.includes("private_tutoring") ? <>NT${rate} <span className="font-medium text-ink-600">{tf("perHour")}</span></> : <span className={ghost}>{t("rateComing")} · {t("rateLater")}</span>}
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-bold uppercase tracking-wider text-ink-500">{t("openTo")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {openToForAudience(input.openTo, "school").map((o) => <span key={o} className="inline-flex min-h-8 items-center rounded-full bg-brand-100 px-3.5 text-sm font-bold text-brand-700">{tt(`openTo.${o}`)}</span>)}
                {openToForAudience(input.openTo, "school").length === 0 ? <span className={ghost}>{tp("fields.schoolWork")}</span> : null}
              </div>
            </>
          )}
        </div>
        {!visible ? <p className="mt-4 rounded-2xl bg-warn-50 px-3.5 py-2.5 text-sm text-warn-700">{t("invisible")}</p> : null}
        <div className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-full bg-brand-100 text-[15px] font-bold text-brand-700">
          <Icon name="lock" size={16} />{t("askConnect")}
        </div>
      </div>

      <p className="flex gap-2.5 px-1.5 text-[13.5px] leading-relaxed text-ink-600">
        <Icon name="eyeOff" size={18} className="mt-0.5 flex-none text-brand-700" />
        {view === "family" ? t("rateNote") : t("schoolsNotTutor")}
      </p>

      <div className="rounded-[28px] bg-paper p-5 shadow-card ring-1 ring-ink-100">
        <div className="flex items-baseline justify-between"><b className="text-[15.5px] font-extrabold">{t("strength")}</b><span className="text-[13.5px] font-extrabold text-accent-600">{strength.percent}% · {strength.percent >= 80 ? t("great") : t("gettingThere")}</span></div>
        <div role="progressbar" aria-valuenow={strength.percent} aria-valuemin={0} aria-valuemax={100} aria-label={t("strength")} className="mt-3 flex gap-1.5">
          {[0, 1, 2, 3, 4].map((i) => <i key={i} className={`h-3 flex-1 rounded-full ${i < filled ? "bg-accent-500" : "bg-ink-100"}`} />)}
        </div>
        {strength.missing[0] ? <p className="mt-3 text-[13.5px] leading-relaxed text-ink-600">{tp(`strength.tips.${strength.missing[0]}`)}</p> : null}
      </div>

      <div className="flex gap-4 rounded-[28px] bg-brand-50 p-5 ring-1 ring-brand-200">
        <Icon name="lock" size={22} className="mt-0.5 flex-none text-brand-700" />
        <div>
          <p className="text-[15.5px] font-extrabold">{t("safeTitle")}</p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-600">{t("safeBody")}</p>
        </div>
      </div>
    </div>
  );
}
