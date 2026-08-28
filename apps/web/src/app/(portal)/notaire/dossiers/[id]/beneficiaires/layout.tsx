"use client";

import { FamilleSubNav } from "@/components/case/famille-sub-nav";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data } = useCaseDetail();
  if (data?.case_type !== "SUCCESSION") return <>{children}</>;
  return (
    <>
      <FamilleSubNav caseId={data.id} />
      {children}
    </>
  );
}
