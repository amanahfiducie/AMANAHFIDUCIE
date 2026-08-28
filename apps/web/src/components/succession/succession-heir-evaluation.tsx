"use client";

import Link from "next/link";
import { useMemo } from "react";

import { GenealogyTreeWithDecisions } from "@/components/succession/genealogy-tree-with-decisions";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { useSuccessionSession } from "@/hooks/use-succession-session";
import { inferDeceasedGenderFromFamily } from "@/lib/succession/family-relations";
import { ASSET_TYPE_LABELS, formatDate, formatMoney } from "@/lib/labels";

export function SuccessionHeirEvaluation({ caseId }: { caseId: string }) {
  const session = useSuccessionSession(caseId);

  const deceasedGender = useMemo(
    () =>
      session.state.deceasedGender === "F" || session.state.deceasedGender === "M"
        ? session.state.deceasedGender
        : inferDeceasedGenderFromFamily(session.familyMembers),
    [session.state.deceasedGender, session.familyMembers],
  );

  if (session.loading || !session.caseDetail) {
    return <LoadingState label="Chargement de l'évaluation…" />;
  }

  const {
    assets,
    statusMap,
    estimatedGross,
    estimationCurrency,
    estimatedCount,
    deceasedName,
    familyMembers,
    error,
  } = session;

  return (
    <div className="space-y-8">
      {error ? <ErrorAlert message={error} /> : null}

      <div>
        <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
          Évaluation des héritiers
        </h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Cliquez sur <strong>Détail</strong> sur chaque personne pour retenir ou exclure un
          héritier (justification obligatoire en cas de refus).
        </p>
      </div>

      {familyMembers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 px-4 py-8 text-center">
          <p className="text-sm text-[var(--sf-green)]/60">
            Aucun membre dans l&apos;arbre — complétez la famille d&apos;abord.
          </p>
          <Link
            href={`/dossiers/${caseId}/beneficiaires/arbre`}
            className="mt-3 inline-block text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Ouvrir Famille →
          </Link>
        </div>
      ) : (
        <GenealogyTreeWithDecisions
          caseId={caseId}
          deceasedName={deceasedName}
          familyMembers={familyMembers}
          deceasedGender={deceasedGender}
          variant="full"
          heirReviewMode
          autoSync
        />
      )}

      <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
        <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
          Patrimoine estimé (référence)
        </h3>
        <p className="mt-1 text-xs text-[var(--sf-green)]/55">
          {estimatedCount} / {assets.length} bien{assets.length > 1 ? "s" : ""} estimé
          {estimatedCount > 1 ? "s" : ""} · Total{" "}
          {formatMoney(String(estimatedGross), estimationCurrency)}
        </p>
        {assets.length > 0 ? (
          <ul className="mt-3 space-y-1.5">
            {assets.slice(0, 5).map((asset) => {
              const st = statusMap[asset.id];
              return (
                <li
                  key={asset.id}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--sf-green-deep)]"
                >
                  <span>{asset.label}</span>
                  <span className="text-[var(--sf-green)]/55">
                    {st?.estimated
                      ? formatMoney(st.amount ?? "0", asset.latest_currency ?? asset.currency)
                      : "Non estimé"}
                    {st?.eventDate ? ` · ${formatDate(st.eventDate)}` : ""}
                  </span>
                </li>
              );
            })}
            {assets.length > 5 ? (
              <li className="text-xs text-[var(--sf-green)]/45">
                + {assets.length - 5} autre{assets.length - 5 > 1 ? "s" : ""} bien
                {assets.length - 5 > 1 ? "s" : ""}
              </li>
            ) : null}
          </ul>
        ) : null}
        <Link
          href={`/dossiers/${caseId}/patrimoine`}
          className="mt-3 inline-block text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
        >
          Voir le patrimoine complet →
        </Link>
      </section>
    </div>
  );
}
