"use client";

import { useMemo } from "react";

import { GenealogyTree } from "@/components/succession/genealogy-tree";
import {
  buildHeirDecisionMaps,
  buildShareSubtitleMap,
  filterAcceptedHeirs,
} from "@/lib/faraid/heir-decision-maps";
import type { Beneficiary, FaraidHeirDecision, ReportSnapshot } from "@/types/api";

type GenealogySnap = NonNullable<ReportSnapshot["genealogy"]>;

function toBeneficiary(m: GenealogySnap["family_members"][number]): Beneficiary {
  return {
    id: m.id,
    first_name: m.first_name,
    last_name: m.last_name,
    date_of_birth: m.date_of_birth,
    is_minor: m.is_minor,
    nationality: m.nationality || "",
    identification_number: m.identification_number,
    notes: m.notes,
    donor: m.donor,
    donor_name: m.donor_name,
    guardian: m.guardian,
    guardian_name: m.guardian_name,
    relation_to_donor: m.relation_to_donor,
    relation_to_donor_label: m.relation_to_donor_label,
    gender: (m.gender as "" | "M" | "F") || "",
    father: m.father,
    mother: m.mother,
    father_name: m.father_name,
    mother_name: m.mother_name,
    patrimony_share_percent: m.patrimony_share_percent,
  };
}

function toDecisions(rows: GenealogySnap["decisions"]): FaraidHeirDecision[] {
  return rows.map((d) => ({
    id: d.id,
    beneficiary: d.beneficiary,
    full_name: d.full_name,
    relationship_label: d.relationship_label,
    faraid_role: d.faraid_role,
    status: d.status as FaraidHeirDecision["status"],
    share_fraction: d.share_fraction,
    share_amount: d.share_amount,
    committee_notes: d.committee_notes,
    rejection_justification: d.rejection_justification,
    source: "FROM_GENEALOGY",
    created_at: "",
    updated_at: "",
  }));
}

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

function TreeSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">{description}</p>
      </div>
      {children}
    </div>
  );
}

/**
 * Arbres succession dans le rapport — même présentation que Famille → Arbre
 * (titres, légende, variant full, tampons comité).
 */
export function ReportSuccessionTrees({
  genealogy,
}: {
  genealogy: GenealogySnap;
}) {
  const familyMembers = useMemo(
    () => genealogy.family_members.map(toBeneficiary),
    [genealogy.family_members],
  );
  const decisions = useMemo(
    () => toDecisions(genealogy.decisions || []),
    [genealogy.decisions],
  );
  const maps = useMemo(() => buildHeirDecisionMaps(decisions), [decisions]);
  const shareSubtitles = useMemo(
    () => buildShareSubtitleMap(decisions, genealogy.currency || "XOF"),
    [decisions, genealogy.currency],
  );
  const acceptedMembers = useMemo(
    () => filterAcceptedHeirs(familyMembers, decisions),
    [familyMembers, decisions],
  );
  const acceptedIds = useMemo(
    () => new Set(acceptedMembers.map((m) => m.id)),
    [acceptedMembers],
  );

  const deceasedGender =
    genealogy.deceased_gender === "M" || genealogy.deceased_gender === "F"
      ? genealogy.deceased_gender
      : undefined;

  const trees = genealogy.trees || {
    base: true,
    with_decisions: false,
    final_share: false,
  };

  const acceptedCount = decisions.filter((d) => d.status === "ACCEPTED").length;
  const rejectedCount = decisions.filter((d) => d.status === "REJECTED").length;
  const pendingCount = decisions.filter((d) => d.status === "PENDING").length;

  if (familyMembers.length === 0) {
    return (
      <TreeSection
        title="Arbre généalogique"
        description="Famille du défunt"
      >
        <p className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 text-sm text-[var(--sf-green)]/45">
          Aucun membre enregistré dans l&apos;arbre familial.
        </p>
      </TreeSection>
    );
  }

  return (
    <div className="space-y-8">
      {/* Toujours dans le rapport de base succession */}
      <TreeSection
        title="Arbre généalogique"
        description={`Vue complète de la famille de ${genealogy.deceased_name}. ${genealogy.member_count} membre${genealogy.member_count > 1 ? "s" : ""} enregistré${genealogy.member_count > 1 ? "s" : ""}.`}
      >
        <GenealogyTree
          deceasedName={genealogy.deceased_name}
          familyMembers={familyMembers}
          deceasedGender={deceasedGender}
          variant="full"
        />
      </TreeSection>

      {trees.with_decisions ? (
        <TreeSection
          title="Arbre avec décisions du comité"
          description={
            genealogy.review_status_label
              ? `Revue farāʾiḍ : ${genealogy.review_status_label}. Les tampons indiquent les décisions du comité charaïque.`
              : "Vue complète de la famille. Les tampons indiquent les décisions du comité charaïque."
          }
        >
          <ValidationSummary
            accepted={acceptedCount}
            rejected={rejectedCount}
            pending={pendingCount}
          />
          <p className="mb-3 text-sm text-[var(--sf-green)]/60">
            Tampon vert = retenu · Tampon rouge = exclu
          </p>
          <GenealogyTree
            deceasedName={genealogy.deceased_name}
            familyMembers={familyMembers}
            deceasedGender={deceasedGender}
            heirReviewMode
            heirDecisionByNodeId={maps.statusByNodeId}
            decisionsByBeneficiaryId={maps.byBeneficiaryId}
            highlightIds={maps.highlightIds}
            excludedIds={maps.excludedIds}
            variant="full"
          />
        </TreeSection>
      ) : null}

      {trees.final_share ? (
        <TreeSection
          title="Arbre final du partage"
          description="Partage farāʾiḍ validé par le comité charaïque. Pourcentages et montants affichés sous chaque héritier retenu."
        >
          <GenealogyTree
            deceasedName={genealogy.deceased_name}
            familyMembers={acceptedMembers}
            deceasedGender={deceasedGender}
            visibleBeneficiaryIds={acceptedIds}
            subtitleOverrides={shareSubtitles}
            highlightIds={maps.highlightIds}
            variant="full"
          />
        </TreeSection>
      ) : null}
    </div>
  );
}
