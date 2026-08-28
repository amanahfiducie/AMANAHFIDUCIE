"use client";

import { use } from "react";

import { PortalCasePatrimoineAssetPage } from "@/components/portal-case-pages";

export default function Page({
  params,
}: {
  params: Promise<{ assetId: string }>;
}) {
  const { assetId } = use(params);
  return <PortalCasePatrimoineAssetPage assetId={assetId} />;
}
