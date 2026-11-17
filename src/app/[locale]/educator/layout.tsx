import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

/** Educator-only area: other account types are sent back to their dashboard. */
export default async function EducatorLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/educator/profile");
  if (user.accountType !== "educator") return redirect({ href: "/dashboard", locale });
  const all = await getMessages();
  return (
    <NextIntlClientProvider messages={{ common: all.common, notice: all.notice, educator: all.educator, journey: all.journey, taxonomy: all.taxonomy }}>
      {children}
    </NextIntlClientProvider>
  );
}
