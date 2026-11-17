import { getTranslations } from "next-intl/server";

/** Waiver → Profile → Publish progress, as in the approved mock-up. */
export async function EducatorSteps({ waiverDone, profileDone, published }: { waiverDone: boolean; profileDone: boolean; published: boolean }) {
  const t = await getTranslations("educator.steps");
  const steps = [
    { label: t("waiver"), done: waiverDone },
    { label: t("profile"), done: profileDone },
    { label: t("publish"), done: published },
  ];
  const currentIndex = steps.findIndex((s) => !s.done);
  return (
    <ol aria-label={t("aria")} className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {steps.map((s, i) => {
        const current = i === currentIndex;
        return (
          <li key={s.label} aria-current={current ? "step" : undefined} className={`flex items-center gap-2 text-sm font-bold ${s.done ? "text-brand-700" : current ? "text-brand-800" : "text-ink-500"}`}>
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full border-2 text-[13px] ${s.done || current ? "border-brand-700 bg-brand-700 text-white" : "border-ink-300"}`}>{s.done ? "✓" : i + 1}</span>
            {s.label}
          </li>
        );
      })}
    </ol>
  );
}
