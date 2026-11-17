import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CampusFlow } from "@/components/school/campus-flow";
import { geoOptions } from "@/lib/geo-options";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "school.meta" });
  return { title: t("add"), robots: { index: false } };
}

export default async function AddCampusPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <CampusFlow mode="add" {...geoOptions(locale)} />;
}
