"use client";

import Link from "next/link";
import { useMemo } from "react";

import { HeirShareTreePanel } from "@/components/succession/heir-share-tree-panel";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { useSuccessionSession } from "@/hooks/use-succession-session";
import { formatMoney } from "@/lib/labels";
import { userIsComiteCharaique } from "@/lib/role-access";
import { useFaraidReviewContext } from "@/providers/faraid-review-provider";
import { useAuth } from "@/providers/auth-provider";

export function SuccessionPartagePanel({ caseId }: { caseId: string }) {
  const { user } = useAuth();
  const isComite = userIsComiteCharaique(user);
  const ctx = useFaraidReviewContext();
  const session = useSuccessionSession(caseId);

  const acceptedCount = useMemo(
    () => (ctx?.review?.heir_decisions ?? []).filter((d) => d.status === "ACCEPTED").length,
    [ctx?.review?.heir_decisions],
  );

  if (session.loading || !session.caseDetail) {
    return <LoadingState label="Chargement du partage…" />;
  }

  const {
    deceasedName,
    familyMembers,
    state,
    netEstate,
    estimationCurrency,
    assets,
    faraidReview,
    error,
  } = session;

  const isFinalized = faraidReview?.status === "FINALIZED";
  const canEdit = isComite && !isFinalized;

  async function handleFinalize() {
    if (!ctx) return;
    if (
      !window.confirm(
        "Finaliser le partage ? L'arbre final sera publié pour tous les utilisateurs du dossier.",
      )
    ) {
      return;
    }
    try {
      await ctx.finalizeReview();
    } catch {
      /* error shown via ctx */
    }
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      <div>
        <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
          {isFinalized ? "Arbre final du partage" : "Partage farāʾiḍ"}
        </h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          {isFinalized
            ? "Partage validé par le comité charaïque — visible par tous les utilisateurs du dossier."
            : canEdit
              ? "Seuls les héritiers validés apparaissent. Cliquez Détail pour attribuer parts, biens et actions."
              : "Répartition en cours par le comité charaïque."}
        </p>
      </div>

      <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
        <p className="text-sm font-semibold text-[var(--sf-green-deep)]">
          Patrimoine net transmis : {formatMoney(String(netEstate), estimationCurrency)}
        </p>
        <p className="mt-1 text-xs text-[var(--sf-green)]/55">
          {acceptedCount} héritier{acceptedCount > 1 ? "s" : ""} retenu
          {acceptedCount > 1 ? "s" : ""}
        </p>
        {isFinalized && faraidReview?.finalized_at ? (
          <p className="mt-3 rounded-lg bg-[var(--sf-green)]/8 px-4 py-3 text-sm text-[var(--sf-green-deep)]">
            Finalisé le {new Date(faraidReview.finalized_at).toLocaleDateString("fr-FR")}
          </p>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            className="sf-btn-gold mt-4 text-sm"
            disabled={ctx?.saving || acceptedCount === 0}
            onClick={() => void handleFinalize()}
          >
            {ctx?.saving ? "Finalisation…" : "Terminer et publier l'arbre final"}
          </button>
        ) : null}
      </section>

      <HeirShareTreePanel
        deceasedName={deceasedName}
        familyMembers={familyMembers}
        deceasedGender={state.deceasedGender}
        assets={assets}
        currency={estimationCurrency}
        title={isFinalized ? "Arbre final" : "Héritiers retenus"}
        description={
          isFinalized
            ? "Parts et attributions définitives — cliquez Détail pour voir le détail de chaque héritier."
            : "Attribuez à chaque héritier sa part (%), le montant et les biens ou actions particulières."
        }
        editable={canEdit}
        variant="full"
      />

      {!isComite && !isFinalized ? (
        <p className="text-center text-xs text-[var(--sf-green)]/50">
          Seul le comité charaïque peut modifier le partage. L&apos;arbre final sera visible ici
          après finalisation.
        </p>
      ) : null}

      {isComite && !isFinalized ? (
        <p className="text-center text-[11px] text-[var(--sf-green)]/40">
          <Link
            href={`/dossiers/${caseId}/succession/evaluation`}
            className="font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            ← Retour à l&apos;évaluation des héritiers
          </Link>
        </p>
      ) : null}
    </div>
  );
}
