"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import {
  DashboardKpi,
  DashboardPanel,
  DonutChart,
  InvestmentValuationChart,
} from "@/components/investments/investment-charts";
import {
  allocationProgressStyle,
  InvestmentCreateWizard,
} from "@/components/investments/investment-create-wizard";
import { InvestmentOperationsPanel } from "@/components/investments/investment-operations-panel";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { INVESTMENT_STATUS_LABELS } from "@/lib/investment-labels";
import { formatDate, formatMoney, formatMoneyNumber } from "@/lib/labels";
import { userCanWriteCase } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type {
  InvestmentDetail,
  InvestmentsManagement,
} from "@/types/api";

export default function InvestmentDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { user } = useAuth();
  const canWrite = userCanWriteCase(user);

  const [detail, setDetail] = useState<InvestmentDetail | null>(null);
  const [cases, setCases] = useState<InvestmentsManagement["cases"]>([]);
  const [assetClasses, setAssetClasses] = useState<
    InvestmentsManagement["asset_classes"]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showComplete, setShowComplete] = useState(false);

  function load() {
    if (!Number.isFinite(id) || id <= 0) {
      setError("Investissement introuvable.");
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      apiRequest<InvestmentDetail>(`/investments/${id}/`),
      apiRequest<InvestmentsManagement>("/investments/management/"),
    ])
      .then(([inv, mgmt]) => {
        setDetail(inv);
        setCases(mgmt.cases);
        setAssetClasses(mgmt.asset_classes);
        setError(null);
      })
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger l'investissement.",
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const currency = detail?.currency || "XOF";
  const amount = Number(detail?.amount_invested) || 0;
  const allocated = Number(detail?.allocated_amount ?? detail?.amount_invested) || 0;
  const remaining = Number(detail?.remaining_amount) || Math.max(amount - allocated, 0);
  const progress = detail?.allocation_progress_percent ?? 100;
  const complete = detail?.is_allocation_complete ?? true;
  const current = Number(detail?.current_value) || 0;
  const latent = Number(detail?.latent_gain ?? current - amount) || 0;
  const distributed = Number(detail?.distributed_income) || 0;

  const dossierAllocationSlices = useMemo(() => {
    if (!detail) return [];

    const rows = (detail.allocations ?? []).filter(
      (row) => Number(row.amount_invested) > 0,
    );

    if (rows.length > 0) {
      return rows.map((row) => ({
        label: row.case_reference || row.case_title || `Dossier ${row.case_id}`,
        amount: row.amount_invested,
        percent: 0,
      }));
    }

    const allocatedTotal = Number(detail.allocated_amount) || 0;
    const fallbackAmount = allocatedTotal > 0 ? allocatedTotal : amount;

    if (fallbackAmount <= 0) return [];

    if (detail.case_id) {
      return [
        {
          label: detail.case_reference || detail.case_title || "Dossier",
          amount: String(fallbackAmount),
          percent: 100,
        },
      ];
    }

    return [];
  }, [detail, amount]);

  if (loading && !detail) return <LoadingState label="Chargement…" />;
  if (error && !detail) return <ErrorAlert message={error} />;
  if (!detail) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/investissements/liste"
            className="text-xs font-medium text-[var(--sf-green)]/60 hover:text-[var(--sf-green)] hover:underline"
          >
            ← Liste des investissements
          </Link>
          <h2 className="mt-2 text-xl font-semibold text-[var(--sf-green-deep)]">
            {detail.label}
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/55">
            {detail.asset_class_label}
            {detail.reference ? ` · Réf. ${detail.reference}` : ""}
            {" · "}
            {INVESTMENT_STATUS_LABELS[detail.status] ?? detail.status}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!complete && canWrite ? (
            <button
              type="button"
              onClick={() => setShowComplete(true)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={allocationProgressStyle(progress)}
            >
              Compléter l&apos;allocation
            </button>
          ) : null}
        </div>
      </header>

      {error ? <ErrorAlert message={error} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardKpi
          label="Montant total"
          moneyAmount={detail.amount_invested}
          hint={`Début ${formatDate(detail.start_date)}`}
        />
        <DashboardKpi
          label="Alloué aux dossiers"
          moneyAmount={String(allocated)}
          hint={`${Math.round(progress)} % de l'enveloppe`}
          accent={complete ? "default" : "muted"}
        />
        <DashboardKpi
          label="Reste à allouer"
          moneyAmount={String(remaining)}
          hint={complete ? "Allocation complète" : "En attente de dossiers"}
          accent={remaining > 0 ? "gold" : "default"}
        />
        <DashboardKpi
          label="Valeur actuelle"
          moneyAmount={detail.current_value}
          hint={
            detail.latest_valuation_date
              ? `Estimée le ${formatDate(detail.latest_valuation_date)}`
              : latent !== 0
                ? `${latent >= 0 ? "+" : "−"}${formatMoneyNumber(String(Math.abs(latent)))} F CFA latent`
                : detail.annual_yield_percent
                  ? `Rendement ${detail.annual_yield_percent} % / an`
                  : undefined
          }
        />
        <DashboardKpi
          label="Revenus distribués"
          moneyAmount={String(distributed)}
          hint="Montants versés aux dossiers"
          accent="muted"
        />
      </div>

      {canWrite ? (
        <InvestmentOperationsPanel
          detail={detail}
          canWrite={canWrite}
          onUpdated={load}
        />
      ) : null}

      <DashboardPanel
        title="Évolution de la valeur"
        subtitle={
          detail.valuation_evolution?.from_activity_start
            ? "Depuis le début de l'activité — courbe basée sur les dates d'estimation"
            : "12 derniers mois — courbe basée sur les dates d'estimation"
        }
      >
        <InvestmentValuationChart
          data={detail.valuation_evolution}
          currency={currency}
        />
      </DashboardPanel>

      <DashboardPanel
        title="Historique des estimations"
          subtitle={
            detail.valuation_history?.length
              ? `${detail.valuation_history.length} estimation(s)`
              : "Aucune estimation enregistrée"
          }
        >
          {!detail.valuation_history || detail.valuation_history.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--sf-green)]/45">
              Utilisez « Nouvelle estimation » pour commencer l&apos;historique.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[20rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--sf-cream-dark)] text-xs uppercase tracking-wide text-[var(--sf-green)]/45">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">Valeur</th>
                    <th className="pb-2 pr-3 font-medium">Variation</th>
                    <th className="pb-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--sf-cream-dark)]">
                  {detail.valuation_history.map((row, index) => {
                    const prev =
                      detail.valuation_history?.[index + 1]?.value ??
                      detail.amount_invested;
                    const variation =
                      Number(row.value) - Number(prev);
                    return (
                      <tr key={row.id}>
                        <td className="py-2.5 pr-3 text-[var(--sf-green-deep)]">
                          {formatDate(row.valued_at)}
                        </td>
                        <td className="py-2.5 pr-3 tabular-nums font-medium text-emerald-900">
                          {formatMoney(row.value, row.currency || currency)}
                        </td>
                        <td
                          className={`py-2.5 pr-3 tabular-nums text-xs ${
                            variation >= 0 ? "text-emerald-700" : "text-red-700"
                          }`}
                        >
                          {variation >= 0 ? "+" : ""}
                          {formatMoney(String(variation), currency)}
                        </td>
                        <td className="py-2.5 text-xs text-[var(--sf-green)]/55">
                          {row.notes?.trim() || "—"}
                          {row.created_by_name ? (
                            <span className="mt-0.5 block text-[var(--sf-green)]/40">
                              {row.created_by_name}
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </DashboardPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel
          title="Progression d'allocation"
          subtitle="Part de l'enveloppe déjà affectée aux dossiers clients"
        >
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <p
                className="text-3xl font-semibold tabular-nums"
                style={{
                  color: allocationProgressStyle(progress).backgroundColor,
                }}
              >
                {Math.round(progress)} %
              </p>
              <p className="text-sm text-[var(--sf-green)]/55">
                {detail.allocation_count ?? dossierAllocationSlices.length} dossier
                {(detail.allocation_count ?? dossierAllocationSlices.length) > 1
                  ? "s"
                  : ""}
              </p>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--sf-cream)]">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(100, progress)}%`,
                  ...allocationProgressStyle(progress),
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg bg-[var(--sf-cream)]/40 px-3 py-2">
                <p className="text-xs text-[var(--sf-green)]/50">Alloué</p>
                <p className="font-medium tabular-nums text-[var(--sf-green-deep)]">
                  {formatMoney(String(allocated), currency)}
                </p>
              </div>
              <div className="rounded-lg bg-[var(--sf-cream)]/40 px-3 py-2">
                <p className="text-xs text-[var(--sf-green)]/50">Restant</p>
                <p className="font-medium tabular-nums text-[var(--sf-green-deep)]">
                  {formatMoney(String(remaining), currency)}
                </p>
              </div>
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel
          title="Répartition par dossier"
          subtitle="Parts allouées sur le montant déjà affecté"
        >
          {dossierAllocationSlices.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--sf-green)]/45">
              Aucun montant affecté à un dossier pour le moment.
            </p>
          ) : (
            <DonutChart
              slices={dossierAllocationSlices}
              currency={currency}
              size={220}
              centerLabel={formatMoney(String(allocated), currency)}
              centerHint="Montant affecté"
            />
          )}
        </DashboardPanel>
      </div>

      <DashboardPanel
        title="Dossiers alloués"
        subtitle="Clients (dossiers) participant à cet investissement"
      >
        {!detail.allocations || detail.allocations.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--sf-green)]/45">
            {detail.case_id ? (
              <>
                Rattaché à{" "}
                <Link
                  href={`/dossiers/${detail.case_id}/finance/investissements`}
                  className="font-medium text-[var(--sf-green)] underline-offset-2 hover:underline"
                >
                  {detail.case_reference}
                </Link>
              </>
            ) : (
              "Aucune allocation dossier."
            )}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--sf-cream-dark)] text-xs uppercase tracking-wide text-[var(--sf-green)]/45">
                  <th className="pb-2 pr-3 font-medium">Dossier</th>
                  <th className="pb-2 pr-3 font-medium">Montant</th>
                  <th className="pb-2 pr-3 font-medium">Part</th>
                  <th className="pb-2 font-medium">Lien</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sf-cream-dark)]">
                {detail.allocations.map((a) => {
                  const aAmount = Number(a.amount_invested) || 0;
                  const allocationBase = allocated > 0 ? allocated : amount;
                  const pct =
                    allocationBase > 0
                      ? Math.round((aAmount / allocationBase) * 1000) / 10
                      : 0;
                  return (
                    <tr key={a.id}>
                      <td className="py-3 pr-3">
                        <p className="font-medium text-[var(--sf-green-deep)]">
                          {a.case_reference || "—"}
                        </p>
                        <p className="text-xs text-[var(--sf-green)]/45">
                          {a.case_title}
                        </p>
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-[var(--sf-green)]/80">
                        {formatMoney(a.amount_invested, currency)}
                      </td>
                      <td className="py-3 pr-3 tabular-nums text-[var(--sf-green)]/70">
                        {Number.isInteger(pct) ? pct : pct.toFixed(1)} %
                      </td>
                      <td className="py-3">
                        {a.case_id ? (
                          <Link
                            href={`/dossiers/${a.case_id}/finance/investissements`}
                            className="text-xs font-medium text-[var(--sf-green)] hover:underline"
                          >
                            Voir le dossier
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel title="Informations" subtitle="Caractéristiques du placement">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <InfoItem label="Catégorie" value={detail.asset_class_label} />
            <InfoItem
              label="Statut"
              value={INVESTMENT_STATUS_LABELS[detail.status] ?? detail.status}
            />
            <InfoItem label="Date de début" value={formatDate(detail.start_date)} />
            <InfoItem
              label="Échéance"
              value={
                detail.maturity_date ? formatDate(detail.maturity_date) : "—"
              }
            />
            <InfoItem
              label="Rendement"
              value={
                detail.annual_yield_percent
                  ? `${detail.annual_yield_percent} % / an`
                  : "—"
              }
            />
            <InfoItem
              label="Score charaïque"
              value={detail.sharia_compliance_score ?? "—"}
            />
            <InfoItem
              label="Référence"
              value={detail.reference || "—"}
            />
            <InfoItem
              label="Dernière estimation"
              value={
                detail.latest_valuation_date
                  ? `${formatDate(detail.latest_valuation_date)} · ${formatMoney(detail.latest_valuation_value ?? detail.current_value, currency)}`
                  : "—"
              }
            />
            <InfoItem
              label="Créé par"
              value={detail.created_by_name || "—"}
            />
          </dl>
        </DashboardPanel>

        <DashboardPanel title="Risque & notes" subtitle="Contexte interne">
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                Risque
              </p>
              <p className="mt-1 text-[var(--sf-green-deep)] whitespace-pre-wrap">
                {detail.risk_summary?.trim() || "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                Notes
              </p>
              <p className="mt-1 text-[var(--sf-green-deep)] whitespace-pre-wrap">
                {detail.notes?.trim() || "—"}
              </p>
            </div>
          </div>
        </DashboardPanel>
      </div>

      {showComplete && canWrite ? (
        <CompleteAllocationModal
          detail={detail}
          cases={cases}
          assetClasses={assetClasses}
          onClose={() => setShowComplete(false)}
          onCreated={() => {
            setShowComplete(false);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[var(--sf-green)]/45">{label}</dt>
      <dd className="mt-0.5 font-medium text-[var(--sf-green-deep)]">{value}</dd>
    </div>
  );
}

function CompleteAllocationModal({
  detail,
  cases,
  assetClasses,
  onClose,
  onCreated,
}: {
  detail: InvestmentDetail;
  cases: InvestmentsManagement["cases"];
  assetClasses: InvestmentsManagement["asset_classes"];
  onClose: () => void;
  onCreated: () => void;
}) {
  const titleId = useId();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-xl sm:p-5"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2
            id={titleId}
            className="text-base font-semibold text-[var(--sf-green-deep)] sm:text-lg"
          >
            Compléter l&apos;allocation
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--sf-green)]/55 hover:bg-[var(--sf-cream)]/50"
          >
            Fermer
          </button>
        </div>
        <InvestmentCreateWizard
          cases={cases}
          assetClasses={assetClasses}
          existingInvestment={detail}
          onCancel={onClose}
          onCreated={onCreated}
        />
      </div>
    </div>
  );
}
