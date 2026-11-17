import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { SignUpForm } from "@/components/forms/sign-up-form";
import { getCurrentUser } from "@/lib/auth/session";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/db/schema/auth";
import { redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signUp" });
  return { title: t("meta"), robots: { index: false } };
}

/** `?type=` preselects the door and skips the first question. Anything unknown is ignored (we ask instead). */
function preselected(value: string | string[] | undefined): AccountType | null {
  const v = Array.isArray(value) ? value[0] : value;
  return (ACCOUNT_TYPES as readonly unknown[]).includes(v) ? (v as AccountType) : null;
}

export default async function SignUpPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect({ href: "/dashboard", locale });
  const { type } = await searchParams;
  return <SignUpForm initialType={preselected(type)} />;
}
