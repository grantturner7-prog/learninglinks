import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { SignInForm } from "@/components/forms/sign-in-form";
import { getCurrentUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string | string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "auth.signIn" });
  return { title: t("meta"), robots: { index: false } };
}

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  if (await getCurrentUser()) redirect({ href: "/dashboard", locale });
  const { next } = await searchParams;
  const t = await getTranslations("auth.signIn");
  return (
    <AuthCard title={t("title")}>
      <SignInForm next={Array.isArray(next) ? next[0] : next} />
    </AuthCard>
  );
}
