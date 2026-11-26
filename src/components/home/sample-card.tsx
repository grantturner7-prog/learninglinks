import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/journey/icons";
import { SampleTag } from "@/components/home/link-says";

// The samples' own illustration palette (skin and hair), not brand colours.
const LOOKS = {
  1: { skin: "#F6CDAE", neck: "#E7AE88", hair: "#8F4A2E", back: "fill-accent-300", top: "fill-brand-300" },
  2: { skin: "#E9B991", neck: "#D49C74", hair: "#2A211D", back: "fill-ink-100", top: "fill-ink-700" },
  3: { skin: "#F3CDB0", neck: "#E2AC8A", hair: "#1F1A17", back: "fill-brand-100", top: "fill-accent-400" },
} as const;

/** An illustrated face for a made-up sample educator. It is a drawing, never a photo of a real person. */
export function SampleAvatar({ size = 72, look = 1, ring = "ring-[3px] ring-white shadow-card" }: { size?: number; look?: 1 | 2 | 3; ring?: string }) {
  const { skin: SKIN, neck: SKIN_NECK, hair: HAIR, back, top } = LOOKS[look];
  return (
    <span className={`inline-block flex-none overflow-hidden rounded-full ${ring}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true" focusable="false" className="block">
        <rect width="96" height="96" className={back} />
        {look === 1 ? <path d="M26 52C21 25 36 11 49 11c13 0 28 14 22 41 2 11 4 21 0 29H27c-4-8-2-18-1-29z" fill={HAIR} /> : null}
        {look === 3 ? <circle cx="48" cy="15" r="9.5" fill={HAIR} /> : null}
        <path d="M8 96c2-22 20-28 40-28s38 6 40 28z" className={top} />
        <path d="M41 56h14v14c-3 4-11 4-14 0z" fill={SKIN_NECK} />
        <ellipse cx="48" cy="44" rx="17" ry="19" fill={SKIN} />
        {look === 2 ? <path d="M29.5 44C27 26 39 17 50 18c11 1 19 10 16.500 26-2-8-7-13-14-14-9-1-17 4-23 14z" fill={HAIR} /> : <path d="M30 43C29 25 41 19 50 20c10 1 17 9 16 23-5-7-12-11-20-11-6 0-12 4-16 11z" fill={HAIR} />}
        <circle cx="41.5" cy="46.5" r="1.8" className="fill-ink-900" />
        <circle cx="54.5" cy="46.5" r="1.8" className="fill-ink-900" />
        <path d="M43 53q5 4.6 10 0" fill="none" className="stroke-ink-900" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="37" cy="51.5" r="3" className="fill-rose-300" opacity=".6" />
        <circle cx="59" cy="51.5" r="3" className="fill-rose-300" opacity=".6" />
      </svg>
    </span>
  );
}

/**
 * The one SAMPLE educator card used on the marketing pages. It is made up and says so. It also shows the
 * "each audience sees only its own side" rule: families see tutoring and the hourly rate, schools see
 * full-time or part-time openness and never a rate.
 */
export async function SampleCard({ view, compact = false }: { view: "family" | "school"; compact?: boolean }) {
  const t = await getTranslations("home");
  // The small version floats beside the map on the home page's hero: one glance, nothing to wrap.
  if (compact) {
    return (
      <div className="rounded-[22px] border border-ink-100 bg-paper p-4 shadow-soft" aria-label={t("sample.tag", { view: t(`sample.view.${view}`) })}>
        <SampleTag>{t("sample.tag", { view: t(`sample.view.${view}`) })}</SampleTag>
        <div className="mt-3 flex items-center gap-3.5">
          <SampleAvatar size={60} />
          <div className="min-w-0">
            <p className="text-lg font-extrabold leading-tight tracking-tight">{t("sample.name")}</p>
            <p className="mt-0.5 text-[13.5px] leading-snug text-ink-600">{t("sample.line")}</p>
          </div>
        </div>
        <p className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-ink-100 pt-3 text-[13.5px] font-semibold text-ink-600">
          <span className="inline-flex items-center gap-1.5"><Icon name="pin" size={16} className="text-brand-700" />{t("sample.areas")}</span>
          {view === "family" ? (
            <span><b className="text-[15px] font-extrabold text-ink-900">{t("sample.rate")}</b> {t("sample.ratePer")}</span>
          ) : (
            <span>{t("sample.openSchool")}</span>
          )}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-[24px] border border-ink-200 bg-paper p-4 pb-5 shadow-card sm:p-5" aria-label={t("sample.tag", { view: t(`sample.view.${view}`) })}>
      <div className="mb-3">
        <SampleTag>{t("sample.tag", { view: t(`sample.view.${view}`) })}</SampleTag>
      </div>
      <div className="flex items-center gap-4">
        <SampleAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-extrabold leading-snug tracking-tight">{t("sample.name")}</p>
          <p className="text-[14.5px] leading-snug text-ink-600">{t("sample.line")}</p>
          <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[13.5px] font-semibold text-ink-600">
            <span className="inline-flex items-center gap-1.5"><Icon name="pin" size={16} className="text-brand-700" />{t("sample.areas")}</span>
            <span className="inline-flex items-center gap-1.5"><Icon name="globe" size={16} className="text-brand-700" />{t("sample.language")}</span>
          </p>
        </div>
        {view === "family" ? (
          <div className="hidden flex-none text-right sm:block">
            <b className="block text-[19px] font-extrabold leading-tight tracking-tight">{t("sample.rate")}</b>
            <span className="text-[13px] text-ink-600">{t("sample.ratePer")}</span>
          </div>
        ) : null}
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold">
        {view === "family" ? (
          <>
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-brand-800">
              <Icon name="book" size={16} />
              {t("sample.openFamily")}
            </span>
            <span className="rounded-full bg-warn-50 px-4 py-2 text-warn-700 sm:hidden">
              <b className="font-extrabold">{t("sample.rate")}</b> {t("sample.ratePer")}
            </span>
          </>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-2 text-brand-800">
            <Icon name="landmark" size={16} />
            {t("sample.openSchool")}
          </span>
        )}
      </p>
    </div>
  );
}
