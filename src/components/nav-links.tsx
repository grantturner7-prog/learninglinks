"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const ITEMS = [
  { href: "/educators", key: "findEducators" },
  { href: "/for-schools", key: "forSchools" },
  { href: "/for-families", key: "forFamilies" },
] as const;

export function NavLinks({ showJobs = false }: { showJobs?: boolean }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  return (
    <nav aria-label={t("main")} className="order-3 flex min-w-0 flex-1 gap-0.5 overflow-x-auto md:order-2 md:overflow-visible">
      {[...ITEMS, ...(showJobs ? ([{ href: "/jobs", key: "jobs" }] as const) : [])].map((i) => (
        <Link key={i.href} href={i.href} className="nav-link whitespace-nowrap" aria-current={pathname.startsWith(i.href) ? "page" : undefined}>
          {t(i.key)}
        </Link>
      ))}
    </nav>
  );
}
