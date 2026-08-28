"use client";

import { useCallback, useEffect, useState } from "react";

import { GenealogyTree } from "@/components/succession/genealogy-tree";
import { HeirDecisionModal } from "@/components/succession/heir-decision-modal";
import { ErrorAlert } from "@/components/ui/error-alert";
import { useFaraidReviewContext } from "@/providers/faraid-review-provider";
import type { Beneficiary, FaraidHeirDecision, FaraidHeirDecisionStatus } from "@/types/api";

type Props = {
  caseId: string;
  deceasedGender?: "M" | "F";
  heirReviewMode?: boolean;
  reviewReadOnly?: boolean;
  autoSync?: boolean;
  onReviewUpdated?: () => void;
} & Omit<
  React.ComponentProps<typeof GenealogyTree>,
  | "heirDecisionByNodeId"
  | "heirReviewMode"
  | "decisionsByBeneficiaryId"
  | "onHeirReviewDetail"
  | "highlightIds"
  | "excludedIds"
  | "caseId"
>;

function ValidationSummary({
  accepted,
  rejected,
  pending,
}: {
  accepted: number;
  rejected: number;
  pending: number;
}) {
  if (accepted + rejected + pending === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap gap-2 text-xs font-semibold">
      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-900">
        {accepted} retenu{accepted > 1 ? "s" : ""}
      </span>
      <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-900">
        {rejected} exclu{rejected > 1 ? "s" : ""}
      </span>
      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
        {pending} en attente
      </span>
    </div>
  );
}

export function GenealogyTreeWithDecisions({
  caseId,
  heirReviewMode = false,
  reviewReadOnly = false,
  autoSync = true,
  onReviewUpdated,
  deceasedGender,
  familyMembers,
  ...treeProps
}: Props) {
  const ctx = useFaraidReviewContext();
  const [modalMember, setModalMember] = useState<Beneficiary | null>(null);
  const [modalDecision, setModalDecision] = useState<FaraidHeirDecision | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const review = ctx?.review ?? null;
  const maps = ctx?.maps ?? {
    statusByNodeId: new Map(),
    byBeneficiaryId: new Map(),
    highlightIds: new Set<string>(),
    excludedIds: new Set<string>(),
  };
  const reviewLocked = review?.status === "FINALIZED";
  const decisions = review?.heir_decisions ?? [];

  const syncFromGenealogy = useCallback(async () => {
    if (!ctx) return;
    await ctx.syncFromGenealogy(deceasedGender === "F" ? "F" : "M");
    onReviewUpdated?.();
  }, [ctx, deceasedGender, onReviewUpdated]);

  useEffect(() => {
    if (!autoSync || !ctx || !review) return;
    if (familyMembers.length > 0 && decisions.length === 0) {
      void syncFromGenealogy().catch(() => undefined);
    }
  }, [autoSync, ctx, review, decisions.length, familyMembers.length, syncFromGenealogy]);

  function openHeirReview(member: Beneficiary, decision: FaraidHeirDecision | null) {
    setModalMember(member);
    setModalDecision(decision);
    setModalError(null);
  }

  async function saveDecision(status: FaraidHeirDecisionStatus, rejectionJustification: string) {
    if (!modalMember || !ctx) return;
    setModalBusy(true);
    setModalError(null);
    try {
      let decisionId = modalDecision?.id;
      if (!decisionId) {
        await syncFromGenealogy();
        const found = ctx.review?.heir_decisions.find((d) => d.beneficiary === modalMember.id);
        decisionId = found?.id;
      }
      if (!decisionId) {
        throw new Error("Impossible de créer la fiche de décision pour cette personne.");
      }
      await ctx.updateDecision(decisionId, {
        status,
        rejection_justification: status === "REJECTED" ? rejectionJustification : "",
      });
      onReviewUpdated?.();
      setModalMember(null);
      setModalDecision(null);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setModalBusy(false);
    }
  }

  const canReview = heirReviewMode && !reviewReadOnly && !reviewLocked;
  const showReviewUi = heirReviewMode || reviewReadOnly;

  const acceptedCount = decisions.filter((d) => d.status === "ACCEPTED").length;
  const rejectedCount = decisions.filter((d) => d.status === "REJECTED").length;
  const pendingCount = decisions.filter((d) => d.status === "PENDING").length;

  if (!ctx && heirReviewMode) {
    return (
      <ErrorAlert message="Contexte de revue farāʾiḍ indisponible pour ce dossier." />
    );
  }

  return (
    <>
      {ctx?.error ? <ErrorAlert message={ctx.error} /> : null}

      <ValidationSummary
        accepted={acceptedCount}
        rejected={rejectedCount}
        pending={pendingCount}
      />

      {canReview ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--sf-green)]/60">
            Tampon vert = retenu · Tampon rouge = exclu · Cliquez Détail pour statuer
          </p>
          <button
            type="button"
            className="sf-btn-secondary text-xs"
            disabled={ctx?.syncing}
            onClick={() => void syncFromGenealogy()}
          >
            {ctx?.syncing ? "Synchronisation…" : "Actualiser depuis l'arbre"}
          </button>
        </div>
      ) : null}

      <GenealogyTree
        {...treeProps}
        familyMembers={familyMembers}
        deceasedGender={deceasedGender}
        highlightIds={maps.highlightIds}
        excludedIds={maps.excludedIds}
        heirDecisionByNodeId={maps.statusByNodeId}
        heirReviewMode={showReviewUi}
        decisionsByBeneficiaryId={maps.byBeneficiaryId}
        onHeirReviewDetail={showReviewUi ? openHeirReview : undefined}
      />

      <HeirDecisionModal
        open={modalMember != null}
        member={modalMember}
        decision={modalDecision}
        readOnly={!canReview}
        busy={modalBusy}
        error={modalError}
        onClose={() => {
          if (!modalBusy) {
            setModalMember(null);
            setModalDecision(null);
            setModalError(null);
          }
        }}
        onSave={saveDecision}
      />
    </>
  );
}
