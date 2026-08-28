"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { listUserAccessRequests } from "@/lib/api";

const ITEMS = [
  { href: "/admin/utilisateurs", label: "Tous les comptes", exact: true },
  { href: "/admin/utilisateurs/demandes", label: "Demandes d'accès" },
  { href: "/admin/utilisateurs/internes", label: "Équipe interne" },
  { href: "/admin/utilisateurs/externes", label: "Parties externes" },
  { href: "/admin/utilisateurs/bloques", label: "Comptes bloqués" },
] as const;

function isActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function UsersSubNav() {
  const pathname = usePathname();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    listUserAccessRequests("PENDING")
      .then((items) => setPendingCount(items.length))
      .catch(() => setPendingCount(0));
  }, [pathname]);

  return (
    <nav
      className="border-b-2 border-[var(--sf-green)]"
      aria-label="Sections utilisateurs"
    >
      <div className="flex flex-wrap justify-center gap-0 overflow-x-auto">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href, "exact" in item && item.exact);
          const showBadge = item.href.endsWith("/demandes") && pendingCount > 0;
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
              <span className="inline-flex items-center gap-2">
                {item.label}
                {showBadge ? (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-amber-950">
                    {pendingCount}
                  </span>
                ) : null}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
