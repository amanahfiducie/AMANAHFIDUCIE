"use client";

import { CaseOverview } from "@/components/case/case-overview";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function CaseOverviewPage() {
  const { data } = useCaseDetail();
  if (!data) return null;
  return <CaseOverview data={data} />;
}
