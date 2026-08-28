"use client";

import { ValidationInboxList } from "@/components/validations/validation-inbox-list";

export default function JuridiqueCircuitsPage() {
  return (
    <ValidationInboxList
      scope="DOSSIERS"
      title="Vos circuits dossier"
      description="Uniquement les validations où l'étape juridique & conformité vous attend (dernière étape après le comité charaïque). Validez, rejetez ou renvoyez avec motif."
    />
  );
}
