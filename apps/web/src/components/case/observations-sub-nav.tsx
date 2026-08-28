"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { userCanViewCaseRemarksSubmenu } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";

const BASE_ITEMS = [{ slug: "partagees", label: "Observations" }] as const;

export function ObservationsSubNav({ caseId }: { caseId: number }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const base = `/dossiers/${caseId}/observations`;
  const showRemarks = userCanViewCaseRemarksSubmenu(user);

  const items = showRemarks
    ? [...BASE_ITEMS, { slug: "remarques", label: "Remarques" } as const]
    : [...BASE_ITEMS];

  return (
    <nav
      className="mb-5 border-b-2 border-[var(--sf-green)]"
      aria-label="Sections observations"
    >
      <div className="flex flex-wrap justify-center gap-0 overflow-x-auto">
        {items.map((item) => {
          const href = `${base}/${item.slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={item.slug}
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
