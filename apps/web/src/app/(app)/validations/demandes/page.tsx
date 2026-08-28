"use client";

import { ValidationInboxList } from "@/components/validations/validation-inbox-list";

export default function ValidationsDemandesPage() {
  return (
    <ValidationInboxList
      scope="DEMANDES"
      title="Demandes"
      description="Demandes de validation métier (direction, juridique, charaïque, comptable…). Filtrez et recherchez par dossier."
      showTypeFilter
    />
  );
}
