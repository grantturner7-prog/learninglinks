"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { isCurrentPage, type NavItem } from "@/components/nav-links";
import { Link, usePathname } from "@/i18n/navigation";

/**
 * The menu button for phones and tablets: the same links as the top bar, plus the account links.
 * It opens under the bar, closes on Escape or when a link is chosen, and hands focus back to the button.
 */
export function MobileMenu({ items, account, labels, children }: {
  items: NavItem[];
  /** Links for the person's own account (dashboard, account) or for joining (sign in, join). */
  account: NavItem[];
  labels: { open: string; close: string; nav: string };
  /** Extra controls at the end of the menu, such as the sign-out button. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div className="lg:hidden">
      <button
        ref={button}
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? labels.close : labels.open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-brand-800 text-white hover:bg-brand-700"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open ? (
        <nav id="site-menu" aria-label={labels.nav} className="absolute inset-x-0 top-16 z-40 flex flex-col gap-1 border-t border-brand-800 bg-brand-900 px-3 pb-5 pt-3 shadow-soft">
          {items.map((i) => (
            <Link key={i.href} href={i.href} className="menu-link" onClick={close} aria-current={isCurrentPage(pathname, i.href) ? "page" : undefined}>
              {i.label}
            </Link>
          ))}
          <hr className="my-2 border-brand-800" />
          {account.map((i) => (
            <Link key={i.href} href={i.href} className="menu-link" onClick={close} aria-current={isCurrentPage(pathname, i.href) ? "page" : undefined}>
              {i.label}
            </Link>
          ))}
          {children}
        </nav>
      ) : null}
    </div>
  );
}
