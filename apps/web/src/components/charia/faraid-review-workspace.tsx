"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { GenealogyTree } from "@/components/succession/genealogy-tree";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { buildHeirDecisionMaps } from "@/lib/faraid/heir-decision-maps";
import { FARAID_HEIR_ROLE_LABELS } from "@/lib/faraid/labels";
import {
  FARAID_ACTION_TYPE_LABELS,
  FARAID_DECISION_STATUS_CLASS,
  FARAID_DECISION_STATUS_LABELS,
} from "@/lib/faraid/review-labels";
import { formatMoney } from "@/lib/labels";
import { userCanReviewFaraid } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type {
  Asset,
  Beneficiary,
  FaraidCommitteeReview,
  FaraidHeirDecision,
  FaraidHeirDecisionStatus,
  FaraidSettlementActionType,
  FiduciaryCaseDetail,
} from "@/types/api";

type Props = {
  caseId: string;
  caseDetail: FiduciaryCaseDetail;
  assets: Asset[];
  onReloadCase: () => Promise<void>;
};

const EMPTY_MANUAL = {
  full_name: "",
  relationship_label: "",
  faraid_role: "",
};

const EMPTY_ACTION = {
  action_type: "ASSET_PURCHASE" as FaraidSettlementActionType,
  title: "",
  description: "",
  beneficiary: "",
  asset: "",
  amount: "",
};

export function FaraidReviewWorkspace({
  caseId,
  caseDetail,
  assets,
  onReloadCase,
}: Props) {
  const { user } = useAuth();
  const [review, setReview] = useState<FaraidCommitteeReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [manualForm, setManualForm] = useState(EMPTY_MANUAL);
  const [actionForm, setActionForm] = useState(EMPTY_ACTION);

  const familyMembers = caseDetail.beneficiaries ?? [];
  const deceasedName = useMemo(() => {
    const d = caseDetail.donors?.[0];
    if (!d) return "Le défunt";
    return [d.first_name, d.last_name].filter(Boolean).join(" ") || "Le défunt";
  }, [caseDetail.donors]);

  const successionState = (caseDetail.onboarding?.onboarding_data?.succession ?? {}) as {
    deceasedGender?: "M" | "F";
  };
  const deceasedGender = successionState.deceasedGender === "F" ? "F" : "M";

  const loadReview = useCallback(async () => {
    const data = await apiRequest<FaraidCommitteeReview>(`/cases/${caseId}/faraid-review/`);
    setReview(data);
    return data;
  }, [caseId]);

  useEffect(() => {
    setLoading(true);
    loadReview()
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, [loadReview]);

  const decisions = review?.heir_decisions ?? [];
  const actions = review?.settlement_actions ?? [];
  const selected = decisions.find((d) => d.id === selectedId) ?? null;
  const readOnly = review?.status === "FINALIZED" || !userCanReviewFaraid(user);

  const decisionMaps = useMemo(
    () => buildHeirDecisionMaps(decisions),
    [decisions],
  );

  async function runSave(task: () => Promise<void>) {
    setSaving(true);
    setError(null);
    try {
      await task();
      await loadReview();
      await onReloadCase();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function syncFromGenealogy() {
    await runSave(async () => {
      await apiRequest(`/cases/${caseId}/faraid-review/sync/`, {
        method: "POST",
        body: JSON.stringify({ deceased_gender: deceasedGender }),
      });
    });
  }

  async function updateDecision(
    id: number,
    patch: Partial<FaraidHeirDecision> & { status?: FaraidHeirDecisionStatus },
  ) {
    await runSave(async () => {
      await apiRequest(`/cases/${caseId}/faraid-review/heirs/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
    });
  }

  async function addManualHeir() {
    if (!manualForm.full_name.trim()) return;
    await runSave(async () => {
      await apiRequest(`/cases/${caseId}/faraid-review/heirs/`, {
        method: "POST",
        body: JSON.stringify({
          ...manualForm,
          status: "PENDING",
        }),
      });
      setManualForm(EMPTY_MANUAL);
    });
  }

  async function addAction() {
    if (!actionForm.title.trim()) return;
    await runSave(async () => {
      await apiRequest(`/cases/${caseId}/faraid-review/actions/`, {
        method: "POST",
        body: JSON.stringify({
          action_type: actionForm.action_type,
          title: actionForm.title.trim(),
          description: actionForm.description.trim(),
          beneficiary: actionForm.beneficiary ? Number(actionForm.beneficiary) : null,
          asset: actionForm.asset ? Number(actionForm.asset) : null,
          amount: actionForm.amount.trim() || null,
          currency: review?.currency ?? "XOF",
        }),
      });
      setActionForm(EMPTY_ACTION);
    });
  }

  async function deleteAction(actionId: number) {
    if (!window.confirm("Supprimer cette action ?")) return;
    await runSave(async () => {
      await apiRequest(`/cases/${caseId}/faraid-review/actions/${actionId}/`, {
        method: "DELETE",
      });
    });
  }

  async function finalizeReview() {
    if (
      !window.confirm(
        "Finaliser le partage farāʾiḍ ? Les héritiers retenus seront enregistrés officiellement.",
      )
    ) {
      return;
    }
    await runSave(async () => {
      await apiRequest(`/cases/${caseId}/faraid-review/finalize/`, { method: "POST" });
    });
  }

  if (loading || !review) return <LoadingState label="Chargement de la revue farāʾiḍ…" />;

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-[var(--sf-green)]/15 bg-gradient-to-br from-[var(--sf-green-deep)] to-[var(--sf-green)] p-6 text-white sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--sf-gold-soft)] uppercase">
          Comité charaïque — partage farāʾiḍ
        </p>
        <h1 className="sf-display mt-2 text-2xl font-semibold sm:text-3xl">
          Revue successorale du dossier {caseDetail.reference}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80">
          Arbre dérivé de la généalogie de base : retenez les vrais héritiers, excluez avec
          justification écrite, attribuez les parts et documentez les arrangements particuliers
          (achat d&apos;un bien, etc.).
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-white/15 px-3 py-1">
            Statut : {review.status === "FINALIZED" ? "Finalisé" : "En cours"}
          </span>
          {review.requested_at ? (
            <span className="rounded-full bg-white/15 px-3 py-1">
              Soumis le {new Date(review.requested_at).toLocaleDateString("fr-FR")}
            </span>
          ) : (
            <span className="rounded-full bg-amber-400/20 px-3 py-1 text-amber-100">
              Pas encore soumis par l&apos;agent
            </span>
          )}
        </div>
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-[var(--sf-green-deep)]">
              Arbre de revue (base généalogique)
            </h2>
            {!readOnly ? (
              <button
                type="button"
                className="sf-btn-secondary text-sm"
                disabled={saving}
                onClick={() => void syncFromGenealogy()}
              >
                Importer depuis l&apos;arbre de base
              </button>
            ) : null}
          </div>
          <p className="text-sm text-[var(--sf-green)]/60">
            Tampon vert = héritier retenu · Tampon rouge = exclu (cliquez Détail pour le motif) ·
            Les personnes ajoutées manuellement apparaissent dans la liste à droite.
          </p>
          <GenealogyTree
            deceasedName={deceasedName}
            familyMembers={familyMembers}
            deceasedGender={deceasedGender}
            highlightIds={decisionMaps.highlightIds}
            excludedIds={decisionMaps.excludedIds}
            heirDecisionByNodeId={decisionMaps.statusByNodeId}
            variant="preview"
            previewHeightClass="h-[min(52vh,480px)]"
          />
        </div>

        <div className="space-y-4 lg:col-span-5">
          <h2 className="font-semibold text-[var(--sf-green-deep)]">Personnes à statuer</h2>
          <ul className="max-h-[min(52vh,480px)] space-y-2 overflow-y-auto">
            {decisions.length === 0 ? (
              <li className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-[var(--sf-green)]/55">
                Importez l&apos;arbre de base ou ajoutez un héritier manuellement.
              </li>
            ) : (
              decisions.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(d.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
                      selectedId === d.id
                        ? "border-[var(--sf-gold)] bg-white ring-1 ring-[var(--sf-gold)]/30"
                        : "border-[var(--sf-cream-dark)] bg-white hover:border-[var(--sf-green)]/25"
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-[var(--sf-green-deep)]">{d.full_name}</span>
                      <span className="mt-0.5 block text-xs text-[var(--sf-green)]/55">
                        {d.relationship_label || "—"}
                        {d.source === "MANUAL" ? " · Ajout comité" : " · Arbre de base"}
                      </span>
                      {d.share_fraction ? (
                        <span className="mt-1 block text-xs font-semibold text-[var(--sf-green-mid)]">
                          Part : {(Number(d.share_fraction) * 100).toFixed(2)} %
                          {d.share_amount
                            ? ` · ${formatMoney(d.share_amount, review.currency)}`
                            : ""}
                        </span>
                      ) : null}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${FARAID_DECISION_STATUS_CLASS[d.status]}`}
                    >
                      {FARAID_DECISION_STATUS_LABELS[d.status]}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {selected ? (
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
          <h3 className="font-semibold text-[var(--sf-green-deep)]">
            Décision — {selected.full_name}
          </h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block text-sm sm:col-span-2 lg:col-span-1">
              <span className="font-medium">Statut *</span>
              <select
                className="sf-input mt-1"
                disabled={readOnly || saving}
                value={selected.status}
                onChange={(e) =>
                  void updateDecision(selected.id, {
                    status: e.target.value as FaraidHeirDecisionStatus,
                  })
                }
              >
                {Object.entries(FARAID_DECISION_STATUS_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm sm:col-span-2 lg:col-span-1">
              <span className="font-medium">Rôle farāʾiḍ</span>
              <select
                className="sf-input mt-1"
                disabled={readOnly || saving}
                defaultValue={selected.faraid_role}
                onChange={(e) =>
                  void updateDecision(selected.id, { faraid_role: e.target.value })
                }
              >
                <option value="">—</option>
                {Object.entries(FARAID_HEIR_ROLE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium">Part (fraction 0–1)</span>
              <input
                className="sf-input mt-1"
                type="number"
                min="0"
                max="1"
                step="0.000001"
                disabled={readOnly || saving}
                defaultValue={selected.share_fraction ?? ""}
                onBlur={(e) =>
                  void updateDecision(selected.id, {
                    share_fraction: e.target.value.trim() || null,
                  })
                }
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Montant ({review.currency})</span>
              <input
                className="sf-input mt-1"
                type="number"
                min="0"
                step="1"
                disabled={readOnly || saving}
                defaultValue={selected.share_amount ?? ""}
                onBlur={(e) =>
                  void updateDecision(selected.id, {
                    share_amount: e.target.value.trim() || null,
                  })
                }
              />
            </label>
            {selected.status === "REJECTED" ? (
              <label className="block text-sm sm:col-span-2 lg:col-span-3">
                <span className="font-medium">Justification de l&apos;exclusion *</span>
                <textarea
                  className="sf-input mt-1 min-h-[88px] resize-y"
                  disabled={readOnly || saving}
                  defaultValue={selected.rejection_justification}
                  placeholder="Motif charaïque et factuel de l'exclusion (obligatoire)"
                  onBlur={(e) =>
                    void updateDecision(selected.id, {
                      rejection_justification: e.target.value,
                    })
                  }
                />
              </label>
            ) : null}
            <label className="block text-sm sm:col-span-2 lg:col-span-3">
              <span className="font-medium">Notes du comité</span>
              <textarea
                className="sf-input mt-1 min-h-[72px] resize-y"
                disabled={readOnly || saving}
                defaultValue={selected.committee_notes}
                onBlur={(e) =>
                  void updateDecision(selected.id, { committee_notes: e.target.value })
                }
              />
            </label>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/35 p-5">
          <h3 className="font-semibold text-[var(--sf-green-deep)]">
            Ajouter un héritier (hors arbre de base)
          </h3>
          <p className="mt-1 text-sm text-[var(--sf-green)]/60">
            Pour une personne réelle qui hérite mais n&apos;apparaît pas dans l&apos;arbre
            généalogique initial.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input
              className="sf-input"
              placeholder="Nom complet *"
              value={manualForm.full_name}
              onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })}
            />
            <input
              className="sf-input"
              placeholder="Lien de parenté"
              value={manualForm.relationship_label}
              onChange={(e) =>
                setManualForm({ ...manualForm, relationship_label: e.target.value })
              }
            />
            <input
              className="sf-input"
              placeholder="Rôle farāʾiḍ (code)"
              value={manualForm.faraid_role}
              onChange={(e) => setManualForm({ ...manualForm, faraid_role: e.target.value })}
            />
          </div>
          <button
            type="button"
            className="sf-btn-secondary mt-3"
            disabled={saving || !manualForm.full_name.trim()}
            onClick={() => void addManualHeir()}
          >
            + Ajouter cette personne
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
        <h3 className="font-semibold text-[var(--sf-green-deep)]">
          Actions et arrangements particuliers
        </h3>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Ex. : un membre de la famille achète un bien du patrimoine, attribution spécifique,
          règlement en numéraire.
        </p>

        {actions.length > 0 ? (
          <ul className="mt-4 space-y-2">
            {actions.map((action) => (
              <li
                key={action.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--sf-cream-dark)] px-4 py-3"
              >
                <div>
                  <p className="font-medium text-[var(--sf-green-deep)]">{action.title}</p>
                  <p className="text-xs text-[var(--sf-gold)]">
                    {FARAID_ACTION_TYPE_LABELS[action.action_type]}
                  </p>
                  {action.description ? (
                    <p className="mt-1 text-sm text-[var(--sf-green)]/65">{action.description}</p>
                  ) : null}
                  {action.amount ? (
                    <p className="mt-1 text-sm font-semibold text-[var(--sf-green-mid)]">
                      {formatMoney(action.amount, action.currency)}
                    </p>
                  ) : null}
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    className="text-sm text-red-700 hover:underline"
                    onClick={() => void deleteAction(action.id)}
                  >
                    Supprimer
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-[var(--sf-green)]/55">Aucune action enregistrée.</p>
        )}

        {!readOnly ? (
          <div className="mt-5 grid gap-3 border-t border-[var(--sf-cream-dark)] pt-5 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium">Type d&apos;action</span>
              <select
                className="sf-input mt-1"
                value={actionForm.action_type}
                onChange={(e) =>
                  setActionForm({
                    ...actionForm,
                    action_type: e.target.value as FaraidSettlementActionType,
                  })
                }
              >
                {Object.entries(FARAID_ACTION_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <input
              className="sf-input sm:col-span-2"
              placeholder="Titre de l'action *"
              value={actionForm.title}
              onChange={(e) => setActionForm({ ...actionForm, title: e.target.value })}
            />
            <textarea
              className="sf-input min-h-[72px] resize-y sm:col-span-2"
              placeholder="Description détaillée"
              value={actionForm.description}
              onChange={(e) => setActionForm({ ...actionForm, description: e.target.value })}
            />
            <select
              className="sf-input"
              value={actionForm.beneficiary}
              onChange={(e) => setActionForm({ ...actionForm, beneficiary: e.target.value })}
            >
              <option value="">Personne concernée (optionnel)</option>
              {familyMembers.map((b) => (
                <option key={b.id} value={b.id}>
                  {[b.first_name, b.last_name].filter(Boolean).join(" ")}
                </option>
              ))}
            </select>
            <select
              className="sf-input"
              value={actionForm.asset}
              onChange={(e) => setActionForm({ ...actionForm, asset: e.target.value })}
            >
              <option value="">Bien concerné (optionnel)</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
            <input
              className="sf-input"
              type="number"
              min="0"
              step="1"
              placeholder="Montant (FCFA)"
              value={actionForm.amount}
              onChange={(e) => setActionForm({ ...actionForm, amount: e.target.value })}
            />
            <button
              type="button"
              className="sf-btn-secondary"
              disabled={saving || !actionForm.title.trim()}
              onClick={() => void addAction()}
            >
              + Ajouter l&apos;action
            </button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        {!readOnly ? (
          <button
            type="button"
            className="sf-btn-gold"
            disabled={saving || decisions.filter((d) => d.status === "ACCEPTED").length === 0}
            onClick={() => void finalizeReview()}
          >
            Finaliser le partage farāʾiḍ
          </button>
        ) : null}
        <Link href={`/dossiers/${caseId}/succession/synthese`} className="sf-btn-secondary">
          Voir le dossier succession
        </Link>
      </div>
    </div>
  );
}
