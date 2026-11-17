import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { EducatorSteps } from "@/components/educator/steps";
import { ProfileForm, type Option } from "@/components/educator/profile-form";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { profileStrength } from "@/lib/educators/completeness";
import { getEducatorState } from "@/lib/educators/service";
import { CITIES, DISTRICTS } from "@/lib/geo/taiwan";
import { cityLabel, districtLabel } from "@/lib/geo-labels";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "educator.meta" });
  return { title: t("profile"), robots: { index: false } };
}

export default async function ProfilePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = (await getCurrentUser())!;
  const t = await getTranslations("educator.profile");
  const state = await getEducatorState(getDb(), user.id);
  const p = state.profile;

  const cities: Option[] = CITIES.map((c) => ({ key: c.key, label: cityLabel(c.key, locale) }));
  const districtsByCity: Record<string, Option[]> = {};
  for (const d of DISTRICTS) (districtsByCity[d.city] ??= []).push({ key: d.key, label: districtLabel(d.key, locale) });

  return (
    <div className="container-page py-10">
      <EducatorSteps waiverDone={state.waiverValid} profileDone={!!p} published={p?.status === "published"} />
      <h1 className="mt-6 text-3xl font-extrabold">{t("title")}</h1>
      <p className="mt-1 max-w-2xl text-ink-600">{t("lead")}</p>
      <div className="mt-6">
        <ProfileForm
          locale={locale}
          initial={state.input}
          status={p?.status ?? null}
          strength={profileStrength(state.input, !!p?.photoKey)}
          blockers={state.blockers}
          photoUrl={p?.photoKey ? `/api/photos/${p.id}?v=${p.updatedAt.getTime()}` : null}
          cities={cities}
          districtsByCity={districtsByCity}
        />
      </div>
    </div>
  );
}
