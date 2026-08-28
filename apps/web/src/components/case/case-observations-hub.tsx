"use client";

import { CaseObservationsPanel } from "@/components/case/case-observations-panel";

/** Observations pour portails externes (juge, notaire, famille). */
export function PortalCaseObservations({ caseId }: { caseId: string }) {
  return <CaseObservationsPanel kind="SUBMISSION" caseId={caseId} compact />;
}

/** @deprecated Utiliser CaseObservationsPanel ou PortalCaseObservations */
export function CaseObservationsHub({ caseId }: { caseId?: string }) {
  return <CaseObservationsPanel kind="SUBMISSION" caseId={caseId} compact />;
}
