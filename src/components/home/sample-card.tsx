import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/journey/icons";
import { SampleTag } from "@/components/home/link-says";

// The sample's own illustration palette (skin and hair), not brand colours.
const SKIN = "#F6CDAE";
const SKIN_NECK = "#E7AE88";
const HAIR = "#8F4A2E";

/** An illustrated face for the made-up sample educator. It is a drawing, never a photo of a real person. */
function SampleAvatar({ size = 72 }: { size?: number }) {
  return (
    <span className="inline-block flex-none overflow-hidden rounded-full ring-[3px] ring-white shadow-card" style={{ width: size, height: size }}>
      <svg viewBox="0 0 96 96" width={size} height={size} aria-hidden="true" focusable="false" className="block">
        <rect width="96" height="96" className="fill-accent-300" />
        <path d="M26 52C21 25 36 11 49 11c13 0 28 14 22 41 2 11 4 21 0 29H27c-4-8-2-18-1-29z" fill={HAIR} />
        <path d="M8 96c2-22 20-28 40-28s38 6 40 28z" className="fill-brand-300" />
        <path d="M41 56h14v14c-3 4-11 4-14 0z" fill={SKIN_NECK} />
        <ellipse cx="48" cy="44" rx="17" ry="19" fill={SKIN} />
        <path d="M30 43C29 25 41 19 50 20c10 1 17 9 16 23-5-7-12-11-20-11-6 0-12 4-16 11z" fill={HAIR} />
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
export async function SampleCard({ view }: { view: "family" | "school" }) {
  const t = await getTranslations("home");
  return (
    <div className="rounded-[28px] bg-paper p-4 pb-5 inset-ring-2 inset-ring-ink-200 sm:p-5" aria-label={t("sample.tag", { view: t(`sample.view.${view}`) })}>
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
