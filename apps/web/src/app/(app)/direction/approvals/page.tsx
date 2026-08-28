"use client";

import { PendingReportsPanel } from "@/components/pending-reports-panel";
import { ValidationQueuePanel } from "@/components/validation-queue-panel";

export default function DirectionApprovalsPage() {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[var(--sf-green-deep)]">
          Validations direction
        </h2>
        <ValidationQueuePanel validationTypeFilter="MANAGEMENT" />
      </section>
      <section>
        <h2 className="mb-4 text-lg font-semibold text-[var(--sf-green-deep)]">
          Rapports à approuver
        </h2>
        <PendingReportsPanel />
      </section>
    </div>
  );
}
