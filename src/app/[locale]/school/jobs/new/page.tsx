import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { JobFlow } from "@/components/school/job-flow";
import { getCurrentUser } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { geoOptions } from "@/lib/geo-options";
import { listMyCampuses } from "@/lib/orgs/service";
import { redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "school.meta" });
  return { title: t("newJob"), robots: { index: false } };
}

export default async function NewJobPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = (await getCurrentUser())!;
  const campuses = (await listMyCampuses(getDb(), user.id)).filter((c) => c.membership.active);
  // Only a campus with an active membership can post; anyone else is sent to the jobs page, which explains why.
  if (campuses.length === 0) return redirect({ href: "/school/jobs", locale });
  return <JobFlow campuses={campuses.map((c) => ({ id: c.id, name: c.name, city: c.city ?? "", district: c.district ?? "" }))} {...geoOptions(locale)} />;
}
