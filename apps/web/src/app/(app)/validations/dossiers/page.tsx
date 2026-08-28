"use client";

import { ValidationInboxList } from "@/components/validations/validation-inbox-list";

export default function ValidationsDossiersPage() {
  return (
    <ValidationInboxList
      scope="DOSSIERS"
      title="Dossiers"
      description="Circuits de validation dossier (chargé → direction → charaïque → juridique). Validez ou rejetez avec motif ; les dossiers et pôles restent visibles."
    />
  );
}
