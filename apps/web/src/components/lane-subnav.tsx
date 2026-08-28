"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function LaneSubnav({
  basePath,
  items,
}: {
  basePath: string;
  items: { href: string; label: string }[];
}) {
  const pathname = usePathname();

  const resolvedItems = items.map((item) => ({
    ...item,
    href: item.href.startsWith("/") ? item.href : `${basePath}/${item.href}`,
  }));
  const activeHref =
    resolvedItems
      .filter(
        (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  return (
    <nav className="mb-5 mt-4 border-b-2 border-[var(--sf-green)]">
      <div className="flex flex-wrap justify-center gap-0 overflow-x-auto">
        {resolvedItems.map((item) => {
          const { href } = item;
          const active = href === activeHref;
          return (
            <Link
              key={href}
              href={href}
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
