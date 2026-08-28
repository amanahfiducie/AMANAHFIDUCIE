"use client";

import Link from "next/link";

export function SuccessionEditBanner({ caseId }: { caseId: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sf-gold)]/40 bg-[var(--sf-gold)]/10 px-4 py-3">
      <div>
        <p className="text-sm font-semibold text-[var(--sf-green-deep)]">Mode modification</p>
        <p className="text-xs text-[var(--sf-green)]/60">
          Évaluation patrimoniale, dettes, charges et soumission au comité charaïque.
        </p>
      </div>
      <Link
        href={`/dossiers/${caseId}/succession/synthese`}
        className="sf-btn-secondary shrink-0 text-sm"
      >
        ← Vue lecture
      </Link>
    </div>
  );
}
