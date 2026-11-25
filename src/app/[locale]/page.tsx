import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { WaitlistForm } from "@/components/forms/waitlist-form";
import { LinkSays, SampleTag } from "@/components/home/link-says";
import { Phrases } from "@/components/home/phrases";
import { SampleCard } from "@/components/home/sample-card";
import { SampleDistricts } from "@/components/home/sample-districts";
import { SampleMap } from "@/components/home/sample-map";
import { Building, Heart, User } from "@/components/icons";
import { Icon, type IconName } from "@/components/journey/icons";
import { getSiteNumbers, roundedDown } from "@/lib/site-numbers";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.meta" });
  return { title: t("title"), description: t("description") };
}

/**
 * Three doors, with the price on each. Families and schools first see what they are paying for; teachers go
 * straight to sign-up (it is free). The educator door is the dark one, so "free" is the card people remember.
 */
const DOORS: ReadonlyArray<{ key: "family" | "school" | "teach"; href: string; icon: ReactNode; tile: string; dark?: boolean }> = [
  { key: "family", href: "/for-families", icon: <Heart size={26} />, tile: "bg-accent-300 text-warn-700" },
  { key: "school", href: "/for-schools", icon: <Building size={26} />, tile: "bg-brand-100 text-brand-800" },
  { key: "teach", href: "/sign-up?type=educator", icon: <User size={26} />, tile: "bg-accent-400 text-ink-900", dark: true },
];

const TICKS = ["members", "district", "fee"] as const;

const PRIVATE: ReadonlyArray<{ key: "members" | "district" | "contact" | "control"; icon: IconName }> = [
  { key: "members", icon: "lock" },
  { key: "district", icon: "pin" },
  { key: "contact", icon: "mail" },
  { key: "control", icon: "eyeOff" },
];

const STEPS = ["s1", "s2", "s3"] as const;

/** The "Atlas" home page (owner choice, 25 Nov 2026): the map leads, on deep aubergine. */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const f = await getFormatter();
  const numbers = await getSiteNumbers();

  const mapLabels = {
    aria: t("near.map.aria"),
    taipei: t("near.map.taipei"),
    newTaipei: t("near.map.newTaipei"),
    taichung: t("near.map.taichung"),
    tainan: t("near.map.tainan"),
    kaohsiung: t("near.map.kaohsiung"),
  };
  // Only true, public numbers: schools come from government lists. Nothing here counts educators.
  const facts: Array<{ value: string; label: string; accent?: boolean }> = [
    ...(numbers.schools && numbers.schools > 0 ? [{ value: `${f.number(roundedDown(numbers.schools))}${numbers.schools >= 1000 ? "+" : ""}`, label: t("atlas.numbers.schools") }] : []),
    { value: f.number(numbers.districts), label: t("atlas.numbers.districts") },
    { value: f.number(numbers.cities), label: t("atlas.numbers.cities") },
    { value: t("atlas.numbers.zero"), label: t("atlas.numbers.free"), accent: true },
  ];

  return (
    <>
      {/* The map leads. One clear thing to do for people looking, one for people who teach. */}
      <section className="relative overflow-hidden bg-brand-900 text-white">
        <div className="container-wide grid grid-cols-1 items-center gap-x-10 gap-y-8 pb-12 pt-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pb-16 lg:pt-14">
          <div className="flex flex-col items-start gap-5">
            <p className="rounded-full bg-brand-800 px-3.5 py-1 text-[13px] font-extrabold text-accent-300">{t("atlas.eyebrow")}</p>
            <h1 className="text-balance text-[38px] font-extrabold leading-[1.08] tracking-tight text-white sm:text-6xl xl:text-[68px]">
              <Phrases text={t("atlas.title")} />
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-brand-200 sm:text-xl">{t("atlas.sub")}</p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/educators" className="btn btn-accent btn-lg">
                {t("atlas.ctaFind")}
                <Icon name="arrowR" size={18} />
              </Link>
              <Link href="/sign-up?type=educator" className="btn-on-dark btn-lg">
                {t("atlas.ctaTeach")}
              </Link>
            </div>
            <ul className="mt-1 flex flex-col gap-2 text-[15px] font-semibold text-brand-100 sm:flex-row sm:flex-wrap sm:gap-x-6">
              {TICKS.map((k) => (
                <li key={k} className="flex items-center gap-2">
                  <Icon name="check" size={16} stroke={3} className="flex-none text-accent-400" />
                  {t(`atlas.ticks.${k}`)}
                </li>
              ))}
            </ul>
          </div>

          {/* A clearly labelled SAMPLE of the member map and of one profile. No real educators, no profile links. */}
          <div className="relative mx-auto w-full max-w-[600px]">
            <SampleMap tone="dark" labels={mapLabels} className="mx-auto h-auto w-[68%] max-w-[270px] sm:max-w-[330px] lg:ml-auto lg:mr-2 lg:w-[62%] lg:max-w-[370px]" />
            <div className="mt-4 flex flex-col items-center gap-3 xl:absolute xl:left-0 xl:top-2 xl:mt-0 xl:w-[292px] xl:items-start">
              <div className="hidden w-full text-ink-900 xl:block">
                <SampleCard view="family" compact />
              </div>
              <p className="flex flex-wrap items-center justify-center gap-2.5 text-[13.5px] font-medium text-brand-200 xl:justify-start">
                <SampleTag>{t("near.map.tag")}</SampleTag>
                {t("near.map.note")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* True numbers only: schools from government lists, and how much of Taiwan the map covers. */}
      <section aria-label={t("atlas.numbers.label")} className="border-b border-ink-100 bg-paper">
        <dl className={`container-wide grid grid-cols-2 gap-x-6 gap-y-6 py-8 ${facts.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {facts.map((n) => (
            <div key={n.label} className="flex flex-col-reverse justify-end">
              <dt className="text-[15px] font-semibold leading-snug text-ink-600">{n.label}</dt>
              <dd className={`text-4xl font-extrabold tracking-tight sm:text-5xl ${n.accent ? "text-accent-600" : "text-ink-900"}`}>{n.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Which one are you? The price is on the door. */}
      <section aria-labelledby="doors-h" className="py-12 sm:py-16">
        <div className="container-wide">
          <h2 id="doors-h" className="text-3xl font-extrabold tracking-tight sm:text-[40px]">
            <Phrases text={t("atlas.doorsTitle")} />
          </h2>
          <p className="mt-2 max-w-2xl text-lg text-ink-700">{t("atlas.doorsSub")}</p>
          <ul className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3" aria-label={t("doors.label")}>
            {DOORS.map(({ key, href, icon, tile, dark }) => (
              <li
                key={key}
                className={`relative flex flex-col gap-3 rounded-[32px] p-6 transition-transform hover:-translate-y-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent-400 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-8 ${dark ? "bg-brand-900 text-white shadow-soft" : "border border-ink-100 bg-paper shadow-card"}`}
              >
                <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] ${tile}`}>{icon}</span>
                <h3 className={`mt-1 text-[26px] font-extrabold leading-tight tracking-tight ${dark ? "text-white" : ""}`}>{t(`doors.${key}.title`)}</h3>
                <p className={`text-pretty leading-relaxed ${dark ? "text-brand-200" : "text-ink-700"}`}>{t(`doors.${key}.body`)}</p>
                <p className="mt-auto flex flex-wrap items-baseline gap-x-2.5 pt-3">
                  <b className={`text-4xl font-extrabold tracking-tight ${dark ? "text-accent-400" : ""}`}>{t(`doors.${key}.price`)}</b>
                  <span className={`text-[15px] font-semibold ${dark ? "text-brand-200" : "text-ink-600"}`}>{t(`doors.${key}.per`)}</span>
                </p>
                <Link href={href} className={`btn btn-lg mt-2 w-full after:absolute after:inset-0 after:rounded-[32px] after:content-[''] ${dark ? "btn-accent" : "btn-primary"}`}>
                  {t(`doors.${key}.cta`)}
                  <Icon name="arrowR" size={18} />
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[15px] leading-relaxed text-ink-700">{t("doors.note")}</p>
        </div>
      </section>

      {/* How it works: three steps, beside a picture of "zoom in to your district". */}
      <section id="how" aria-labelledby="how-h" className="scroll-mt-4 border-y border-ink-100 bg-paper py-12 sm:py-16">
        <div className="container-wide grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
          <div>
            <h2 id="how-h" className="text-3xl font-extrabold tracking-tight sm:text-[40px]">{t("atlas.howTitle")}</h2>
            <ol className="mt-8 flex flex-col gap-7">
              {STEPS.map((key, i) => (
                <li key={key} className="flex gap-5">
                  <span aria-hidden className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-brand-900 text-xl font-extrabold text-white">{i + 1}</span>
                  <div>
                    <h3 className="text-xl font-extrabold tracking-tight">{t(`how.${key}.title`)}</h3>
                    <p className="mt-1 max-w-xl leading-relaxed text-ink-700">{t(`how.${key}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <figure className="m-0 rounded-[32px] bg-brand-50 p-3 sm:p-5">
            <SampleDistricts aria={t("atlas.districtsAria")} locale={locale} className="h-auto w-full rounded-[22px]" />
            <figcaption className="mt-3 flex flex-wrap items-center gap-2.5 px-2 pb-1 text-sm font-medium text-ink-700">
              <SampleTag>{t("near.map.tag")}</SampleTag>
              {t("atlas.districtsNote")}
            </figcaption>
          </figure>
        </div>
      </section>

      {/* Private by design: the rules educators rely on, in plain words. */}
      <section aria-labelledby="private-h" className="py-12 sm:py-16">
        <div className="container-wide">
          <h2 id="private-h" className="text-3xl font-extrabold tracking-tight sm:text-[40px]">
            <Phrases text={t("atlas.privateTitle")} />
          </h2>
          <p className="mt-2 max-w-2xl text-lg text-ink-700">{t("atlas.privateSub")}</p>
          <ul className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PRIVATE.map(({ key, icon }) => (
              <li key={key} className="flex flex-col gap-2.5 rounded-[28px] border border-ink-100 bg-paper p-6 shadow-card">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-800">
                  <Icon name={icon} size={24} />
                </span>
                <h3 className="mt-1 text-lg font-extrabold leading-snug tracking-tight">{t(`atlas.private.${key}.title`)}</h3>
                <p className="text-[15px] leading-relaxed text-ink-700">{t(`atlas.private.${key}.body`)}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Other countries: where we open next, and the waitlist (the working form and server action are unchanged). */}
      <section aria-labelledby="wl-h" className="pb-14 sm:pb-16">
        <div className="container-wide">
          <div className="grid grid-cols-1 items-center gap-8 rounded-[36px] bg-brand-50 p-6 sm:p-10 lg:grid-cols-2 lg:gap-12">
            <div className="flex flex-col gap-6">
              <LinkSays tone="paper">
                <h2 id="wl-h" className="text-balance text-xl font-extrabold leading-snug tracking-tight sm:text-2xl">
                  <Phrases text={t("markets.say")} />
                </h2>
              </LinkSays>
              <ol className="flex flex-col gap-1 pl-2" aria-label={t("markets.title")}>
                {(
                  [
                    ["now", "markets.now", "markets.liveList"],
                    ["next", "markets.next", "markets.nextList"],
                    ["later", "markets.later", "markets.laterList"],
                  ] as const
                ).map(([k, label, list]) => (
                  <li key={k} className="flex min-h-9 items-center gap-4 text-[15px]">
                    <i aria-hidden className={`h-[18px] w-[18px] flex-none rounded-full ${k === "now" ? "bg-accent-400 shadow-[0_0_0_5px] shadow-accent-300" : "bg-paper inset-ring-[3px] inset-ring-brand-300"}`} />
                    <b className="font-bold text-ink-900">
                      {t(label)}: {t(list)}
                    </b>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-4 rounded-[28px] bg-paper p-6 shadow-card sm:p-8">
              <h3 className="text-xl font-extrabold tracking-tight">{t("markets.waitlistTitle")}</h3>
              <WaitlistForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
