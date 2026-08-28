"use client";

import { CaseScheduledPaymentsManager } from "@/components/investments/case-scheduled-payments";
import { useCaseInvestmentData } from "@/components/investments/use-case-investment-data";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function CaseFinanceVersementsPage() {
  const { caseId } = useCaseDetail();
  const id = Number(caseId);
  const { dashboard, capital, loading, error, reload } = useCaseInvestmentData(
    id,
    false,
  );

  if (loading) return <LoadingState label="Chargement des versements…" />;
  if (error && !dashboard) return <ErrorAlert message={error} />;
  if (!dashboard) return null;

  return (
    <CaseScheduledPaymentsManager
      caseId={id}
      initialPayments={dashboard.policy.scheduled_payments ?? []}
      capital={capital}
      onSaved={() => {
        void reload();
      }}
    />
  );
}
