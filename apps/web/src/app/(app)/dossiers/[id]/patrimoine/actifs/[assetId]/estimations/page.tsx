"use client";

import { use } from "react";

import { CasePatrimoineAssetEvents } from "@/components/case/case-patrimony-hub";

export default function CasePatrimoineAssetEstimationsPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = use(params);
  return <CasePatrimoineAssetEvents assetId={assetId} eventType="ESTIMATION" />;
}
