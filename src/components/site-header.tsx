import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoMark } from "@/components/logo";
import { NavLinks } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const user = await getCurrentUser();
  return (
    <header className="border-b border-ink-100 bg-white">
      {/* Phone: row 1 = logo + sign-in/join, row 2 = nav + language. From md up: one row. */}
      <div className="container-page flex min-h-[70px] flex-wrap items-center gap-x-2 gap-y-1 py-2 md:gap-x-5">
        <Link href="/" className="order-1 mr-auto inline-flex items-center gap-1.5 text-[17px] font-extrabold tracking-tight text-brand-800 no-underline md:mr-0 md:gap-2.5 md:text-xl">
          <LogoMark size={28} />
          LearningLinks
        </Link>
        <div className="order-2 flex items-center gap-2 md:order-4 md:gap-2.5">
          {user ? (
            <>
              <Link href="/dashboard" className="btn btn-secondary max-md:min-h-10 max-md:px-2.5 max-md:text-sm">
                {t("dashboard")}
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="btn btn-secondary max-md:min-h-10 max-md:px-2.5 max-md:text-sm">
                {t("signIn")}
              </Link>
              <Link href="/sign-up" className="btn btn-primary max-md:min-h-10 max-md:px-2.5 max-md:text-sm">
                {t("signUp")}
              </Link>
            </>
          )}
        </div>
        <div aria-hidden className="order-2 h-0 basis-full md:hidden" />
        <NavLinks showJobs={user?.accountType === "educator"} />
        <div className="order-4 flex-none md:order-3">
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
