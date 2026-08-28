"use client";

import { useCallback, useEffect, useState } from "react";

import { FaraidReviewWorkspace } from "@/components/charia/faraid-review-workspace";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { CaseDetailProvider, useCaseDetail } from "@/providers/case-detail-provider";
import type { Asset } from "@/types/api";

function FaraidReviewPageInner({ caseId }: { caseId: string }) {
  const { data: caseDetail, reload } = useCaseDetail();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssets = useCallback(async () => {
    const list = await apiRequest<Asset[]>(`/cases/${caseId}/assets/`);
    setAssets(list);
  }, [caseId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAssets()])
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, [loadAssets]);

  if (loading || !caseDetail) {
    return <LoadingState label="Chargement du dossier…" />;
  }

  if (caseDetail.case_type !== "SUCCESSION") {
    return (
      <ErrorAlert message="Ce module est réservé aux dossiers de type succession." />
    );
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}
      <FaraidReviewWorkspace
        caseId={caseId}
        caseDetail={caseDetail}
        assets={assets}
        onReloadCase={reload}
      />
    </div>
  );
}

export default function ChariaFaraidPartagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [caseId, setCaseId] = useState<string | null>(null);

  useEffect(() => {
    void params.then((p) => setCaseId(p.id));
  }, [params]);

  if (!caseId) return <LoadingState label="Chargement…" />;

  return (
    <CaseDetailProvider caseId={caseId}>
      <FaraidReviewPageInner caseId={caseId} />
    </CaseDetailProvider>
  );
}
