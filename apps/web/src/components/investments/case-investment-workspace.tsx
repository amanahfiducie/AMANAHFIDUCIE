"use client";

import Link from "next/link";

import { CaseInvestmentDashboardView } from "@/components/investments/case-investment-dashboard";

type Props = {
  caseId: number;
  showFinanceSummary?: boolean;
};

/** @deprecated Utiliser CaseInvestmentDashboardView + routes finance/gestion */
export function CaseInvestmentWorkspace({ caseId, showFinanceSummary = true }: Props) {
  return <CaseInvestmentDashboardView caseId={caseId} showFinanceSummary={showFinanceSummary} />;
}

export function InvestmentsHubLink({ caseId }: { caseId: number }) {
  return (
    <Link
      href={`/dossiers/${caseId}/finance`}
      className="text-sm font-medium text-[var(--sf-green)] underline-offset-2 hover:underline"
    >
      Ouvrir la finance du dossier
    </Link>
  );
}
