"use client";

import { use } from "react";

import { SuccessionHeirEvaluation } from "@/components/succession/succession-heir-evaluation";

export default function CaseSuccessionEvaluationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <SuccessionHeirEvaluation caseId={id} />;
}
