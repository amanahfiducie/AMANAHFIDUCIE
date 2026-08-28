"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { userIsComiteCharaique } from "@/lib/role-access";
import { useFaraidReviewContext } from "@/providers/faraid-review-provider";
import { useAuth } from "@/providers/auth-provider";

const ITEMS = [
  { slug: "synthese", label: "Synthèse" },
  { slug: "evaluation", label: "Évaluation" },
  { slug: "partage", label: "Partage" },
] as const;

export function SuccessionSubNav({ caseId }: { caseId: number }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const ctx = useFaraidReviewContext();
  const base = `/dossiers/${caseId}/succession`;
  const isComite = userIsComiteCharaique(user);
  const isFinalized = ctx?.review?.status === "FINALIZED";

  return (
    <nav
      className="mb-5 border-b-2 border-[var(--sf-green)]"
      aria-label="Sections succession"
    >
      <div className="flex flex-wrap items-center justify-center gap-0 overflow-x-auto">
        {ITEMS.map((item) => {
          const label =
            item.slug === "partage" && isFinalized ? "Arbre final" : item.label;
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
        {isComite && !isFinalized ? (
          <Link
            href={`${base}/modifier`}
            className="ml-2 shrink-0 rounded-full border border-[var(--sf-gold)]/50 bg-[var(--sf-gold)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--sf-green-deep)] transition hover:bg-[var(--sf-gold)]/20"
          >
            Modifier patrimoine
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
