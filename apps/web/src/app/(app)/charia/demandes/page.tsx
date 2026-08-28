"use client";

import { ValidationQueuePanel } from "@/components/validation-queue-panel";

export default function ChariaDemandesPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
          Demandes charaïques
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--sf-green)]/65">
          Le comité intervient <strong>après le chargé du dossier et la direction</strong>,
          et avant la validation juridique. Votre avis confirme la conformité aux
          principes de la finance islamique et aux règles internes du comité.
        </p>
      </div>
      <ValidationQueuePanel
        validationTypeFilter="CHARIA"
        title="Vos demandes en attente"
        description="Demandes CHARIA dont l'étape courante vous est assignée."
        showActions
      />
    </div>
  );
}
