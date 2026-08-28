"use client";

import { Suspense, use } from "react";
import { useSearchParams } from "next/navigation";

import { CaseAccessGuard } from "@/components/access/case-access-guard";
import { CaseOnboardingWizard } from "@/components/case-onboarding/case-onboarding-wizard";
import { LoadingState } from "@/components/ui/loading";
import { usePlatformPermissions } from "@/hooks/use-platform-permissions";
import { caseIsLocked } from "@/lib/role-access";
import { useCaseDetail } from "@/providers/case-detail-provider";

function EnregistrementContent({ caseId }: { caseId: number }) {
  const searchParams = useSearchParams();
  const step = searchParams.get("step") ?? undefined;
  const { canWriteCase } = usePlatformPermissions();
  const { data } = useCaseDetail();
  const locked = caseIsLocked(data?.status);
  const readOnly = !canWriteCase || locked;

  return (
    <CaseAccessGuard
      canAccess={canWriteCase || locked}
      redirect={!locked}
      backHref={`/dossiers/${caseId}`}
      backLabel="← Retour au dossier"
      message={
        locked
          ? "Ce dossier est clôturé : consultation seule."
          : "Votre rôle ne permet pas de modifier l'enregistrement de ce dossier."
      }
    >
      {locked ? (
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Dossier clôturé — l&apos;enregistrement est en lecture seule.
        </div>
      ) : null}
      <CaseOnboardingWizard
        initialCaseId={caseId}
        resumeStep={step}
        readOnly={readOnly}
      />
    </CaseAccessGuard>
  );
}

export default function CaseEnregistrementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<LoadingState label="Chargement de la procédure…" />}>
      <EnregistrementContent caseId={Number(id)} />
    </Suspense>
  );
}
