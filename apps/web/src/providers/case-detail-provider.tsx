"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { FiduciaryCaseDetail } from "@/types/api";

type CaseDetailContextValue = {
  caseId: string;
  /** Préfixe de navigation (ex. /dossiers/12 ou /portal/dossiers/12). */
  navBase: string;
  data: FiduciaryCaseDetail | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

const CaseDetailContext = createContext<CaseDetailContextValue | null>(null);

export function CaseDetailProvider({
  caseId,
  navBase,
  children,
}: {
  caseId: string;
  /** Par défaut `/dossiers/{caseId}` (app interne). */
  navBase?: string;
  children: React.ReactNode;
}) {
  const resolvedNavBase = navBase ?? `/dossiers/${caseId}`;
  const [data, setData] = useState<FiduciaryCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const detail = await apiRequest<FiduciaryCaseDetail>(`/cases/${caseId}/`);
      setData(detail);
    } catch (err) {
      setData(null);
      setError(
        err instanceof ApiError ? err.message : "Impossible de charger le dossier.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo(
    () => ({
      caseId,
      navBase: resolvedNavBase,
      data,
      loading,
      error,
      reload,
    }),
    [caseId, resolvedNavBase, data, loading, error, reload],
  );

  return (
    <CaseDetailContext.Provider value={value}>{children}</CaseDetailContext.Provider>
  );
}

export function useOptionalCaseDetail() {
  return useContext(CaseDetailContext);
}

export function useCaseDetail() {
  const ctx = useOptionalCaseDetail();
  if (!ctx) {
    throw new Error("useCaseDetail doit être utilisé dans CaseDetailProvider");
  }
  return ctx;
}
