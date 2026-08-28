"use client";

import { useEffect, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, apiRequest } from "@/lib/api";
import { FARAID_DECISION_STATUS_LABELS } from "@/lib/faraid/review-labels";
import type { Beneficiary, FaraidHeirDecision, FaraidHeirDecisionStatus } from "@/types/api";

type Props = {
  open: boolean;
  member: Beneficiary | null;
  decision: FaraidHeirDecision | null;
  readOnly?: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (
    status: FaraidHeirDecisionStatus,
    rejectionJustification: string,
  ) => void | Promise<void>;
};

export function HeirDecisionModal({
  open,
  member,
  decision,
  readOnly = false,
  busy = false,
  error: externalError = null,
  onClose,
  onSave,
}: Props) {
  const [status, setStatus] = useState<FaraidHeirDecisionStatus>("PENDING");
  const [justification, setJustification] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !decision) return;
    setStatus(decision.status);
    setJustification(decision.rejection_justification ?? "");
    setLocalError(null);
  }, [open, decision]);

  if (!open || !member) return null;

  const error = externalError ?? localError;

  const relation =
    member.relation_to_donor_label || member.relation_to_donor || "Membre de la famille";

  async function handleSubmit(nextStatus: FaraidHeirDecisionStatus) {
    if (nextStatus === "REJECTED" && !justification.trim()) {
      setLocalError("Indiquez un motif de refus.");
      return;
    }
    setLocalError(null);
    await onSave(nextStatus, justification.trim());
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="heir-decision-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--sf-cream-dark)] px-5 py-4">
          <div>
            <h2 id="heir-decision-title" className="text-lg font-semibold text-[var(--sf-green-deep)]">
              {member.first_name} {member.last_name}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--sf-green)]/60">{relation}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Fermer
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? <ErrorAlert message={error} /> : null}

          {readOnly ? (
            <div className="rounded-lg bg-[var(--sf-cream)]/50 px-4 py-3 text-sm">
              <p className="font-semibold text-[var(--sf-green-deep)]">
                {FARAID_DECISION_STATUS_LABELS[decision?.status ?? "PENDING"]}
              </p>
              {decision?.status === "REJECTED" && decision.rejection_justification ? (
                <p className="mt-2 whitespace-pre-wrap text-[var(--sf-green)]/70">
                  Motif : {decision.rejection_justification}
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--sf-green)]/65">
                Validez cette personne comme héritier retenu, ou refusez-la avec une justification
                écrite obligatoire.
              </p>

              <label className="block text-sm">
                <span className="font-medium text-[var(--sf-green-deep)]">
                  Motif de refus (obligatoire si exclusion)
                </span>
                <textarea
                  className="sf-input mt-1 min-h-[88px]"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Ex. : non éligible au farāʾiḍ, décès antérieur, lien non établi…"
                  disabled={busy}
                />
              </label>

              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="sf-btn-secondary text-sm"
                  disabled={busy}
                  onClick={() => void handleSubmit("REJECTED")}
                >
                  Refuser
                </button>
                <button
                  type="button"
                  className="sf-btn-primary text-sm"
                  disabled={busy}
                  onClick={() => void handleSubmit("ACCEPTED")}
                >
                  Valider comme héritier
                </button>
              </div>

              {status !== "PENDING" ? (
                <p className="text-xs text-[var(--sf-green)]/50">
                  Statut actuel : {FARAID_DECISION_STATUS_LABELS[status]}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
