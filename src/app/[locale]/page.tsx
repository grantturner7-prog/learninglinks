import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WaitlistForm } from "@/components/forms/waitlist-form";
import { DoorArt, type DoorKind } from "@/components/home/door-art";
import { HonestNotice } from "@/components/home/honest-notice";
import { LinkSays, SampleTag } from "@/components/home/link-says";
import { Phrases } from "@/components/home/phrases";
import { SampleCard } from "@/components/home/sample-card";
import { SampleMap } from "@/components/home/sample-map";
import { Icon, type IconName } from "@/components/journey/icons";
import { LinkGuide } from "@/components/logo";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.meta" });
  return { title: t("title"), description: t("description") };
}

/** Teachers go straight to sign-up (it is free); schools and families first see what they are paying for. */
const DOORS: ReadonlyArray<{ key: "teach" | "school" | "family"; kind: DoorKind; href: string; tint: string }> = [
  { key: "teach", kind: "teach", href: "/sign-up?type=educator", tint: "bg-brand-100" },
  { key: "school", kind: "school", href: "/for-schools", tint: "bg-accent-300" },
  { key: "family", kind: "family", href: "/for-families", tint: "bg-rose-100" },
];

const KNOW: ReadonlyArray<{ key: "public" | "hide" | "district" | "one"; icon: IconName }> = [
  { key: "public", icon: "lock" },
  { key: "hide", icon: "eyeOff" },
  { key: "district", icon: "pin" },
  { key: "one", icon: "key" },
];

const STEPS: ReadonlyArray<{ key: "s1" | "s2" | "s3"; icon: IconName }> = [
  { key: "s1", icon: "sparkle" },
  { key: "s2", icon: "pencil" },
  { key: "s3", icon: "link" },
];

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");

  return (
    <>
      {/* Link says hello and asks the one question: what brings you here? */}
      <section className="relative overflow-hidden pb-6 pt-8 sm:pt-12">
        <svg aria-hidden="true" viewBox="0 0 420 420" className="pointer-events-none absolute -right-24 -top-24 hidden h-[420px] w-[420px] sm:block">
          <circle cx="250" cy="170" r="150" fill="none" strokeWidth="3" className="stroke-brand-200" />
          <circle cx="170" cy="250" r="110" fill="none" strokeWidth="3" className="stroke-accent-300" />
        </svg>
        <div className="container-page relative">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-end sm:justify-center sm:gap-9">
            <span className="inline-flex flex-none rounded-full bg-paper p-3 shadow-soft sm:mb-2 sm:p-4">
              <span className="sm:hidden"><LinkGuide size={84} /></span>
              <span className="hidden sm:block"><LinkGuide size={120} /></span>
            </span>
            <div className="relative rounded-[32px] bg-paper px-6 py-6 shadow-soft sm:rounded-[40px] sm:px-12 sm:py-8">
              <span aria-hidden className="absolute -top-1.5 left-1/2 h-5 w-5 -translate-x-1/2 rotate-45 rounded-[5px] bg-paper sm:-left-2 sm:bottom-12 sm:top-auto sm:translate-x-0" />
              <h1 className="relative text-[34px] font-extrabold leading-[1.1] tracking-tight text-balance sm:text-6xl">
                <span className="block"><Phrases text={t("hero.hi")} /></span>
                <span className="block"><Phrases text={t("hero.question")} /></span>
              </h1>
            </div>
          </div>
          <p className="mx-auto mt-7 max-w-2xl text-center text-lg leading-relaxed text-ink-700">{t("hero.sub")}</p>

          <ul className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-7" aria-label={t("doors.label")}>
            {DOORS.map(({ key, kind, href, tint }) => (
              <li
                key={key}
                className={`group relative flex flex-col rounded-t-[190px] rounded-b-[40px] px-6 pb-6 pt-8 shadow-soft transition-transform before:pointer-events-none before:absolute before:inset-3.5 before:rounded-t-[176px] before:rounded-b-[28px] before:border-2 before:border-ink-900/10 hover:-translate-y-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:px-8 sm:pb-8 sm:pt-10 ${tint}`}
              >
                <div className="flex h-[150px] justify-center sm:h-[210px]">
                  <DoorArt kind={kind} className="h-full w-auto" />
                </div>
                <div className="relative mt-2 flex flex-1 flex-col px-1">
                  <h2 className="text-[30px] font-extrabold leading-tight tracking-tight">{t(`doors.${key}.title`)}</h2>
                  <p className="mt-3 text-pretty text-base leading-relaxed text-ink-900">{t(`doors.${key}.body`)}</p>
                  <div className="mb-1 mt-6 rounded-[22px] bg-paper/85 px-5 py-3.5">
                    <b className="block text-3xl font-extrabold leading-tight tracking-tight">{t(`doors.${key}.price`)}</b>
                    <span className="text-sm font-semibold text-ink-700">{t(`doors.${key}.per`)}</span>
                  </div>
                  <Link href={href} className="btn btn-primary btn-lg mt-4 w-full after:absolute after:inset-0 after:rounded-[inherit] after:content-['']">
                    {t(`doors.${key}.cta`)}
                    <Icon name="arrowR" size={18} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <p className="mx-auto mt-7 max-w-3xl text-center text-[14.5px] leading-relaxed text-ink-700">{t("doors.note")}</p>
        </div>
      </section>

      {/* Trust points, in plain words. */}
      <section aria-label={t("know.label")} className="py-6 sm:py-8">
        <div className="container-page">
          <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
            {KNOW.map(({ key, icon }) => (
              <li key={key} className="flex items-center gap-4 rounded-3xl bg-paper/80 px-5 py-4 inset-ring-[1.5px] inset-ring-ink-100">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-brand-50 text-brand-700">
                  <Icon name={icon} size={22} />
                </span>
                <span className="text-[15px] font-bold leading-snug">{t(`know.items.${key}`)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm font-medium text-ink-700">
            <Icon name="lock" size={16} className="flex-none text-brand-700" />
            {t("know.docs")}
          </p>
        </div>
      </section>

      {/* A calm, clearly labelled SAMPLE of the member map. No real educators, no profile links. */}
      <section aria-labelledby="near-h" className="py-8 sm:py-12">
        <div className="container-page">
          <div className="grid overflow-hidden rounded-[36px] bg-paper shadow-soft sm:rounded-[48px] lg:grid-cols-[minmax(0,1fr)_540px]">
            <div className="flex flex-col gap-6 p-6 sm:p-10 lg:p-12">
              <LinkSays>
                <h2 id="near-h" className="text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl"><Phrases text={t("near.say")} /></h2>
              </LinkSays>
              <p className="max-w-xl text-[17px] leading-relaxed text-ink-900">{t("near.body")}</p>
              <SampleCard view="family" />
              <p className="flex items-start gap-2.5 text-sm font-medium text-ink-700">
                <Icon name="lock" size={16} className="mt-1 flex-none text-brand-700" />
                {t("near.micro")}
              </p>
              <ol className="relative flex flex-col" aria-label={t("markets.title")}>
                {(
                  [
                    ["now", "markets.now", "markets.liveList"],
                    ["next", "markets.next", "markets.nextList"],
                    ["later", "markets.later", "markets.laterList"],
                  ] as const
                ).map(([k, label, list]) => (
                  <li key={k} className="relative flex min-h-11 items-center gap-4 text-[15px] text-ink-700 [&:not(:first-child)]:before:absolute [&:not(:first-child)]:before:-top-3 [&:not(:first-child)]:before:left-[8px] [&:not(:first-child)]:before:h-6 [&:not(:first-child)]:before:border-l-[3px] [&:not(:first-child)]:before:border-dotted [&:not(:first-child)]:before:border-brand-300 [&:not(:first-child)]:before:content-['']">
                    <i aria-hidden className={`relative z-10 h-[18px] w-[18px] flex-none rounded-full ${k === "now" ? "bg-accent-400 shadow-[0_0_0_5px] shadow-accent-300" : "bg-paper inset-ring-[3px] inset-ring-brand-300"}`} />
                    <span>
                      <b className="font-bold text-ink-900">{t(label)}: {t(list)}</b>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
            <div className="relative flex flex-col items-center justify-center overflow-hidden bg-brand-50 px-5 py-8 sm:py-10">
              <span aria-hidden className="absolute -right-20 -top-14 h-64 w-64 rounded-full inset-ring-[3px] inset-ring-brand-200" />
              <span aria-hidden className="absolute -bottom-16 -left-10 h-48 w-48 rounded-full inset-ring-[3px] inset-ring-accent-300" />
              <SampleMap
                className="relative z-10 h-auto w-full max-w-[420px] lg:max-w-[452px]"
                labels={{
                  aria: t("near.map.aria"),
                  taipei: t("near.map.taipei"),
                  newTaipei: t("near.map.newTaipei"),
                  taichung: t("near.map.taichung"),
                  tainan: t("near.map.tainan"),
                  kaohsiung: t("near.map.kaohsiung"),
                }}
              />
              <p className="relative z-10 mt-4 flex flex-wrap items-center justify-center gap-2.5 text-[13.5px] font-medium text-ink-700">
                <SampleTag>{t("near.map.tag")}</SampleTag>
                {t("near.map.note")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it works: three small steps. */}
      <section aria-labelledby="how-h" className="py-8 sm:py-12">
        <div className="container-page">
          <LinkSays className="max-w-3xl">
            <h2 id="how-h" className="text-balance text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl"><Phrases text={t("how.title")} /></h2>
          </LinkSays>
          <ol className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
            {STEPS.map(({ key, icon }, i) => (
              <li key={key} className="flex flex-col gap-3 rounded-[32px] bg-paper p-6 shadow-card sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-900 text-xl font-extrabold text-white">{i + 1}</span>
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-300 text-accent-600">
                    <Icon name={icon} size={24} />
                  </span>
                </div>
                <h3 className="mt-1 text-xl font-extrabold tracking-tight">{t(`how.${key}.title`)}</h3>
                <p className="leading-relaxed text-ink-700">{t(`how.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Other countries: the waitlist (the working form and server action are unchanged). */}
      <section aria-labelledby="wl-h" className="py-8 sm:py-12">
        <div className="container-page grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-12">
          <LinkSays>
            <h2 id="wl-h" className="text-balance text-xl font-extrabold leading-snug tracking-tight sm:text-2xl"><Phrases text={t("markets.say")} /></h2>
          </LinkSays>
          <div className="relative flex flex-col gap-4 rounded-[32px] bg-paper p-6 shadow-card sm:rounded-[40px] sm:p-8">
            <h3 className="text-xl font-extrabold tracking-tight">{t("markets.waitlistTitle")}</h3>
            <WaitlistForm />
          </div>
        </div>
      </section>

      {/* Link's "one honest thing", in the canonical wording. The standing notice below stays as well. */}
      <section className="py-8 pb-4 sm:py-12">
        <div className="container-page">
          <HonestNotice locale={locale} />
        </div>
      </section>
    </>
  );
}
