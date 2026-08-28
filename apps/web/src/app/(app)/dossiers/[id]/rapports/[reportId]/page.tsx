"use client";

import { use } from "react";

import { CaseReportPreview } from "@/components/case/case-report-preview";

export default function CaseReportPreviewPage({
  params,
}: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const { id, reportId } = use(params);
  return <CaseReportPreview caseId={id} reportId={reportId} />;
}
