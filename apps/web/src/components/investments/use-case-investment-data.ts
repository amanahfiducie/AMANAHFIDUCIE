"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type {
  CaseBeneficiaryCapital,
  CaseInvestmentDashboard,
  FinancialSummary,
  InvestmentCatalog,
} from "@/types/api";

export function useCaseInvestmentData(caseId: number, showFinanceSummary = true) {
  const [dashboard, setDashboard] = useState<CaseInvestmentDashboard | null>(null);
  const [catalog, setCatalog] = useState<InvestmentCatalog | null>(null);
  const [capital, setCapital] = useState<CaseBeneficiaryCapital | null>(null);
  const [finance, setFinance] = useState<FinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const requests: Promise<unknown>[] = [
        apiRequest<CaseInvestmentDashboard>(`/cases/${caseId}/investment-dashboard/`),
        apiRequest<InvestmentCatalog>("/investments/catalog/"),
        apiRequest<CaseBeneficiaryCapital>(`/cases/${caseId}/investment-capital/`),
      ];
      if (showFinanceSummary) {
        requests.push(apiRequest<FinancialSummary>(`/cases/${caseId}/financial-summary/`));
      }
      const results = await Promise.all(requests);
      setDashboard(results[0] as CaseInvestmentDashboard);
      setCatalog(results[1] as InvestmentCatalog);
      setCapital(results[2] as CaseBeneficiaryCapital);
      if (showFinanceSummary && results[3]) {
        setFinance(results[3] as FinancialSummary);
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de charger les investissements.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId, showFinanceSummary]);

  useEffect(() => {
    void load();
  }, [load]);

  return { dashboard, catalog, capital, finance, loading, error, reload: load };
}
