"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import type { FaraidCommitteeReview } from "@/types/api";

export function useFaraidReview(caseId: string) {
  const [review, setReview] = useState<FaraidCommitteeReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    const data = await apiRequest<FaraidCommitteeReview>(`/cases/${caseId}/faraid-review/`);
    setReview(data);
    return data;
  }, [caseId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadReview();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [loadReview]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { review, loading, error, refresh, loadReview, setError };
}
