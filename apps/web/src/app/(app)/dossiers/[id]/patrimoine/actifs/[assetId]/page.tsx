"use client";

import { use } from "react";

import { CasePatrimoineAssetDetail } from "@/components/case/case-patrimony-hub";

export default function CasePatrimoineAssetPage({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = use(params);
  return <CasePatrimoineAssetDetail assetId={assetId} />;
}
