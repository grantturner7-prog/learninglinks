import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ProfileJourney, type Option } from "@/components/journey/profile-journey";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { firstIncompleteStep, parseStep } from "@/lib/educators/journey";
import { getEducatorState } from "@/lib/educators/service";
import { CITIES, DISTRICTS } from "@/lib/geo/taiwan";
import { cityLabel, districtLabel } from "@/lib/geo-labels";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ step?: string | string[] }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "educator.meta" });
  return { title: t("profile"), robots: { index: false } };
}

/** The guided profile flow: one question at a time, resuming at the first unanswered one. */
export default async function ProfilePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { step } = await searchParams;
  setRequestLocale(locale);
  const user = (await getCurrentUser())!;
  const state = await getEducatorState(getDb(), user.id);
  const p = state.profile;

  const cities: Option[] = CITIES.map((c) => ({ key: c.key, label: cityLabel(c.key, locale) }));
  const districtsByCity: Record<string, Option[]> = {};
  for (const d of DISTRICTS) (districtsByCity[d.city] ??= []).push({ key: d.key, label: districtLabel(d.key, locale) });

  return (
    <ProfileJourney
      locale={locale}
      initial={state.input}
      initialStep={parseStep(step) ?? firstIncompleteStep(state.input, !!p)}
      hasProfile={!!p}
      suspended={p?.status === "suspended"}
      waiverValid={state.waiverValid}
      photoUrl={p?.photoKey ? `/api/photos/${p.id}?v=${p.updatedAt.getTime()}` : null}
      cities={cities}
      districtsByCity={districtsByCity}
    />
  );
}
