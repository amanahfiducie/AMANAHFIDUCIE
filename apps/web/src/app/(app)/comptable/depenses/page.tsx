"use client";

import { EnterpriseMovementsWorkspace } from "@/components/comptable/enterprise-movements-workspace";

export default function ComptableDepensesPage() {
  return (
    <EnterpriseMovementsWorkspace
      title="Dépenses"
      movementTypes={["EXPENSE"]}
      defaultMovementType="EXPENSE"
      categoryScope="EXPENSE"
    />
  );
}
