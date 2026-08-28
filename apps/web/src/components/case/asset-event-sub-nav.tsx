"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { eventTypeLabel } from "@/lib/asset-event-categories";
import { useOptionalCaseDetail } from "@/providers/case-detail-provider";
import type { AssetEventType } from "@/types/api";

const SECTIONS: { segment: string; label: string; type?: AssetEventType }[] = [
  { segment: "", label: "Résumé" },
  { segment: "gains", label: "Gain", type: "GAIN" },
  { segment: "depenses", label: "Dépenses", type: "EXPENSE" },
  { segment: "estimations", label: "Estimation", type: "ESTIMATION" },
  { segment: "autres", label: "Autre", type: "OTHER" },
];

export function assetEventSectionPath(
  caseId: number,
  assetId: number,
  segment: string,
  navBase?: string,
): string {
  const base = `${navBase ?? `/dossiers/${caseId}`}/patrimoine/actifs/${assetId}`;
  return segment ? `${base}/${segment}` : base;
}

export function parseAssetEventSection(pathname: string): AssetEventType | null {
  if (pathname.endsWith("/gains")) return "GAIN";
  if (pathname.endsWith("/depenses")) return "EXPENSE";
  if (pathname.endsWith("/estimations")) return "ESTIMATION";
  if (pathname.endsWith("/autres")) return "OTHER";
  return null;
}

export function AssetEventSubNav({
  caseId,
  assetId,
}: {
  caseId: number;
  assetId: number;
}) {
  const pathname = usePathname();
  const caseCtx = useOptionalCaseDetail();
  const navBase = caseCtx?.navBase;

  return (
    <nav
      className="mb-5 border-b-2 border-[var(--sf-green)]"
      aria-label="Sections du bien"
    >
      <div className="flex flex-wrap justify-center gap-0 overflow-x-auto">
        {SECTIONS.map((section) => {
          const href = assetEventSectionPath(
            caseId,
            assetId,
            section.segment,
            navBase,
          );
          const active =
            section.segment === ""
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
          const label =
            section.type != null ? eventTypeLabel(section.type) : section.label;

          return (
            <Link
              key={section.segment || "resume"}
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
