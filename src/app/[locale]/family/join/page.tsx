import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FamilyJoin } from "@/components/billing/checkout-flows";
import { formatMoney, PLANS, priceForCampuses } from "@/lib/plans";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing.meta" });
  return { title: t("familyJoin"), robots: { index: false } };
}

export default async function FamilyJoinPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const price = formatMoney(priceForCampuses(PLANS.family_tw, 1), "TWD", locale);
  return <FamilyJoin priceLabel={price} />;
}
