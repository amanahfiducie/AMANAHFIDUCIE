"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GenealogyTreeWithDecisions } from "@/components/succession/genealogy-tree-with-decisions";
import { SuccessionAssetEvaluation } from "@/components/succession/succession-asset-evaluation";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import {
  computeNetEstate,
  defaultSuccessionState,
  parseSuccessionFromOnboarding,
  successionToOnboardingPatch,
} from "@/lib/faraid/succession-storage";
import type { SuccessionState } from "@/lib/faraid/types";
import { formatMoney } from "@/lib/labels";
import { userCanReviewFaraid } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useCaseDetail } from "@/providers/case-detail-provider";
import type { Asset, FaraidCommitteeReview } from "@/types/api";

export function SuccessionWorkspace({ caseId }: { caseId: string }) {
  const { data: caseDetail, reload } = useCaseDetail();
  const { user } = useAuth();
  const canReviewFaraid = userCanReviewFaraid(user);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [faraidReview, setFaraidReview] = useState<FaraidCommitteeReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SuccessionState>(defaultSuccessionState);
  const [estimatedGross, setEstimatedGross] = useState(0);
  const [estimationCurrency, setEstimationCurrency] = useState("XOF");
  const [allAssetsEstimated, setAllAssetsEstimated] = useState(false);

  const deceasedName = useMemo(() => {
    const d = caseDetail?.donors?.[0];
    if (!d) return "Le défunt";
    return [d.first_name, d.last_name].filter(Boolean).join(" ") || "Le défunt";
  }, [caseDetail?.donors]);

  const familyMembers = useMemo(
    () => caseDetail?.beneficiaries ?? [],
    [caseDetail?.beneficiaries],
  );

  const netEstate = useMemo(
    () => computeNetEstate(state, estimatedGross),
    [state, estimatedGross],
  );

  const loadAssets = useCallback(async () => {
    const list = await apiRequest<Asset[]>(`/cases/${caseId}/assets/`);
    setAssets(list);
  }, [caseId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAssets()])
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, [loadAssets]);

  useEffect(() => {
    const od = caseDetail?.onboarding?.onboarding_data;
    if (!od) return;
    setState(parseSuccessionFromOnboarding(od));
  }, [caseDetail?.onboarding?.onboarding_data]);

  async function persistState(next: SuccessionState) {
    setSaving(true);
    setError(null);
    try {
      const prior = (caseDetail?.onboarding?.onboarding_data ?? {}) as Record<string, unknown>;
      await apiRequest(`/cases/${caseId}/`, {
        method: "PATCH",
        body: JSON.stringify({
          onboarding_data: { ...prior, ...successionToOnboardingPatch(next) },
        }),
      });
      setState(next);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    apiRequest<FaraidCommitteeReview>(`/cases/${caseId}/faraid-review/`)
      .then(setFaraidReview)
      .catch(() => setFaraidReview(null));
  }, [caseId, caseDetail?.updated_at]);

  async function submitToChariaCommittee() {
    setSaving(true);
    setError(null);
    try {
      const review = await apiRequest<FaraidCommitteeReview>(
        `/cases/${caseId}/faraid-review/request/`,
        { method: "POST" },
      );
      setFaraidReview(review);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Soumission impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !caseDetail) return <LoadingState label="Chargement de la succession…" />;

  const phase = state.activePhase;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[var(--sf-green)]/15 bg-gradient-to-br from-[var(--sf-green-deep)] to-[var(--sf-green)] p-6 text-white sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--sf-gold-soft)] uppercase">
          Conseil successoral islamique — modification
        </p>
        <h1 className="sf-display mt-2 text-2xl font-semibold sm:text-3xl">
          Évaluation du patrimoine, puis revue charaïque
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80">
          Mode écriture : estimez chaque actif avec justificatif PDF, renseignez dettes et
          charges, puis soumettez au comité charaïque.
        </p>
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: "evaluation" as const, label: "1. Évaluation du patrimoine" },
            { id: "partage" as const, label: "2. Partage farāʾiḍ (comité)" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => void persistState({ ...state, activePhase: tab.id })}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              phase === tab.id
                ? "bg-[var(--sf-gold)] text-[var(--sf-green-deep)] shadow-md"
                : "border border-[var(--sf-cream-dark)] bg-white text-[var(--sf-green)] hover:bg-[var(--sf-cream)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {phase === "evaluation" ? (
        <section className="space-y-8">
          <SuccessionAssetEvaluation
            caseId={caseId}
            assets={assets}
            onAssetsChanged={async () => {
              await loadAssets();
              await reload();
            }}
            onTotalsChange={({ gross, currency, allEstimated }) => {
              setEstimatedGross(gross);
              setEstimationCurrency(currency);
              setAllAssetsEstimated(allEstimated);
            }}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
              <h2 className="font-semibold text-[var(--sf-green-deep)]">
                Dettes et charges à déduire
              </h2>
              <p className="mt-1 text-sm text-[var(--sf-green)]/60">
                Après la somme des estimations validées (
                {formatMoney(String(estimatedGross), estimationCurrency)}).
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-[var(--sf-green-deep)]">Dettes</span>
                  <input
                    className="sf-input mt-1"
                    value={state.debts}
                    onChange={(e) => setState({ ...state, debts: e.target.value })}
                  />
                </label>
                <label className="block text-sm sm:col-span-2">
                  <span className="font-medium text-[var(--sf-green-deep)]">
                    Frais funéraires & charges successorales
                  </span>
                  <input
                    className="sf-input mt-1"
                    value={state.funeralExpenses}
                    onChange={(e) => setState({ ...state, funeralExpenses: e.target.value })}
                  />
                </label>
              </div>
              <p className="mt-4 rounded-lg bg-[var(--sf-cream)] px-4 py-3 text-sm font-semibold text-[var(--sf-green-deep)]">
                Patrimoine net à partager :{" "}
                {formatMoney(String(netEstate), estimationCurrency)}
              </p>
              <button
                type="button"
                className="sf-btn-primary mt-4"
                disabled={saving}
                onClick={() => void persistState(state)}
              >
                Enregistrer dettes et charges
              </button>
            </div>

            <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
              <h2 className="font-semibold text-[var(--sf-green-deep)]">Le défunt</h2>
              <p className="mt-2 text-sm text-[var(--sf-green)]/65">{deceasedName}</p>
              <label className="mt-4 block text-sm">
                <span className="font-medium">Sexe du défunt (référence familiale)</span>
                <select
                  className="sf-input mt-1"
                  value={state.deceasedGender}
                  onChange={(e) =>
                    setState({
                      ...state,
                      deceasedGender: e.target.value === "F" ? "F" : "M",
                    })
                  }
                >
                  <option value="M">Homme</option>
                  <option value="F">Femme</option>
                </select>
              </label>
            </div>
          </div>

          <button
            type="button"
            className="sf-btn-gold"
            disabled={saving || !allAssetsEstimated || netEstate <= 0}
            onClick={() => void persistState({ ...state, activePhase: "partage" })}
          >
            Passer à la soumission au comité →
          </button>
          {!allAssetsEstimated ? (
            <p className="text-sm text-[var(--sf-green)]/55">
              Chaque bien doit être estimé avec son justificatif PDF avant la soumission.
            </p>
          ) : null}
        </section>
      ) : (
        <section className="space-y-8">
          {canReviewFaraid ? (
            <div className="rounded-xl border border-[var(--sf-gold)]/40 bg-[var(--sf-cream)]/50 px-5 py-4">
              <p className="text-sm text-[var(--sf-green-deep)]">
                En tant que membre du comité charaïque, attribuez les parts manuellement dans
                l&apos;espace dédié.
              </p>
              <Link
                href={`/charia/dossiers/${caseId}/partage`}
                className="sf-btn-gold mt-3 inline-flex"
              >
                Ouvrir la revue farāʾiḍ →
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-6">
              <h2 className="font-semibold text-[var(--sf-green-deep)]">
                Partage farāʾiḍ — réservé au comité charaïque
              </h2>
              <p className="mt-2 text-sm text-[var(--sf-green)]/65">
                Les parts successorales sont fixées manuellement par le comité (pas de calcul
                automatique). Soumettez le dossier une fois l&apos;évaluation patrimoniale
                terminée.
              </p>
              <p className="mt-3 text-sm font-semibold text-[var(--sf-green-deep)]">
                Patrimoine net transmis : {formatMoney(String(netEstate), estimationCurrency)}
              </p>
              {faraidReview?.status === "FINALIZED" ? (
                <p className="mt-4 rounded-lg bg-[var(--sf-green)]/8 px-4 py-3 text-sm font-medium text-[var(--sf-green-deep)]">
                  Partage finalisé par le comité charaïque
                  {faraidReview.finalized_at
                    ? ` le ${new Date(faraidReview.finalized_at).toLocaleDateString("fr-FR")}`
                    : ""}
                  .
                </p>
              ) : faraidReview?.requested_at ? (
                <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Dossier soumis au comité charaïque le{" "}
                  {new Date(faraidReview.requested_at).toLocaleDateString("fr-FR")}. Le comité
                  a été notifié et traitera le partage manuellement.
                </p>
              ) : (
                <button
                  type="button"
                  className="sf-btn-primary mt-4"
                  disabled={saving || !allAssetsEstimated || netEstate <= 0}
                  onClick={() => void submitToChariaCommittee()}
                >
                  Soumettre au comité charaïque
                </button>
              )}
            </div>
          )}

          <div>
            <h2 className="font-semibold text-[var(--sf-green-deep)]">
              Arbre généalogique de référence
            </h2>
            <p className="mt-1 text-sm text-[var(--sf-green)]/60">
              Consultez l&apos;arbre complet dans{" "}
              <Link
                href={`/dossiers/${caseId}/beneficiaires/arbre`}
                className="font-medium text-[var(--sf-green-mid)] hover:underline"
              >
                Famille → Arbre généalogique
              </Link>
              .
            </p>
            <div className="mt-4">
              <GenealogyTreeWithDecisions
                caseId={caseId}
                deceasedName={deceasedName}
                familyMembers={familyMembers}
                deceasedGender={state.deceasedGender}
                variant="preview"
                heirReviewMode
                reviewReadOnly={faraidReview?.status === "FINALIZED"}
              />
            </div>
          </div>

          <button
            type="button"
            className="sf-btn-secondary"
            disabled={saving}
            onClick={() => void persistState({ ...state, activePhase: "evaluation" })}
          >
            ← Retour à l&apos;évaluation
          </button>
        </section>
      )}
    </div>
  );
}
