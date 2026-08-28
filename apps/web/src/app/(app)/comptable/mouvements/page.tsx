"use client";

import { EnterpriseMovementsWorkspace } from "@/components/comptable/enterprise-movements-workspace";

export default function ComptableJournalPage() {
  return (
    <EnterpriseMovementsWorkspace
      title="Journal général"
      movementTypes={[
        "INCOME",
        "EXPENSE",
        "MANAGEMENT_FEE",
        "PERFORMANCE_FEE",
        "TRANSFER",
        "ADJUSTMENT",
      ]}
      defaultMovementType="INCOME"
    />
  );
}
