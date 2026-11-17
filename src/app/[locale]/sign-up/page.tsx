import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { SignUpForm } from "@/components/forms/sign-up-form";
import { sanitizeAccountType } from "@/lib/auth/helpers";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ type?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signUp" });
  return { title: t("meta"), robots: { index: false } };
}

export default async function SignUpPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect({ href: "/dashboard", locale });
  const { type } = await searchParams;
  const t = await getTranslations("auth.signUp");
  return (
    <AuthCard title={t("title")} wide>
      <SignUpForm initialType={sanitizeAccountType(Array.isArray(type) ? type[0] : type)} />
    </AuthCard>
  );
}
