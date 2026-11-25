"use client";

import { Link, usePathname } from "@/i18n/navigation";

export interface NavItem {
  href: string;
  label: string;
}

/** A menu entry is "current" on its own page and on the pages beneath it. A link to a part of a page never is. */
export const isCurrentPage = (pathname: string, href: string) => !href.includes("#") && (pathname === href || pathname.startsWith(`${href}/`));

/** The top bar's links, from lg up. On smaller screens the same links live in the menu (MobileMenu). */
export function NavLinks({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="hidden min-w-0 flex-1 lg:flex">
      {items.map((i) => (
        <Link key={i.href} href={i.href} className="top-link" aria-current={isCurrentPage(pathname, i.href) ? "page" : undefined}>
          {i.label}
        </Link>
      ))}
    </nav>
  );
}
