"use client";

import { usePathname } from "next/navigation";
import { use } from "react";

import { CaseHeaderPortal } from "@/components/case/case-header-portal";
import { CaseTabs } from "@/components/case-tabs";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { CaseDetailProvider, useCaseDetail } from "@/providers/case-detail-provider";
import { FaraidReviewProvider } from "@/providers/faraid-review-provider";

function CaseDetailShell({ children }: { children: React.ReactNode }) {
  const { loading, error, data } = useCaseDetail();
  const pathname = usePathname();
  const hideCaseNav = pathname.includes("/enregistrement");

  if (loading) return <LoadingState label="Chargement du dossier…" />;
  if (error) return <ErrorAlert message={error} />;
  if (!data) return <ErrorAlert message="Dossier introuvable." />;

  return (
    <FaraidReviewProvider
      caseId={String(data.id)}
      enabled={data.case_type === "SUCCESSION"}
    >
      <CaseHeaderPortal />
      {!hideCaseNav ? <CaseTabs caseId={String(data.id)} /> : null}
      {children}
    </FaraidReviewProvider>
  );
}

export default function CaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <CaseDetailProvider caseId={id}>
      <CaseDetailShell>{children}</CaseDetailShell>
    </CaseDetailProvider>
  );
}
