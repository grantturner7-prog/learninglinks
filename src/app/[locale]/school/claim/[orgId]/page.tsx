import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CampusFlow } from "@/components/school/campus-flow";
import { getDb, schema } from "@/lib/db";
import { geoOptions } from "@/lib/geo-options";

type Props = { params: Promise<{ locale: string; orgId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "school.meta" });
  return { title: t("claim"), robots: { index: false } };
}

export default async function ClaimPage({ params }: Props) {
  const { locale, orgId } = await params;
  setRequestLocale(locale);
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) notFound();
  const [org] = await getDb().select({ id: schema.organizations.id, name: schema.organizations.name, status: schema.organizations.status }).from(schema.organizations).where(eq(schema.organizations.id, orgId)).limit(1);
  if (!org || org.status !== "unclaimed") notFound();
  return <CampusFlow mode="claim" organizationId={org.id} organizationName={org.name} {...geoOptions(locale)} />;
}
