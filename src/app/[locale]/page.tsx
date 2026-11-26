import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";
import { WaitlistForm } from "@/components/forms/waitlist-form";
import { LinkSays, SampleTag } from "@/components/home/link-says";
import { Phrases } from "@/components/home/phrases";
import { SampleAvatar } from "@/components/home/sample-card";
import { SampleDistricts } from "@/components/home/sample-districts";
import { SampleMap } from "@/components/home/sample-map";
import { StartBar, type StartWho } from "@/components/home/start-bar";
import { Building, Heart, User } from "@/components/icons";
import { Icon, type IconName } from "@/components/journey/icons";
import { getCurrentUser } from "@/lib/auth/session";
import { cityLabel } from "@/lib/geo-labels";
import { CITIES } from "@/lib/geo/taiwan";
import { getSiteNumbers, roundedDown } from "@/lib/site-numbers";
import { SUBJECTS } from "@/lib/taxonomy";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.meta" });
  return { title: t("title"), description: t("description") };
}

/**
 * Three doors, with the price on each and what you get for it. Families and schools first see what they are paying
 * for; teachers go straight to sign-up (it is free). The educator door is the night one, so "free" is the card
 * people remember.
 */
const DOORS: ReadonlyArray<{ key: "family" | "school" | "teach"; href: string; icon: ReactNode; dark?: boolean }> = [
  { key: "family", href: "/for-families", icon: <Heart size={26} /> },
  { key: "school", href: "/for-schools", icon: <Building size={26} /> },
  { key: "teach", href: "/sign-up?type=educator", icon: <User size={26} />, dark: true },
];

const TICKS = ["t1", "t2", "t3", "t4"] as const;

const PRIVATE: ReadonlyArray<{ key: "members" | "district" | "contact" | "control"; icon: IconName }> = [
  { key: "members", icon: "lock" },
  { key: "district", icon: "pin" },
  { key: "contact", icon: "mail" },
  { key: "control", icon: "eyeOff" },
];

const STEPS = ["s1", "s2", "s3"] as const;

/**
 * The home page (owner choice, 26 Nov 2026): light and familiar, like a booking site. It says what LearningLinks is,
 * asks who you are and where, and shows the map on a night stage with warm lights. Everything on the stage is a
 * labelled sample: no real educator, no profile link.
 */
export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tt = await getTranslations("taxonomy");
  const f = await getFormatter();
  const numbers = await getSiteNumbers();
  const user = await getCurrentUser();
  const who: StartWho = user?.accountType === "school" ? "school" : user?.accountType === "educator" ? "educator" : "family";

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
  // Three made-up people for the stage. They are drawings with invented details, and the stage says so.
  const people = [
    { look: 1 as const, name: t("sample.name"), line: t("sample.line"), areas: t("sample.areas"), rate: t("sample.rate") },
    { look: 2 as const, name: t("open.stage.p2.name"), line: t("open.stage.p2.line"), areas: t("open.stage.p2.areas"), rate: t("open.stage.p2.rate") },
    { look: 3 as const, name: t("open.stage.p3.name"), line: t("open.stage.p3.line"), areas: t("open.stage.p3.areas"), rate: t("open.stage.p3.rate") },
  ];

  return (
    <>
      {/* Say what it is, then ask who you are and where. */}
      <section className="bg-ink-50">
        <div className="container-wide flex flex-col items-center gap-5 pb-12 pt-9 text-center sm:pt-14 lg:pb-16">
          <p className="rounded-full border border-ink-200 bg-white px-4 py-1 text-[13.5px] font-bold text-ink-700">{t("atlas.eyebrow")}</p>
          <h1 className="max-w-4xl text-balance text-[40px] font-extrabold leading-[1.06] tracking-tight sm:text-6xl xl:text-[66px]">
            <Phrases text={t("open.title")} />
          </h1>
          <p className="max-w-2xl text-lg leading-relaxed text-ink-700 sm:text-xl">{t("open.sub")}</p>
          <div className="mt-1 w-full max-w-[940px]">
            <StartBar
              labels={{
                label: t("open.start.label"),
                who: t("open.start.who"),
                family: t("open.start.family"),
                school: t("open.start.school"),
                educator: t("open.start.educator"),
                subject: t("open.start.subject"),
                anySubject: t("open.start.anySubject"),
                near: t("open.start.near"),
                anywhere: t("open.start.anywhere"),
                go: t("open.start.go"),
              }}
              cities={CITIES.map((c) => ({ key: c.key, label: cityLabel(c.key, locale) }))}
              subjects={SUBJECTS.map((k) => ({ key: k, label: tt(`subjects.${k}`) }))}
              initialWho={who}
              educatorHref={user?.accountType === "educator" ? "/jobs" : "/sign-up?type=educator"}
              action={`/${locale}/educators`}
            />
          </div>
          <p className="flex flex-wrap justify-center gap-x-7 gap-y-1">
            <Link href="/for-schools" className="link inline-flex min-h-11 items-center">
              {t("open.altSchool")}
            </Link>
            <Link href="/sign-up?type=educator" className="link inline-flex min-h-11 items-center">
              {t("atlas.ctaTeach")}
            </Link>
          </p>

          {/* The night stage: a clearly labelled SAMPLE of the member map and of three profiles. */}
          <div className="night mt-2 w-full max-w-[1160px] rounded-[28px] p-4 text-left shadow-soft sm:rounded-[32px] sm:p-6" data-testid="stage">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
              <h2 className="text-lg font-extrabold tracking-tight text-night-100">{t("open.stage.title")}</h2>
              <SampleTag tone="night">{t("open.stage.tag")}</SampleTag>
            </div>
            <div className="mt-4 grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
              <SampleMap tone="dark" labels={mapLabels} className="mx-auto h-auto w-[78%] max-w-[320px] sm:max-w-[370px]" />
              <div className="flex flex-col gap-3">
                <p className="px-1 text-[15px] font-bold text-night-200">{t("open.stage.count")}</p>
                {people.map((p) => (
                  <div key={p.look} className="flex items-center gap-3.5 rounded-[18px] border border-night-700 bg-night-850 px-3.5 py-3.5 sm:px-4">
                    <SampleAvatar size={56} look={p.look} ring="ring-2 ring-night-700" />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-[17px] font-extrabold leading-tight text-night-100">{p.name}</span>
                        <span className="whitespace-nowrap text-[15px] font-extrabold text-night-100 sm:text-base">
                          {p.rate} <span className="text-[13px] font-medium text-night-300">{t("sample.ratePer")}</span>
                        </span>
                      </p>
                      <p className="mt-1 text-sm leading-snug text-night-200">
                        {p.line} · {p.areas}
                      </p>
                    </div>
                  </div>
                ))}
                <p className="flex items-center gap-2.5 rounded-[18px] bg-brand-800 px-4 py-3.5 text-[14.5px] leading-snug text-night-200">
                  <Icon name="lock" size={20} className="flex-none text-accent-400" />
                  {t("open.stage.locked")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* True numbers only: schools from government lists, and how much of Taiwan the map covers. */}
      <section aria-label={t("atlas.numbers.label")} className="border-y border-ink-100 bg-white">
        <dl className={`container-wide grid grid-cols-2 gap-y-7 py-8 lg:divide-x lg:divide-ink-100 ${facts.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}>
          {facts.map((n, i) => (
            <div key={n.label} className={`flex flex-col-reverse items-start justify-end gap-1 pr-4 lg:px-7 ${i === 0 ? "lg:pl-0" : ""}`}>
              <dt className="text-[15px] font-semibold leading-snug text-ink-600">{n.label}</dt>
              <dd className={`text-4xl font-extrabold tracking-tight text-ink-900 sm:text-5xl ${n.accent ? "rounded-2xl bg-accent-400 px-3" : ""}`}>{n.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Which one are you? The price is on the door, with what it buys. */}
      <section aria-labelledby="doors-h" className="bg-white py-12 sm:py-16">
        <div className="container-wide">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="doors-h" className="text-3xl font-extrabold tracking-tight sm:text-[42px]">
              <Phrases text={t("atlas.doorsTitle")} />
            </h2>
            <p className="mt-2.5 text-lg text-ink-700">{t("open.doorsSub")}</p>
          </div>
          <ul className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-3" aria-label={t("doors.label")}>
            {DOORS.map(({ key, href, icon, dark }) => (
              <li
                key={key}
                className={`relative flex flex-col gap-3.5 rounded-[26px] p-6 transition-transform hover:-translate-y-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-focus motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-8 ${dark ? "night shadow-soft" : "border border-ink-100 bg-paper shadow-card"}`}
              >
                <span className={`flex h-14 w-14 items-center justify-center rounded-[18px] ${dark ? "bg-accent-400 text-brand-900" : "bg-accent-300 text-ink-900"}`}>{icon}</span>
                <h3 className={`mt-1 text-[25px] font-extrabold leading-tight tracking-tight ${dark ? "text-night-100" : ""}`}>{t(`doors.${key}.title`)}</h3>
                <p className="flex flex-wrap items-baseline gap-x-2.5">
                  <b className={`text-[40px] font-extrabold leading-tight tracking-tight ${dark ? "text-accent-400" : ""}`}>{t(`doors.${key}.price`)}</b>
                  <span className={`text-[15px] font-semibold ${dark ? "text-night-200" : "text-ink-600"}`}>{t(`doors.${key}.per`)}</span>
                </p>
                <ul className="mb-4 mt-1 flex flex-col gap-2.5">
                  {TICKS.map((k) => (
                    <li key={k} className="flex gap-2.5 leading-snug">
                      <span aria-hidden className="mt-px flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-accent-400 text-brand-900">
                        <Icon name="check" size={13} stroke={3.4} />
                      </span>
                      {t(`open.ticks.${key}.${k}`)}
                    </li>
                  ))}
                </ul>
                <Link href={href} className="btn btn-primary btn-lg mt-auto w-full after:absolute after:inset-0 after:rounded-[26px] after:content-['']">
                  {t(`doors.${key}.cta`)}
                  <Icon name="arrowR" size={18} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works: three steps. */}
      <section id="how" aria-labelledby="how-h" className="scroll-mt-4 border-y border-ink-100 bg-ink-50 py-12 sm:py-16">
        <div className="container-wide">
          <h2 id="how-h" className="text-center text-3xl font-extrabold tracking-tight sm:text-[42px]">
            {t("atlas.howTitle")}
          </h2>
          <ol className="mt-9 grid grid-cols-1 gap-5 lg:grid-cols-3">
            {STEPS.map((key, i) => (
              <li key={key} className="rounded-[22px] border border-ink-100 bg-paper p-6 sm:p-7">
                <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-400 text-lg font-extrabold text-ink-900">
                  {i + 1}
                </span>
                <h3 className="mt-3.5 text-xl font-extrabold tracking-tight">{t(`how.${key}.title`)}</h3>
                <p className="mt-1.5 leading-relaxed text-ink-700">{t(`how.${key}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Private by design: the rules educators rely on, beside a picture of "zoom in to your district". */}
      <section aria-labelledby="private-h" className="bg-white py-12 sm:py-16">
        <div className="container-wide grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-14">
          <div>
            <h2 id="private-h" className="text-3xl font-extrabold tracking-tight sm:text-[42px]">
              <Phrases text={t("atlas.privateTitle")} />
            </h2>
            <p className="mt-2.5 max-w-xl text-lg text-ink-700">{t("atlas.privateSub")}</p>
            <ul className="mt-7 flex flex-col gap-5">
              {PRIVATE.map(({ key, icon }) => (
                <li key={key} className="flex gap-4">
                  <span aria-hidden className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-accent-300 text-ink-900">
                    <Icon name={icon} size={24} />
                  </span>
                  <div>
                    <h3 className="text-lg font-extrabold leading-snug tracking-tight">{t(`atlas.private.${key}.title`)}</h3>
                    <p className="mt-0.5 max-w-xl text-[15.5px] leading-relaxed text-ink-700">{t(`atlas.private.${key}.body`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <figure className="night m-0 rounded-[28px] p-3 shadow-soft sm:p-4">
            <div className="relative">
              <SampleDistricts aria={t("atlas.districtsAria")} locale={locale} className="h-auto w-full rounded-[18px]" />
              <span className="absolute left-3 top-3">
                <SampleTag tone="night">{t("near.map.tag")}</SampleTag>
              </span>
            </div>
            <figcaption className="px-2 pb-1 pt-3.5 text-[15px] leading-relaxed text-night-200">{t("open.districtsCaption")}</figcaption>
          </figure>
        </div>
      </section>

      {/* Other countries: where we open next, and the waitlist (the working form and server action are unchanged). */}
      <section aria-labelledby="wl-h" className="bg-white pb-14 sm:pb-16">
        <div className="container-wide">
          <div className="grid grid-cols-1 items-center gap-8 rounded-[28px] border border-ink-100 bg-ink-50 p-6 sm:p-10 lg:grid-cols-2 lg:gap-12">
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
                    <i aria-hidden className={`h-[18px] w-[18px] flex-none rounded-full ${k === "now" ? "bg-accent-400 shadow-[0_0_0_5px] shadow-accent-300" : "bg-paper inset-ring-[3px] inset-ring-ink-300"}`} />
                    <b className="font-bold text-ink-900">
                      {t(label)}: {t(list)}
                    </b>
                  </li>
                ))}
              </ol>
            </div>
            <div className="flex flex-col gap-4 rounded-[24px] border border-ink-100 bg-paper p-6 shadow-card sm:p-8">
              <h3 className="text-xl font-extrabold tracking-tight">{t("markets.waitlistTitle")}</h3>
              <WaitlistForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
