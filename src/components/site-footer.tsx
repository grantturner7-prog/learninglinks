import { getTranslations } from "next-intl/server";
import { LogoMark } from "@/components/logo";
import { Link } from "@/i18n/navigation";

const COLUMNS = [
  {
    title: "explore",
    links: [
      { href: "/educators", ns: "nav", key: "findEducators" },
      { href: "/for-schools", ns: "nav", key: "forSchools" },
      { href: "/for-families", ns: "nav", key: "forFamilies" },
      { href: "/#how", ns: "nav", key: "howItWorks" },
    ],
  },
  {
    title: "help",
    links: [
      { href: "/safety", ns: "footer", key: "safety" },
      { href: "/sign-in", ns: "nav", key: "signIn" },
      { href: "/sign-up", ns: "nav", key: "signUp" },
    ],
  },
  {
    title: "legal",
    links: [
      { href: "/legal/terms", ns: "footer", key: "terms" },
      { href: "/legal/privacy", ns: "footer", key: "privacy" },
      { href: "/legal/educator-waiver", ns: "footer", key: "waiver" },
    ],
  },
] as const;

export async function SiteFooter() {
  const t = await getTranslations("footer");
  const tn = await getTranslations("nav");
  const year = new Date().getFullYear();
  return (
    <footer className="bg-brand-900 pb-8 pt-12 text-[15px] text-brand-200">
      <div className="container-wide grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <div className="col-span-2 flex max-w-sm flex-col gap-3 md:col-span-1">
          <span className="inline-flex items-center gap-2.5 text-lg font-extrabold text-white">
            <LogoMark size={22} light />
            LearningLinks
          </span>
          <p className="text-white">{t("tagline")}</p>
          <p className="text-sm">{t("about")}</p>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.title} aria-label={t(col.title)} className="flex flex-col items-start">
            <h2 className="mb-1.5 text-sm font-extrabold uppercase tracking-[0.06em] text-white">{t(col.title)}</h2>
            {col.links.map((l) => (
              <Link key={l.href} href={l.href} className="inline-flex min-h-10 items-center text-brand-200 no-underline hover:text-white hover:underline">
                {l.ns === "nav" ? tn(l.key) : t(l.key)}
              </Link>
            ))}
          </nav>
        ))}
      </div>
      <p className="container-wide mt-10 flex flex-wrap gap-x-6 gap-y-1 border-t border-brand-800 pt-6 text-sm text-brand-300">
        <span>{t("rights", { year })}</span>
        <span>{t("based")}</span>
      </p>
    </footer>
  );
}
