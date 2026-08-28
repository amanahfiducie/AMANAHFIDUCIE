"use client";

import { use } from "react";

import { SuccessionPartagePanel } from "@/components/succession/succession-partage-panel";

export default function CaseSuccessionPartagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SuccessionPartagePanel caseId={id} />;
}
