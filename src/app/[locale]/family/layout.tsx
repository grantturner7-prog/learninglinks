import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

/** Family-only area (joining and paying). Other account types go back to their dashboard. */
export default async function FamilyLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/family/join");
  if (user.accountType !== "family") return redirect({ href: "/dashboard", locale });
  const all = await getMessages();
  return <NextIntlClientProvider messages={{ common: all.common, notice: all.notice, billing: all.billing }}>{children}</NextIntlClientProvider>;
}
