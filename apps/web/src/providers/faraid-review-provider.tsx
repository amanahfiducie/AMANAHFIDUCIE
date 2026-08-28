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
import { buildHeirDecisionMaps, type HeirDecisionPatch } from "@/lib/faraid/heir-decision-maps";
import type {
  FaraidCommitteeReview,
  FaraidHeirDecision,
  FaraidSettlementAction,
} from "@/types/api";

type FaraidReviewContextValue = {
  review: FaraidCommitteeReview | null;
  loading: boolean;
  error: string | null;
  maps: ReturnType<typeof buildHeirDecisionMaps>;
  refresh: () => Promise<FaraidCommitteeReview | null>;
  syncFromGenealogy: (deceasedGender?: "M" | "F") => Promise<void>;
  updateDecision: (decisionId: number, patch: HeirDecisionPatch) => Promise<FaraidHeirDecision>;
  createAction: (body: Record<string, unknown>) => Promise<FaraidSettlementAction>;
  deleteAction: (actionId: number) => Promise<void>;
  finalizeReview: () => Promise<FaraidCommitteeReview>;
  syncing: boolean;
  saving: boolean;
};

const FaraidReviewContext = createContext<FaraidReviewContextValue | null>(null);

export function FaraidReviewProvider({
  caseId,
  enabled,
  children,
}: {
  caseId: string;
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [review, setReview] = useState<FaraidCommitteeReview | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [syncing, setSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    if (!enabled) return null;
    const data = await apiRequest<FaraidCommitteeReview>(`/cases/${caseId}/faraid-review/`);
    setReview(data);
    return data;
  }, [caseId, enabled]);

  const refresh = useCallback(async () => {
    if (!enabled) return null;
    setLoading(true);
    setError(null);
    try {
      return await loadReview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible.");
      return null;
    } finally {
      setLoading(false);
    }
  }, [enabled, loadReview]);

  useEffect(() => {
    if (!enabled) {
      setReview(null);
      setLoading(false);
      return;
    }
    void refresh();
  }, [enabled, refresh]);

  const syncFromGenealogy = useCallback(
    async (deceasedGender: "M" | "F" = "M") => {
      if (!enabled) return;
      setSyncing(true);
      setError(null);
      try {
        const data = await apiRequest<FaraidCommitteeReview>(
          `/cases/${caseId}/faraid-review/sync/`,
          {
            method: "POST",
            body: JSON.stringify({ deceased_gender: deceasedGender }),
          },
        );
        setReview(data);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Synchronisation impossible.";
        setError(message);
        throw err;
      } finally {
        setSyncing(false);
      }
    },
    [caseId, enabled],
  );

  const updateDecision = useCallback(
    async (decisionId: number, patch: HeirDecisionPatch) => {
      setSaving(true);
      try {
        const updated = await apiRequest<FaraidHeirDecision>(
          `/cases/${caseId}/faraid-review/heirs/${decisionId}/`,
          { method: "PATCH", body: JSON.stringify(patch) },
        );
        setReview((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            heir_decisions: prev.heir_decisions.map((d) =>
              d.id === updated.id ? updated : d,
            ),
          };
        });
        return updated;
      } finally {
        setSaving(false);
      }
    },
    [caseId],
  );

  const createAction = useCallback(
    async (body: Record<string, unknown>) => {
      setSaving(true);
      try {
        const created = await apiRequest<FaraidSettlementAction>(
          `/cases/${caseId}/faraid-review/actions/`,
          { method: "POST", body: JSON.stringify(body) },
        );
        setReview((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            settlement_actions: [...prev.settlement_actions, created],
          };
        });
        return created;
      } finally {
        setSaving(false);
      }
    },
    [caseId],
  );

  const deleteAction = useCallback(
    async (actionId: number) => {
      setSaving(true);
      try {
        await apiRequest(`/cases/${caseId}/faraid-review/actions/${actionId}/`, {
          method: "DELETE",
        });
        setReview((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            settlement_actions: prev.settlement_actions.filter((a) => a.id !== actionId),
          };
        });
      } finally {
        setSaving(false);
      }
    },
    [caseId],
  );

  const finalizeReview = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const data = await apiRequest<FaraidCommitteeReview>(
        `/cases/${caseId}/faraid-review/finalize/`,
        { method: "POST" },
      );
      setReview(data);
      return data;
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Finalisation impossible.";
      setError(message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [caseId]);

  const maps = useMemo(
    () => buildHeirDecisionMaps(review?.heir_decisions ?? []),
    [review?.heir_decisions],
  );

  const value = useMemo(
    () => ({
      review,
      loading,
      error,
      maps,
      refresh,
      syncFromGenealogy,
      updateDecision,
      createAction,
      deleteAction,
      finalizeReview,
      syncing,
      saving,
    }),
    [
      review,
      loading,
      error,
      maps,
      refresh,
      syncFromGenealogy,
      updateDecision,
      createAction,
      deleteAction,
      finalizeReview,
      syncing,
      saving,
    ],
  );

  return (
    <FaraidReviewContext.Provider value={value}>{children}</FaraidReviewContext.Provider>
  );
}

export function useFaraidReviewContext(): FaraidReviewContextValue | null {
  return useContext(FaraidReviewContext);
}
