import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { WaitlistForm } from "@/components/forms/waitlist-form";
import { Ban, Building, FileX, Gift, Heart, Lock, Search, Shield, Sliders, User } from "@/components/icons";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "home.meta" });
  return { title: t("title"), description: t("description") };
}

const PROMISES = [
  { key: "free", Icon: Gift, tone: "bg-brand-50 text-brand-700 border-brand-100" },
  { key: "fees", Icon: Ban, tone: "bg-warn-50 text-accent-600 border-accent-400/40" },
  { key: "control", Icon: Sliders, tone: "bg-brand-50 text-brand-700 border-brand-100" },
  { key: "sensitive", Icon: FileX, tone: "bg-brand-50 text-brand-700 border-brand-100" },
] as const;

const AVATAR_TONES = ["bg-brand-100 text-brand-800", "bg-rose-100 text-[#8a2447]", "bg-accent-300 text-accent-600"] as const;

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const samples = [
    { init: "A", name: t("sample.itemA.name"), line: t("sample.itemA.line") },
    { init: "B", name: t("sample.itemB.name"), line: t("sample.itemB.line") },
    { init: "C", name: t("sample.itemC.name"), line: t("sample.itemC.line") },
  ];
  const columns = [
    { key: "educator", Icon: User, badge: t("how.free"), steps: t.raw("how.educator.steps") as string[], title: t("how.educator.title") },
    { key: "school", Icon: Building, badge: t("how.plan"), steps: t.raw("how.school.steps") as string[], title: t("how.school.title") },
    { key: "family", Icon: Heart, badge: t("how.plan"), steps: t.raw("how.family.steps") as string[], title: t("how.family.title") },
  ];

  return (
    <>
      <section className="py-14">
        <div className="container-page grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3.5 py-1 text-sm font-bold text-brand-800">
              {t("hero.eyebrow")}
            </span>
            <h1 className="mt-4 text-4xl font-extrabold sm:text-5xl">{t("hero.title")}</h1>
            <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-600">{t("hero.subtitle")}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/sign-up?type=educator" className="btn btn-primary btn-lg">
                {t("hero.ctaEducator")}
              </Link>
              <Link href="/for-schools" className="btn btn-secondary btn-lg">
                {t("hero.ctaSchool")}
              </Link>
              <Link href="/for-families" className="btn btn-secondary btn-lg">
                {t("hero.ctaFamily")}
              </Link>
            </div>
            <p className="mt-4 text-sm text-ink-500">{t("hero.fine")}</p>
          </div>

          <div className="card flex flex-col gap-3" aria-label={t("sample.title")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold">{t("sample.title")}</span>
              <span className="badge-warn">{t("sample.badge")}</span>
            </div>
            <div className="field flex items-center gap-2.5 !text-ink-500">
              <Search size={18} />
              {t("sample.search")}
            </div>
            {samples.map((s, i) => (
              <div key={s.init} className="flex items-center gap-3 rounded-xl border border-ink-200 bg-white p-3">
                <span className={`inline-flex h-12 w-12 flex-none items-center justify-center rounded-full text-lg font-extrabold ${AVATAR_TONES[i] ?? AVATAR_TONES[0]}`}>
                  {s.init}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{s.name}</div>
                  <div className="truncate text-sm text-ink-500">{s.line}</div>
                </div>
                <span className="badge-muted gap-1">
                  <Lock size={13} />
                  {t("sample.contact")}
                </span>
              </div>
            ))}
            <p className="text-xs text-ink-500">{t("sample.note")}</p>
          </div>
        </div>
      </section>

      <section className="border-y border-ink-100 bg-white py-14">
        <div className="container-page">
          <h2 className="text-center text-3xl font-extrabold">{t("promises.title")}</h2>
          <div className="mt-9 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PROMISES.map(({ key, Icon, tone }) => (
              <div key={key} className="flex flex-col gap-3.5">
                <span className={`inline-flex h-12 w-12 items-center justify-center rounded-[13px] border ${tone}`}>
                  <Icon size={24} />
                </span>
                <h3 className="text-xl font-bold">{t(`promises.items.${key}.title`)}</h3>
                <p className="text-ink-600">{t(`promises.items.${key}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container-page">
          <h2 className="text-center text-3xl font-extrabold">{t("how.title")}</h2>
          <div className="mt-9 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {columns.map(({ key, Icon, badge, steps, title }) => (
              <div key={key} className="card flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-[13px] border border-brand-100 bg-brand-50 text-brand-700">
                    <Icon size={24} />
                  </span>
                  <h3 className="text-xl font-bold">{title}</h3>
                  <span className="badge">{badge}</span>
                </div>
                <ol className="flex flex-col gap-3">
                  {steps.map((s, i) => (
                    <li key={s} className="flex items-start gap-3">
                      <span className="inline-flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-brand-700 text-sm font-extrabold text-white">
                        {i + 1}
                      </span>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-ink-100 bg-white py-11">
        <div className="container-page">
          <div className="flex flex-wrap items-start gap-5 rounded-2xl border border-brand-100 bg-brand-50 p-5">
            <span className="inline-flex h-12 w-12 flex-none items-center justify-center rounded-[13px] border border-brand-100 bg-white text-brand-700">
              <Shield size={24} />
            </span>
            <div className="min-w-0 flex-1 basis-56">
              <h3 className="text-xl font-bold">{t("trust.title")}</h3>
              <p className="mt-1.5 max-w-3xl text-ink-600">{t("trust.body")}</p>
            </div>
            <Link href="/safety" className="btn btn-secondary">
              {t("trust.link")}
            </Link>
          </div>
        </div>
      </section>

      <section className="py-14">
        <div className="container-page grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
          <div className="flex flex-col gap-4">
            <h2 className="text-3xl font-extrabold">{t("markets.title")}</h2>
            <p className="flex flex-wrap items-center gap-3">
              <span className="badge">{t("markets.live")}</span>
              <strong>{t("markets.liveList")}</strong>
            </p>
            <p className="flex flex-wrap items-center gap-3">
              <span className="badge-warn">{t("markets.next")}</span>
              <strong>{t("markets.nextList")}</strong>
            </p>
            <p className="flex flex-wrap items-center gap-3">
              <span className="badge-muted">{t("markets.later")}</span>
              <strong>{t("markets.laterList")}</strong>
            </p>
          </div>
          <div className="card relative flex flex-col gap-3.5">
            <h3 className="text-xl font-bold">{t("markets.waitlistTitle")}</h3>
            <WaitlistForm />
          </div>
        </div>
      </section>
    </>
  );
}
