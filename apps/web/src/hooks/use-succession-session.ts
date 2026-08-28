"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { ApiError, apiRequest } from "@/lib/api";
import {
  allAssetsEstimated,
  buildEstimationStatusMap,
} from "@/lib/faraid/asset-estimation-status";
import {
  computeNetEstate,
  defaultSuccessionState,
  parseSuccessionFromOnboarding,
} from "@/lib/faraid/succession-storage";
import type { SuccessionState } from "@/lib/faraid/types";
import { useCaseDetail } from "@/providers/case-detail-provider";
import type { Asset, AssetEvent, FaraidCommitteeReview } from "@/types/api";

export function useSuccessionSession(caseId: string) {
  const { data: caseDetail, reload } = useCaseDetail();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [eventsByAsset, setEventsByAsset] = useState<Record<number, AssetEvent[]>>({});
  const [faraidReview, setFaraidReview] = useState<FaraidCommitteeReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SuccessionState>(defaultSuccessionState);

  const deceasedName = useMemo(() => {
    const d = caseDetail?.donors?.[0];
    if (!d) return "Le défunt";
    return [d.first_name, d.last_name].filter(Boolean).join(" ") || "Le défunt";
  }, [caseDetail?.donors]);

  const familyMembers = useMemo(
    () => caseDetail?.beneficiaries ?? [],
    [caseDetail?.beneficiaries],
  );

  const loadAssets = useCallback(async () => {
    const list = await apiRequest<Asset[]>(`/cases/${caseId}/assets/`);
    setAssets(list);
    if (list.length === 0) {
      setEventsByAsset({});
      return;
    }
    const entries = await Promise.all(
      list.map(async (asset) => {
        const events = await apiRequest<AssetEvent[]>(
          `/assets/${asset.id}/events/?include_cancelled=0`,
        );
        return [asset.id, events] as const;
      }),
    );
    const map: Record<number, AssetEvent[]> = {};
    for (const [id, events] of entries) map[id] = events;
    setEventsByAsset(map);
  }, [caseId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        loadAssets(),
        apiRequest<FaraidCommitteeReview>(`/cases/${caseId}/faraid-review/`)
          .then(setFaraidReview)
          .catch(() => setFaraidReview(null)),
      ]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [caseId, loadAssets]);

  useEffect(() => {
    void refresh();
  }, [refresh, caseDetail?.updated_at]);

  useEffect(() => {
    const od = caseDetail?.onboarding?.onboarding_data;
    if (!od) return;
    setState(parseSuccessionFromOnboarding(od));
  }, [caseDetail?.onboarding?.onboarding_data]);

  const statusMap = useMemo(
    () => buildEstimationStatusMap(assets, eventsByAsset),
    [assets, eventsByAsset],
  );

  const allAssetsEstimatedFlag = useMemo(
    () => assets.length > 0 && allAssetsEstimated(assets, statusMap),
    [assets, statusMap],
  );

  const estimatedGross = useMemo(() => {
    let sum = 0;
    let currency = "XOF";
    for (const asset of assets) {
      const st = statusMap[asset.id];
      if (!st?.estimated || !st.amount) continue;
      const n = Number(st.amount);
      if (!Number.isNaN(n)) sum += n;
      currency = asset.latest_currency ?? asset.currency ?? currency;
    }
    return { sum, currency };
  }, [assets, statusMap]);

  const netEstate = useMemo(
    () => computeNetEstate(state, estimatedGross.sum),
    [state, estimatedGross.sum],
  );

  const estimatedCount = useMemo(
    () => Object.values(statusMap).filter((s) => s.estimated).length,
    [statusMap],
  );

  return {
    caseDetail,
    caseId,
    reload,
    assets,
    eventsByAsset,
    faraidReview,
    loading,
    error,
    state,
    setState,
    deceasedName,
    familyMembers,
    statusMap,
    allAssetsEstimated: allAssetsEstimatedFlag,
    estimatedGross: estimatedGross.sum,
    estimationCurrency: estimatedGross.currency,
    estimatedCount,
    netEstate,
    refresh,
    loadAssets,
  };
}
