"use client";

import { useMemo, useState } from "react";

import { GenealogyTree } from "@/components/succession/genealogy-tree";
import {
    HeirShareModal,
    type HeirShareFormState
} from "@/components/succession/heir-share-modal";
import { ErrorAlert } from "@/components/ui/error-alert";
import {
    buildShareSubtitleMap,
    filterAcceptedHeirs,
} from "@/lib/faraid/heir-decision-maps";
import { useFaraidReviewContext } from "@/providers/faraid-review-provider";
import type { Asset, Beneficiary } from "@/types/api";

type Props = {
  deceasedName: string;
  familyMembers: Beneficiary[];
  deceasedGender?: "M" | "F";
  assets: Asset[];
  currency?: string;
  title: string;
  description: string;
  /** Comité peut modifier parts et actions. */
  editable?: boolean;
  variant?: "preview" | "full";
  previewHeightClass?: string;
};

export function HeirShareTreePanel({
  deceasedName,
  familyMembers,
  deceasedGender,
  assets,
  currency = "XOF",
  title,
  description,
  editable = false,
  variant = "full",
  previewHeightClass,
}: Props) {
  const ctx = useFaraidReviewContext();
  const [modalMember, setModalMember] = useState<Beneficiary | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  const review = ctx?.review;
  const decisions = review?.heir_decisions ?? [];
  const acceptedMembers = useMemo(
    () => filterAcceptedHeirs(familyMembers, decisions),
    [familyMembers, decisions],
  );
  const visibleIds = useMemo(
    () => new Set(acceptedMembers.map((m) => m.id)),
    [acceptedMembers],
  );
  const shareSubtitles = useMemo(
    () => buildShareSubtitleMap(decisions, currency),
    [decisions, currency],
  );
  const decisionByBeneficiary = ctx?.maps.byBeneficiaryId ?? new Map();

  const modalDecision =
    modalMember != null ? decisionByBeneficiary.get(modalMember.id) ?? null : null;
  const readOnly = !editable || review?.status === "FINALIZED";

  async function saveShare(form: HeirShareFormState) {
    if (!ctx || !modalMember || !modalDecision) return;
    setModalError(null);
    try {
      const pct = form.share_percent.trim();
      const share_fraction =
        pct !== "" && !Number.isNaN(Number(pct)) ? String(Number(pct) / 100) : null;
      await ctx.updateDecision(modalDecision.id, {
        share_fraction,
        share_amount: form.share_amount.trim() || null,
        committee_notes: form.committee_notes.trim(),
      });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Enregistrement impossible.");
      throw err;
    }
  }

  async function addAction(form: HeirShareFormState) {
    if (!ctx || !modalMember || !form.action_title.trim()) return;
    setModalError(null);
    try {
      await ctx.createAction({
        action_type: form.action_type,
        title: form.action_title.trim(),
        description: form.action_description.trim(),
        beneficiary: modalMember.id,
        asset: form.action_asset_id ? Number(form.action_asset_id) : null,
        amount: form.action_amount.trim() || null,
        currency,
      });
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Action impossible.");
      throw err;
    }
  }

  async function deleteAction(actionId: number) {
    if (!ctx) return;
    if (!window.confirm("Supprimer cette action ?")) return;
    await ctx.deleteAction(actionId);
  }

  if (!ctx) {
    return <ErrorAlert message="Revue farāʾiḍ indisponible pour ce dossier." />;
  }

  if (acceptedMembers.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 px-4 py-8 text-center">
        <p className="text-sm font-medium text-[var(--sf-green-deep)]">{title}</p>
        <p className="mt-2 text-sm text-[var(--sf-green)]/60">
          Aucun héritier validé pour le moment. Retenez des personnes dans l&apos;onglet
          Évaluation.
        </p>
      </div>
    );
  }

  return (
    <>
      {ctx.error ? <ErrorAlert message={ctx.error} /> : null}

      <div>
        <h3 className="font-semibold text-[var(--sf-green-deep)]">{title}</h3>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">{description}</p>
      </div>

      <GenealogyTree
        deceasedName={deceasedName}
        familyMembers={familyMembers}
        deceasedGender={deceasedGender}
        variant={variant}
        previewHeightClass={previewHeightClass}
        visibleBeneficiaryIds={visibleIds}
        subtitleOverrides={shareSubtitles}
        heirDecisionByNodeId={ctx.maps.statusByNodeId}
        highlightIds={ctx.maps.highlightIds}
        decisionsByBeneficiaryId={decisionByBeneficiary}
        heirReviewMode
        onHeirReviewDetail={(member, decision) => {
          if (decision?.status !== "ACCEPTED") return;
          setModalMember(member);
          setModalError(null);
        }}
      />

      <HeirShareModal
        open={modalMember != null && modalDecision != null}
        member={modalMember}
        decision={modalDecision}
        actions={review?.settlement_actions ?? []}
        assets={assets}
        currency={currency}
        readOnly={readOnly}
        busy={ctx.saving}
        error={modalError}
        onClose={() => {
          if (!ctx.saving) {
            setModalMember(null);
            setModalError(null);
          }
        }}
        onSaveShare={async (form) => {
          await saveShare(form);
        }}
        onAddAction={readOnly ? undefined : addAction}
        onDeleteAction={readOnly ? undefined : deleteAction}
      />
    </>
  );
}
