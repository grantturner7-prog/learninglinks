import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LogoMark } from "@/components/logo";
import { MobileMenu } from "@/components/mobile-menu";
import { NavLinks } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { getCurrentUser, type CurrentUser } from "@/lib/auth/session";
import { Link } from "@/i18n/navigation";

type NavKey = "findEducators" | "forSchools" | "forFamilies" | "howItWorks" | "findTutors" | "myMembership" | "myJobs" | "myCampuses" | "jobsMap" | "myProfile" | "whoAsked" | "adminDesk";

/**
 * The menu follows the person. A visitor sees what LearningLinks is; a family sees tutors and its membership; a school
 * sees educators, its job posts and its campuses; an educator sees the jobs map, their profile and who asked for
 * their details. (What each of them may actually open is decided on each page, never here.)
 */
function menuFor(user: CurrentUser | null): ReadonlyArray<{ href: string; key: NavKey }> {
  if (!user) {
    return [
      { href: "/educators", key: "findEducators" },
      { href: "/for-schools", key: "forSchools" },
      { href: "/for-families", key: "forFamilies" },
      { href: "/#how", key: "howItWorks" },
    ];
  }
  const own: Array<{ href: string; key: NavKey }> =
    user.accountType === "family"
      ? [
          { href: "/educators", key: "findTutors" },
          { href: "/dashboard", key: "myMembership" },
        ]
      : user.accountType === "school"
        ? [
            { href: "/educators", key: "findEducators" },
            { href: "/school/jobs", key: "myJobs" },
            { href: "/school/campuses", key: "myCampuses" },
          ]
        : [
            { href: "/jobs", key: "jobsMap" },
            { href: "/educator/profile", key: "myProfile" },
            { href: "/educator/contacts", key: "whoAsked" },
          ];
  return user.isAdmin ? [{ href: "/admin", key: "adminDesk" }, ...own] : own;
}

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const user = await getCurrentUser();
  const items = menuFor(user).map(({ href, key }) => ({ href, label: t(key) }));
  const account = user
    ? [
        { href: "/dashboard", label: t("dashboard") },
        { href: "/account", label: t("account") },
      ]
    : [
        { href: "/sign-in", label: t("signIn") },
        { href: "/sign-up", label: t("signUp") },
      ];
  const initial = user ? ([...user.name.trim()][0] ?? "·").toUpperCase() : "";

  return (
    <header className="relative z-30 border-b border-ink-100 bg-white text-ink-900">
      <div className="container-wide flex h-[68px] items-center gap-1.5 lg:gap-4">
        <Link href="/" className="mr-auto inline-flex min-h-11 items-center gap-2.5 text-[18px] font-extrabold tracking-tight text-ink-900 no-underline lg:mr-3 lg:text-[20px]">
          <LogoMark size={22} />
          LearningLinks
        </Link>
        <NavLinks items={items} label={t(user ? "yourPages" : "main")} />
        <div className="flex flex-none items-center gap-1 lg:gap-2.5">
          <LanguageSwitcher />
          {user ? (
            <>
              <Link href="/dashboard" className="hidden min-h-11 items-center gap-2.5 rounded-full border border-ink-200 bg-white py-1.5 pl-1.5 pr-4 text-sm font-bold text-ink-900 no-underline hover:border-ink-900 sm:inline-flex">
                <span aria-hidden className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-accent-400 text-[13px] font-extrabold text-ink-900">{initial}</span>
                <span className="sr-only">{t("dashboard")}: </span>
                <span className="max-w-[10rem] truncate">{user.name}</span>
              </Link>
              <SignOutButton className="hidden min-h-11 items-center rounded-full px-3 text-sm font-bold text-ink-600 hover:bg-ink-50 hover:text-ink-900 disabled:opacity-50 lg:inline-flex" />
            </>
          ) : (
            <>
              <Link href="/sign-in" className="inline-flex min-h-11 items-center px-2.5 text-sm font-extrabold text-ink-900 no-underline hover:underline lg:px-3 lg:text-[15px]">
                {t("signIn")}
              </Link>
              <Link href="/sign-up" className="btn btn-primary hidden rounded-full sm:inline-flex">
                {t("signUp")}
              </Link>
            </>
          )}
          <MobileMenu items={items} account={account} labels={{ open: t("menu"), close: t("closeMenu"), nav: t(user ? "yourPages" : "main") }}>
            {user ? <SignOutButton className="menu-link w-full text-left disabled:opacity-50" /> : null}
          </MobileMenu>
        </div>
      </div>
    </header>
  );
}
