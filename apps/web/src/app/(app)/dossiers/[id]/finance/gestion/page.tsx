"use client";

import { CaseInvestmentGestionView } from "@/components/investments/case-investment-gestion";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function CaseFinanceGestionPage() {
  const { caseId } = useCaseDetail();
  return <CaseInvestmentGestionView caseId={Number(caseId)} />;
}
