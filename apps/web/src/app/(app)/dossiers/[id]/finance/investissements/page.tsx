"use client";

import { CaseInvestmentsFullList } from "@/components/investments/case-investments-list";
import { useCaseInvestmentData } from "@/components/investments/use-case-investment-data";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function CaseFinanceInvestissementsPage() {
  const { caseId } = useCaseDetail();
  const id = Number(caseId);
  const { dashboard, loading, error } = useCaseInvestmentData(id, false);

  if (loading) return <LoadingState label="Chargement des investissements…" />;
  if (error && !dashboard) return <ErrorAlert message={error} />;
  if (!dashboard) return null;

  return (
    <CaseInvestmentsFullList
      caseId={id}
      investments={dashboard.investments}
      charts={dashboard.charts}
    />
  );
}
