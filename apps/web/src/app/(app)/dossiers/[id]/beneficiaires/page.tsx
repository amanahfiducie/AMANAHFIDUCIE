"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { CaseBeneficiariesHub } from "@/components/case/case-beneficiaries-hub";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function CaseBeneficiairesPage() {
  const { data, caseId } = useCaseDetail();
  const router = useRouter();

  useEffect(() => {
    if (data?.case_type === "SUCCESSION" && caseId) {
      router.replace(`/dossiers/${caseId}/beneficiaires/informations`);
    }
  }, [data?.case_type, caseId, router]);

  if (!data) return null;

  if (data.case_type === "SUCCESSION") {
    return null;
  }

  return <CaseBeneficiariesHub />;
}
