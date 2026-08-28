"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/investissements", label: "Tableau de bord" },
  { href: "/investissements/liste", label: "Investissements" },
  { href: "/investissements/categories", label: "Catégories" },
  { href: "/investissements/types", label: "Types A–D" },
] as const;

export function InvestmentsSubNav() {
  const pathname = usePathname();

  const activeHref =
    [...ITEMS]
      .filter(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  return (
    <nav
      className="mb-5 border-b-2 border-[var(--sf-green)]"
      aria-label="Sections investissements PIGFI"
    >
      <div className="flex flex-wrap justify-center gap-0 overflow-x-auto">
        {ITEMS.map((item) => {
          const active = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative shrink-0 border-b-2 -mb-[2px] px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "rounded-t-lg border-[var(--sf-green)] bg-[var(--sf-green)] text-[var(--sf-gold)] font-semibold"
                  : "rounded-t-md border-transparent text-[var(--sf-green)]/55 hover:border-[var(--sf-green)]/25 hover:bg-[var(--sf-cream)]/25 hover:text-[var(--sf-green-deep)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
