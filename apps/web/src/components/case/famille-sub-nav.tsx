"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useCaseDetail } from "@/providers/case-detail-provider";
import { useFaraidReviewContext } from "@/providers/faraid-review-provider";

const ITEMS = [
  { slug: "informations", label: "Informations" },
  { slug: "arbre", label: "Arbre généalogique" },
] as const;

export function FamilleSubNav({ caseId }: { caseId: number }) {
  const pathname = usePathname();
  const { navBase } = useCaseDetail();
  const ctx = useFaraidReviewContext();
  const base = `${navBase}/beneficiaires`;
  void caseId;
  const isFinalized = ctx?.review?.status === "FINALIZED";

  return (
    <nav
      className="mb-5 border-b-2 border-[var(--sf-green)]"
      aria-label="Sections famille"
    >
      <div className="flex flex-wrap justify-center gap-0 overflow-x-auto">
        {ITEMS.map((item) => {
          const label =
            item.slug === "arbre" && isFinalized ? "Arbre final" : item.label;
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
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
