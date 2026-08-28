"use client";

import { ValidationQueuePanel } from "@/components/validation-queue-panel";

export default function JuridiqueDemandesPage() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
          Demandes juridiques
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--sf-green)]/65">
          Vous intervenez en <strong>dernière étape</strong> du circuit dossier, après le chargé
          du dossier, la direction et le comité charaïque. Chaque demande doit comporter une
          observation juridique avant approbation ou rejet.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-xs text-[var(--sf-green)]/55">
          <li>Contrôle de la conformité réglementaire et contractuelle</li>
          <li>Vérification des mandats, clauses et pièces justificatives</li>
          <li>Traçabilité des avis dans la chronologie du dossier</li>
        </ul>
      </div>
      <ValidationQueuePanel
        validationTypeFilter="LEGAL"
        title="Vos demandes en attente"
        description="Demandes LEGAL dont l'étape courante vous est assignée."
        showActions
      />
    </div>
  );
}
