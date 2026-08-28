"use client";

import { PersonIdentityUploads } from "@/components/case-onboarding/person-identity-uploads";
import type { CaseDocumentItem } from "@/lib/case-onboarding";

export function DonorIdentityUploads({
  caseId,
  donorId,
  firstName,
  lastName,
  documents,
  onUploaded,
  disabled,
}: {
  caseId: number | null;
  donorId?: number | null;
  firstName: string;
  lastName: string;
  documents: CaseDocumentItem[];
  onUploaded: () => void;
  disabled?: boolean;
}) {
  return (
    <PersonIdentityUploads
      caseId={caseId}
      subject="donor"
      entityId={donorId}
      firstName={firstName}
      lastName={lastName}
      documents={documents}
      onUploaded={onUploaded}
      disabled={disabled}
      title="Pièces d'identité"
      description="PDF uniquement. Chaque fichier est renommé automatiquement (ex. CNI_Amadou_DIOP.pdf)."
    />
  );
}
