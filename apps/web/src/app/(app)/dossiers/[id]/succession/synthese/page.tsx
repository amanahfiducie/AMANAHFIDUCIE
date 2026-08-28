"use client";

import { use } from "react";

import { SuccessionReadSynthese } from "@/components/succession/succession-read-synthese";

export default function CaseSuccessionSynthesePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SuccessionReadSynthese caseId={id} />;
}
