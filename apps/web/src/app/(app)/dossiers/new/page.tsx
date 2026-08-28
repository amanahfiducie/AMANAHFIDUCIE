"use client";

import { CaseAccessGuard } from "@/components/access/case-access-guard";
import { CaseOnboardingWizard } from "@/components/case-onboarding/case-onboarding-wizard";
import { usePlatformPermissions } from "@/hooks/use-platform-permissions";

export default function NewDossierPage() {
  const { canCreateCase } = usePlatformPermissions();

  return (
    <CaseAccessGuard
      canAccess={canCreateCase}
      backHref="/dossiers"
      backLabel="← Retour aux dossiers"
      message="Votre rôle ne permet pas de créer un nouveau dossier fiduciaire."
    >
      <CaseOnboardingWizard />
    </CaseAccessGuard>
  );
}
