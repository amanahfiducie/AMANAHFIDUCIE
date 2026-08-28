"use client";

import { use } from "react";

import { ServiceDetailPage } from "@/components/services/service-detail-page";

export default function ServiceCaseTypePage({
  params,
}: {
  params: Promise<{ caseType: string }>;
}) {
  const { caseType } = use(params);
  return <ServiceDetailPage caseType={caseType} />;
}
