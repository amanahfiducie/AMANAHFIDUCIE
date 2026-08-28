"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

import { useCaseDetail } from "@/providers/case-detail-provider";

/** Ancienne route « liste des biens » : redirige vers le résumé global. */
export default function CasePatrimoineActifsRedirectPage() {
  const router = useRouter();
  const params = useParams();
  const { data } = useCaseDetail();
  const caseId = params.id as string;

  useEffect(() => {
    if (!data) return;
    router.replace(`/dossiers/${caseId}/patrimoine`);
  }, [data, caseId, router]);

  return null;
}
