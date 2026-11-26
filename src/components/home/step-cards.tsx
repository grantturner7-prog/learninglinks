import { Icon, type IconName } from "@/components/journey/icons";

/** "How it works" as three soft numbered cards. `title` is optional (some pages have one line per step). */
export function StepCards({ steps, icons = ["sparkle", "pencil", "link"] }: { steps: ReadonlyArray<{ title?: string; body: string }>; icons?: ReadonlyArray<IconName> }) {
  return (
    <ol className="grid grid-cols-1 gap-5 md:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.body} className="flex flex-col gap-3 rounded-[32px] bg-paper p-6 shadow-card sm:p-7">
          <div className="flex items-center justify-between">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-400 text-xl font-extrabold text-ink-900">{i + 1}</span>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-300 text-accent-600">
              <Icon name={icons[i] ?? "sparkle"} size={24} />
            </span>
          </div>
          {s.title ? <h3 className="mt-1 text-xl font-extrabold tracking-tight">{s.title}</h3> : null}
          <p className={s.title ? "leading-relaxed text-ink-700" : "mt-1 text-lg font-semibold leading-snug"}>{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
