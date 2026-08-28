"use client";

import { CaseInvestmentDashboardView } from "@/components/investments/case-investment-dashboard";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { caseSupportsInvestments } from "@/lib/investment-labels";
import { formatMoney } from "@/lib/labels";
import { useCaseDetail } from "@/providers/case-detail-provider";
import type { FinancialSummary } from "@/types/api";
import { useEffect, useState } from "react";

export default function CaseFinancePage() {
  const { caseId, data } = useCaseDetail();

  if (caseSupportsInvestments(data?.case_type)) {
    return <CaseInvestmentDashboardView caseId={Number(caseId)} showFinanceSummary />;
  }

  return <LegacyCaseFinance caseId={Number(caseId)} />;
}

function LegacyCaseFinance({ caseId }: { caseId: number }) {
  const [summary, setSummary] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<FinancialSummary>(`/cases/${caseId}/financial-summary/`)
      .then(setSummary)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger la finance.",
        ),
      )
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorAlert message={error} />;

  if (!summary || summary.account_count === 0) {
    return (
      <EmptyState
        title="Aucun compte fiduciaire"
        description="Créez des comptes et mouvements via l'API finance."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">Fonds fiduciaires</h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Comptes séparés de ce mandat — distincts de la comptabilité générale SOFIGEPAM.
        </p>
      </div>
      <div className="rounded-xl border border-[#1a2e1f]/10 bg-white p-5 shadow-sm">
        <p className="text-sm text-[#1a2e1f]/65">Solde total du dossier</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-emerald-900">
          {formatMoney(summary.total_balance, summary.currency)}
        </p>
        <p className="mt-1 text-xs text-[#1a2e1f]/50">
          {summary.account_count} compte(s) actif(s)
        </p>
      </div>

      <ul className="space-y-2">
        {summary.accounts.map((account) => (
          <li
            key={account.account_id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1a2e1f]/10 bg-white px-4 py-3 text-sm"
          >
            <p className="font-medium">{account.account_name}</p>
            <div className="text-right">
              <p className="font-mono text-emerald-900">
                {formatMoney(account.current_balance, summary.currency)}
              </p>
              {account.pending_validation_count > 0 ? (
                <p className="text-xs text-amber-800">
                  {account.pending_validation_count} en validation
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
