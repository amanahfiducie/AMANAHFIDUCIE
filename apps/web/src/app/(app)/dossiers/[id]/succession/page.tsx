"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";

import { useCaseDetail } from "@/providers/case-detail-provider";

export default function CaseSuccessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data } = useCaseDetail();
  const router = useRouter();

  useEffect(() => {
    if (data?.case_type === "SUCCESSION") {
      router.replace(`/dossiers/${id}/succession/synthese`);
    }
  }, [data?.case_type, id, router]);

  if (data?.case_type === "SUCCESSION") {
    return null;
  }

  return null;
}
