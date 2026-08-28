"use client";

import { EnterpriseMovementsWorkspace } from "@/components/comptable/enterprise-movements-workspace";

export default function ComptableRecettesPage() {
  return (
    <EnterpriseMovementsWorkspace
      title="Recettes"
      movementTypes={["INCOME"]}
      defaultMovementType="INCOME"
      categoryScope="REVENUE"
      invoiceLinkedRevenue
    />
  );
}
