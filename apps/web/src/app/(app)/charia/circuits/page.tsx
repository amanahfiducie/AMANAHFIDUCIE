"use client";

import { ValidationInboxList } from "@/components/validations/validation-inbox-list";

export default function ChariaCircuitsPage() {
  return (
    <ValidationInboxList
      scope="DOSSIERS"
      title="Vos circuits dossier"
      description="Uniquement les validations où l'étape comité charaïque vous attend. Validez, rejetez ou renvoyez avec motif."
    />
  );
}
