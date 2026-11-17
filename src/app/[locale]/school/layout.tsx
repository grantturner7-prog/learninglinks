import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth/session";
import { redirect } from "@/i18n/navigation";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

/** School-only area: campuses, checkout and job posts. Other account types go back to their dashboard. */
export default async function SchoolLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const user = await requireUser(locale, "/school/campuses");
  if (user.accountType !== "school") return redirect({ href: "/dashboard", locale });
  const all = await getMessages();
  return (
    <NextIntlClientProvider messages={{ common: all.common, notice: all.notice, billing: all.billing, school: all.school, taxonomy: all.taxonomy }}>
      {children}
    </NextIntlClientProvider>
  );
}
