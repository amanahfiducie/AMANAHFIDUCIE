"use client";

import { CaseReviewList } from "@/components/case-review-list";

export default function JuridiqueDossiersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
          Dossiers en revue juridique
        </h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Dossiers au statut UNDER_REVIEW, LEGAL_REVIEW ou COMPLIANCE_REVIEW —
          pièces, mandats et conformité à contrôler.
        </p>
      </div>
      <CaseReviewList
        statusFilter="UNDER_REVIEW,LEGAL_REVIEW,COMPLIANCE_REVIEW"
        title="revue juridique"
      />
    </div>
  );
}
