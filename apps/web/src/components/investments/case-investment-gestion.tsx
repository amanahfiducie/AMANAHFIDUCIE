"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  DashboardKpi,
  DashboardPanel,
} from "@/components/investments/investment-charts";
import { CaseInvestmentsPreview } from "@/components/investments/case-investments-list";
import { ScheduledPaymentsPreview } from "@/components/investments/case-scheduled-payments";
import { useCaseInvestmentData } from "@/components/investments/use-case-investment-data";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import {
  formatAmountInput,
  formatDate,
  formatMoney,
  parseAmountInput,
} from "@/lib/labels";
import { userCanWriteCaseContent } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useOptionalCaseDetail } from "@/providers/case-detail-provider";
import type { CaseInvestmentPolicy } from "@/types/api";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--sf-cream-dark)] bg-white px-3.5 py-2.5 text-sm text-[var(--sf-green-deep)] outline-none transition focus:border-[var(--sf-green)]/40 focus:ring-2 focus:ring-[var(--sf-green)]/10 disabled:cursor-not-allowed disabled:bg-[var(--sf-cream)]/40";

export function CaseInvestmentGestionView({ caseId }: { caseId: number }) {
  const { user } = useAuth();
  const caseDetail = useOptionalCaseDetail();
  const canWrite = userCanWriteCaseContent(user, caseDetail?.data?.status);
  const { dashboard, catalog, capital, loading, error, reload } =
    useCaseInvestmentData(caseId);

  const [policyBusy, setPolicyBusy] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const [patrimonyCategoryId, setPatrimonyCategoryId] = useState("");
  const [managementProfileId, setManagementProfileId] = useState("");
  const [amanahShare, setAmanahShare] = useState("");
  const [policyNotes, setPolicyNotes] = useState("");

  const [showAddModal, setShowAddModal] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [addNote, setAddNote] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!dashboard) return;
    const p = dashboard.policy;
    setPatrimonyCategoryId(String(p.patrimony_category.id));
    setManagementProfileId(String(p.management_profile.id));
    setAmanahShare(p.amanah_management_share_percent ?? "");
    setPolicyNotes(p.notes ?? "");
  }, [dashboard]);

  const categories = catalog?.patrimony_categories ?? [];
  const profiles = catalog?.management_profiles ?? [];

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === patrimonyCategoryId),
    [categories, patrimonyCategoryId],
  );
  const selectedProfile = useMemo(
    () => profiles.find((p) => String(p.id) === managementProfileId),
    [profiles, managementProfileId],
  );

  if (loading) return <LoadingState label="Chargement gestion…" />;
  if (error && !dashboard) return <ErrorAlert message={error} />;
  if (!dashboard || !catalog) return null;

  const { investments, summary, policy } = dashboard;
  const hasInvestments = investments.length > 0;
  const alreadyInvested = Number(summary.total_value) || 0;
  const currentPlanned = Number(policy.planned_investment_amount) || 0;
  const remainingEnvelope = Math.max(currentPlanned - alreadyInvested, 0);
  const envelopeHistory = policy.envelope_history ?? [];
  const addedAmount = Number(parseAmountInput(addAmount)) || 0;
  const newPlannedTotal = currentPlanned + addedAmount;

  async function handleSavePolicy(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;

    setPolicyBusy(true);
    setLocalError(null);
    try {
      await apiRequest<CaseInvestmentPolicy>(
        `/cases/${caseId}/investment-policy/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            patrimony_category_id: Number(patrimonyCategoryId),
            management_profile_id: Number(managementProfileId),
            amanah_management_share_percent: amanahShare || null,
            notes: policyNotes,
          }),
        },
      );
      await reload();
    } catch (err) {
      setLocalError(
        err instanceof ApiError ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setPolicyBusy(false);
    }
  }

  function openAddModal() {
    setAddAmount("");
    setAddNote("");
    setAddError(null);
    setShowAddModal(true);
  }

  async function handleAddToEnvelope(e: FormEvent) {
    e.preventDefault();
    if (!canWrite) return;
    if (addedAmount <= 0) {
      setAddError("La somme à ajouter doit être positive.");
      return;
    }
    setAddBusy(true);
    setAddError(null);
    try {
      await apiRequest<CaseInvestmentPolicy>(
        `/cases/${caseId}/investment-policy/envelope-contributions/`,
        {
          method: "POST",
          body: JSON.stringify({
            amount: String(addedAmount),
            notes: addNote,
          }),
        },
      );
      setShowAddModal(false);
      await reload();
    } catch (err) {
      setAddError(
        err instanceof ApiError ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setAddBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {(localError ?? error) ? (
        <ErrorAlert message={localError ?? error!} />
      ) : null}

      <header className="space-y-1">
        <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
          Gestion PIGFI
        </h2>
        <p className="text-sm text-[var(--sf-green)]/55">
          Paramétrez l&apos;enveloppe et la politique. Les versements et
          investissements détaillés ont leurs pages dédiées.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpi
          label="Somme à investir"
          value={
            currentPlanned > 0
              ? formatMoney(String(currentPlanned), "XOF")
              : "—"
          }
          hint={
            hasInvestments
              ? "Enveloppe Gestion"
              : "Après le 1er investissement"
          }
        />
        <DashboardKpi
          label="Déjà investi"
          value={formatMoney(String(alreadyInvested), "XOF")}
          hint={`${summary.asset_count} position(s)`}
        />
        <DashboardKpi
          label="Reste à investir"
          value={
            currentPlanned > 0
              ? formatMoney(String(remainingEnvelope), "XOF")
              : "—"
          }
          hint="Enveloppe − investi"
          accent="muted"
        />
        <DashboardKpi
          label="Part AMANAH"
          value={
            policy.amanah_management_share_percent
              ? `${policy.amanah_management_share_percent} %`
              : "—"
          }
          hint={selectedProfile?.label ?? policy.management_profile.label}
          accent="gold"
        />
      </div>

      <form onSubmit={handleSavePolicy} className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <DashboardPanel
            title="Politique d'investissement"
            subtitle="Type patrimonial et profil de gestion"
          >
            <div className="space-y-4">
              <label className="block text-sm">
                <span className="font-medium text-[var(--sf-green)]/70">
                  Type d&apos;investissement (A–D)
                </span>
                <select
                  required
                  disabled={!canWrite}
                  value={patrimonyCategoryId}
                  onChange={(e) => setPatrimonyCategoryId(e.target.value)}
                  className={fieldClass}
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>
                {selectedCategory ? (
                  <p className="mt-1.5 text-xs text-[var(--sf-green)]/45">
                    Rendement cible {selectedCategory.target_yield_min}–
                    {selectedCategory.target_yield_max} %
                  </p>
                ) : null}
              </label>

              <label className="block text-sm">
                <span className="font-medium text-[var(--sf-green)]/70">
                  Profil AMANAH
                </span>
                <select
                  required
                  disabled={!canWrite}
                  value={managementProfileId}
                  onChange={(e) => setManagementProfileId(e.target.value)}
                  className={fieldClass}
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm">
                <span className="font-medium text-[var(--sf-green)]/70">
                  Part AMANAH gestion (%)
                </span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  disabled={!canWrite}
                  value={amanahShare}
                  onChange={(e) => setAmanahShare(e.target.value)}
                  placeholder="ex. 2.5"
                  className={fieldClass}
                />
              </label>
            </div>
          </DashboardPanel>

          <DashboardPanel
            title="Enveloppe à investir"
            subtitle="Somme cible du dossier"
          >
            {hasInvestments ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg bg-[var(--sf-cream)]/40 px-3 py-2">
                    <p className="text-xs text-[var(--sf-green)]/50">
                      Enveloppe actuelle
                    </p>
                    <p className="font-medium tabular-nums text-[var(--sf-green-deep)]">
                      {formatMoney(String(currentPlanned), "XOF")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-[var(--sf-cream)]/40 px-3 py-2">
                    <p className="text-xs text-[var(--sf-green)]/50">
                      Capital déjà investi
                    </p>
                    <p className="font-medium tabular-nums text-[var(--sf-green-deep)]">
                      {formatMoney(String(alreadyInvested), "XOF")}
                    </p>
                  </div>
                </div>

                {canWrite ? (
                  <button
                    type="button"
                    onClick={openAddModal}
                    className="w-full rounded-lg border border-[var(--sf-green)]/25 bg-[var(--sf-green)]/5 px-4 py-2.5 text-sm font-medium text-[var(--sf-green)] transition hover:bg-[var(--sf-green)]/10"
                  >
                    + Ajouter une somme à investir
                  </button>
                ) : null}

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                    Historique des ajouts
                  </p>
                  {envelopeHistory.length > 0 ? (
                    <ul className="divide-y divide-[var(--sf-cream-dark)] rounded-lg border border-[var(--sf-cream-dark)]">
                      {envelopeHistory.map((c) => (
                        <li key={c.id} className="px-3.5 py-2.5 text-sm">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium tabular-nums text-emerald-800">
                              + {formatMoney(c.amount, "XOF")}
                            </span>
                            <span className="text-xs text-[var(--sf-green)]/45">
                              {formatDate(c.created_at)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                            Nouveau total :{" "}
                            <span className="tabular-nums">
                              {formatMoney(c.new_total, "XOF")}
                            </span>
                            {c.created_by_name
                              ? ` · par ${c.created_by_name}`
                              : ""}
                          </p>
                          {c.notes ? (
                            <p className="mt-0.5 text-xs italic text-[var(--sf-green)]/45">
                              {c.notes}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="rounded-lg bg-[var(--sf-cream)]/35 px-4 py-3 text-xs leading-relaxed text-[var(--sf-green)]/60">
                      Aucun ajout enregistré pour le moment. Chaque somme
                      ajoutée via le bouton ci-dessus sera historisée.
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[10rem] flex-col justify-center rounded-lg border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 px-5 py-6 text-center">
                <p className="text-sm font-medium text-[var(--sf-green-deep)]">
                  Enveloppe verrouillée
                </p>
                <p className="mt-2 text-xs leading-relaxed text-[var(--sf-green)]/55">
                  La somme à investir s&apos;ajoute après le premier
                  investissement sur ce dossier.
                </p>
                {policy.planned_investment_amount ? (
                  <p className="mt-4 text-sm tabular-nums text-[var(--sf-green-deep)]">
                    Enveloppe actuelle :{" "}
                    <span className="font-semibold">
                      {formatMoney(policy.planned_investment_amount, "XOF")}
                    </span>
                  </p>
                ) : (
                  <Link
                    href="/investissements/categories"
                    className="mt-4 text-xs font-medium text-[var(--sf-green)] underline-offset-2 hover:underline"
                  >
                    Créer un investissement →
                  </Link>
                )}
              </div>
            )}
          </DashboardPanel>
        </div>

        <DashboardPanel title="Notes" subtitle="Contexte interne (optionnel)">
          <textarea
            rows={3}
            disabled={!canWrite}
            value={policyNotes}
            onChange={(e) => setPolicyNotes(e.target.value)}
            placeholder="Précisions sur la stratégie, le calendrier ou les contraintes…"
            className={fieldClass}
          />
        </DashboardPanel>

        {canWrite ? (
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--sf-cream-dark)] pt-4">
            <p className="mr-auto text-xs text-[var(--sf-green)]/45">
              Les versements se gèrent sur leur page dédiée.
            </p>
            <button
              type="submit"
              disabled={policyBusy}
              className="rounded-lg bg-[var(--sf-green)] px-5 py-2.5 text-sm font-medium text-[var(--sf-gold)] transition hover:opacity-95 disabled:opacity-50"
            >
              {policyBusy ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        ) : null}
      </form>

      <ScheduledPaymentsPreview
        caseId={caseId}
        payments={policy.scheduled_payments ?? []}
        limit={5}
      />

      <CaseInvestmentsPreview
        caseId={caseId}
        investments={investments}
        limit={5}
      />

      {capital && capital.beneficiaries.length > 0 ? (
        <DashboardPanel
          title="Capital par client"
          subtitle="Limites patrimoniales disponibles"
        >
          <ul className="divide-y divide-[var(--sf-cream-dark)]">
            {capital.beneficiaries.map((b) => (
              <li
                key={b.beneficiary_id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-[var(--sf-green-deep)]">
                    {b.display_name}
                  </p>
                  {b.patrimony_share_percent ? (
                    <p className="text-xs text-[var(--sf-green)]/45">
                      Quote-part {b.patrimony_share_percent} %
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums text-emerald-900">
                    {formatMoney(b.available_amount, b.currency)}
                  </p>
                  <p className="text-xs text-[var(--sf-green)]/45">disponible</p>
                </div>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      ) : null}

      {showAddModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !addBusy) setShowAddModal(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--sf-cream-dark)] px-5 py-4">
              <div>
                <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
                  Ajouter une somme à investir
                </h2>
                <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                  L&apos;ajout est enregistré dans l&apos;historique de
                  l&apos;enveloppe.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                disabled={addBusy}
                className="rounded-md p-1 text-[var(--sf-green)]/50 transition hover:bg-[var(--sf-cream)]/60 hover:text-[var(--sf-green-deep)]"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddToEnvelope} className="space-y-4 px-5 py-4">
              {addError ? <ErrorAlert message={addError} /> : null}

              <div className="rounded-lg bg-[var(--sf-cream)]/40 px-3.5 py-2.5 text-sm">
                <p className="text-xs text-[var(--sf-green)]/50">
                  Enveloppe actuelle
                </p>
                <p className="font-medium tabular-nums text-[var(--sf-green-deep)]">
                  {formatMoney(String(currentPlanned), "XOF")}
                </p>
              </div>

              <label className="block text-sm">
                <span className="font-medium text-[var(--sf-green)]/70">
                  Somme à ajouter (XOF)
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  required
                  placeholder="ex. 50 000 000"
                  value={addAmount}
                  onChange={(e) =>
                    setAddAmount(formatAmountInput(e.target.value))
                  }
                  className={`${fieldClass} tabular-nums text-base font-medium`}
                />
              </label>

              <label className="block text-sm">
                <span className="font-medium text-[var(--sf-green)]/70">
                  Note (optionnel)
                </span>
                <textarea
                  rows={2}
                  value={addNote}
                  onChange={(e) => setAddNote(e.target.value)}
                  placeholder="Origine des fonds, contexte…"
                  className={fieldClass}
                />
              </label>

              {addedAmount > 0 ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm">
                  <p className="text-xs text-emerald-700/70">
                    Nouvelle somme à investir
                  </p>
                  <p className="mt-0.5 font-semibold tabular-nums text-emerald-800">
                    {formatMoney(String(currentPlanned), "XOF")} +{" "}
                    {formatMoney(String(addedAmount), "XOF")} ={" "}
                    {formatMoney(String(newPlannedTotal), "XOF")}
                  </p>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-3 border-t border-[var(--sf-cream-dark)] pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={addBusy}
                  className="rounded-lg border border-[var(--sf-cream-dark)] px-4 py-2 text-sm font-medium text-[var(--sf-green)]/70 transition hover:bg-[var(--sf-cream)]/50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={addBusy || addedAmount <= 0}
                  className="rounded-lg bg-[var(--sf-green)] px-5 py-2 text-sm font-medium text-[var(--sf-gold)] transition hover:opacity-95 disabled:opacity-50"
                >
                  {addBusy ? "Enregistrement…" : "Enregistrer l'ajout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
