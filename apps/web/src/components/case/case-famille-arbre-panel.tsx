"use client";

import { useMemo } from "react";

import { GenealogyTreeWithDecisions } from "@/components/succession/genealogy-tree-with-decisions";
import { HeirShareTreePanel } from "@/components/succession/heir-share-tree-panel";
import { LoadingState } from "@/components/ui/loading";
import { inferDeceasedGenderFromFamily } from "@/lib/succession/family-relations";
import { useFaraidReviewContext } from "@/providers/faraid-review-provider";
import { useCaseDetail } from "@/providers/case-detail-provider";

export function CaseFamilleArbrePanel() {
  const { data, caseId } = useCaseDetail();
  const ctx = useFaraidReviewContext();

  const deceasedName = useMemo(() => {
    const d = data?.donors?.[0];
    if (!d) return "Le défunt";
    return [d.first_name, d.last_name].filter(Boolean).join(" ") || "Le défunt";
  }, [data?.donors]);

  const familyMembers = useMemo(
    () => data?.beneficiaries ?? [],
    [data?.beneficiaries],
  );

  const deceasedGender = useMemo(
    () => inferDeceasedGenderFromFamily(familyMembers),
    [familyMembers],
  );

  const isFinalized = ctx?.review?.status === "FINALIZED";
  const currency =
    ctx?.review?.currency ??
    data?.assets?.[0]?.currency ??
    "XOF";

  if (!data || !caseId) return null;

  if (data.case_type === "SUCCESSION" && ctx?.loading) {
    return <LoadingState label="Chargement de l'arbre…" />;
  }

  if (data.case_type === "SUCCESSION" && isFinalized) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
            Arbre final du partage
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/60">
            Partage farāʾiḍ validé par le comité charaïque. Cliquez Détail sur un héritier pour
            voir sa part et les attributions.
          </p>
        </div>
        <HeirShareTreePanel
          deceasedName={deceasedName}
          familyMembers={familyMembers}
          deceasedGender={deceasedGender}
          assets={data.assets ?? []}
          currency={currency}
          title="Héritiers et parts"
          description="Pourcentages et montants affichés sous chaque nom."
          editable={false}
          variant="full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
          Arbre généalogique
        </h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          {data.case_type === "SUCCESSION"
            ? "Vue complète de la famille. Les tampons indiquent les décisions du comité charaïque."
            : "Vue d'ensemble des liens familiaux enregistrés pour ce dossier."}
        </p>
      </div>
      {data.case_type === "SUCCESSION" ? (
        <GenealogyTreeWithDecisions
          caseId={String(caseId)}
          deceasedName={deceasedName}
          familyMembers={familyMembers}
          deceasedGender={deceasedGender}
          variant="full"
          heirReviewMode
          reviewReadOnly
          autoSync
        />
      ) : (
        <GenealogyTreeWithDecisions
          caseId={String(caseId)}
          deceasedName={deceasedName}
          familyMembers={familyMembers}
          deceasedGender={deceasedGender}
          variant="full"
          autoSync={false}
        />
      )}
    </div>
  );
}
