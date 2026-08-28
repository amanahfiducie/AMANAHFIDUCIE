"use client";

import type { ReactNode } from "react";

import { AssetEventSubNav } from "@/components/case/asset-event-sub-nav";
import { PatrimoineSubNav } from "@/components/case/patrimoine-sub-nav";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useCaseDetail } from "@/providers/case-detail-provider";

export function CasePatrimonyAssetShell({
  assetId,
  children,
}: {
  assetId: string;
  children: ReactNode;
}) {
  const { data } = useCaseDetail();
  const id = Number(assetId);
  const asset = data?.assets.find((a) => a.id === id);

  if (!data) return null;

  return (
    <>
      <PatrimoineSubNav caseId={data.id} />
      {!asset ? (
        <ErrorAlert message="Ce bien est introuvable dans ce dossier." />
      ) : (
        <div className="space-y-6">
          <AssetEventSubNav caseId={data.id} assetId={asset.id} />
          {children}
        </div>
      )}
    </>
  );
}
