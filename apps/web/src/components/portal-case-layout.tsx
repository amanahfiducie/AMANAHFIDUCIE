"use client";

import Link from "next/link";
import { use } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import type { PortalKind } from "@/lib/portal-api";
import { CaseDetailProvider, useCaseDetail } from "@/providers/case-detail-provider";
import { FaraidReviewProvider } from "@/providers/faraid-review-provider";

function PortalCaseShell({
  kind,
  children,
}: {
  kind: PortalKind;
  children: React.ReactNode;
}) {
  const { loading, error, data, caseId } = useCaseDetail();
  const listHref =
    kind === "portal"
      ? "/portal/dossiers"
      : kind === "notaire"
        ? "/notaire/dossiers"
        : "/juge/dossiers";

  if (loading) return <LoadingState label="Chargement du dossier…" />;
  if (error) return <ErrorAlert message={error} />;
  if (!data) return <ErrorAlert message="Dossier introuvable." />;

  const body = (
    <div>
      <div className="mb-4">
        <Link
          href={listHref}
          className="text-sm text-[var(--sf-green-mid)] hover:underline"
        >
          ← Tous mes dossiers
        </Link>
      </div>
      {children}
    </div>
  );

  if (data.case_type === "SUCCESSION") {
    return (
      <FaraidReviewProvider caseId={caseId} enabled>
        {body}
      </FaraidReviewProvider>
    );
  }

  return body;
}

export function PortalCaseLayoutFromParams({
  kind,
  params,
  children,
}: {
  kind: PortalKind;
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const { id } = use(params);
  const home =
    kind === "portal" ? "/portal" : kind === "notaire" ? "/notaire" : "/juge";

  return (
    <CaseDetailProvider caseId={id} navBase={`${home}/dossiers/${id}`}>
      <PortalCaseShell kind={kind}>{children}</PortalCaseShell>
    </CaseDetailProvider>
  );
}
