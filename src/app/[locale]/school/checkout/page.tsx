import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SchoolCheckout } from "@/components/billing/checkout-flows";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { areaLabel } from "@/lib/geo-labels";
import { listMyCampuses } from "@/lib/orgs/service";
import { PLANS } from "@/lib/plans";
import { Link } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ campus?: string | string[] }> };

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "billing.meta" });
  return { title: t("schoolCheckout"), robots: { index: false } };
}

export default async function SchoolCheckoutPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const { campus } = await searchParams;
  setRequestLocale(locale);
  const user = (await getCurrentUser())!;
  const campuses = (await listMyCampuses(getDb(), user.id)).filter((c) => !c.suspended);
  if (campuses.length === 0) {
    const t = await getTranslations("billing.school");
    return (
      <div className="container-page max-w-2xl py-12">
        <div className="card text-center">
          <p className="text-lg">{t("none")}</p>
          <Link href="/school/campuses" className="btn btn-primary mt-4">{t("findSchool")}</Link>
        </div>
      </div>
    );
  }
  const wanted = (Array.isArray(campus) ? campus : campus ? [campus] : []);
  // Unpaid or lapsed campuses are ticked by default: that is what a school coming here usually wants to pay for.
  const preselect = wanted.length > 0 ? wanted : campuses.filter((c) => !c.membership.active).map((c) => c.id);
  return (
    <SchoolCheckout
      unitPrice={PLANS.school_tw.listPrice}
      preselect={preselect}
      campuses={campuses.map((c) => ({ id: c.id, name: c.name, place: areaLabel(c.city, c.district ? [c.district] : [], locale), endsAt: c.membership.endsAt?.toISOString() ?? null, active: c.membership.active }))}
    />
  );
}
