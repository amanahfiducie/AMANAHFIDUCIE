"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { InvestmentCreateWizard } from "@/components/investments/investment-create-wizard";
import {
  DashboardKpi,
  DashboardPanel,
  DonutChart,
  PatrimonyEvolutionChart,
  sliceColor,
} from "@/components/investments/investment-charts";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { INVESTMENT_STATUS_LABELS, assetClassColor } from "@/lib/investment-labels";
import { formatDate, formatMoney } from "@/lib/labels";
import { userCanWriteCase } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { AssetClassDashboard } from "@/types/api";

export default function CategoryDashboardPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { user } = useAuth();
  const canWrite = userCanWriteCase(user);
  const [data, setData] = useState<AssetClassDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    apiRequest<AssetClassDashboard>(
      `/investments/categories/${encodeURIComponent(slug)}/dashboard/`,
    )
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Catégorie introuvable."),
      )
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const color = assetClassColor(slug, 0);

  const evolutionSeries = useMemo(() => {
    if (!data) return [];
    const ac = data.asset_class;
    return data.patrimony_evolution.length > 0
      ? [{ slug: ac.slug, label: ac.label, points: data.patrimony_evolution }]
      : [];
  }, [data]);

  const incompleteInvestments = useMemo(
    () =>
      (data?.investments ?? []).filter(
        (inv) => inv.is_allocation_complete === false,
      ),
    [data],
  );

  const incompleteInvestmentColors = useMemo(() => {
    const map = new Map<number, string>();
    incompleteInvestments.forEach((inv, index) => {
      map.set(inv.id, sliceColor(index));
    });
    return map;
  }, [incompleteInvestments]);

  const incompleteAllocationSlices = useMemo(() => {
    const total = incompleteInvestments.reduce(
      (sum, inv) => sum + (Number(inv.amount_invested) || 0),
      0,
    );
    if (total <= 0) return [];

    return incompleteInvestments
      .map((inv) => {
        const amount = Number(inv.amount_invested) || 0;
        if (amount <= 0) return null;
        return {
          label: inv.label,
          amount: inv.amount_invested,
          percent: (amount / total) * 100,
          color: incompleteInvestmentColors.get(inv.id),
        };
      })
      .filter((slice): slice is NonNullable<typeof slice> => slice != null);
  }, [incompleteInvestments, incompleteInvestmentColors]);

  const incompleteCapitalTotal = useMemo(
    () =>
      incompleteInvestments.reduce(
        (sum, inv) => sum + (Number(inv.amount_invested) || 0),
        0,
      ),
    [incompleteInvestments],
  );

  const incompleteAllocatedTotal = useMemo(
    () =>
      incompleteInvestments.reduce(
        (sum, inv) => sum + (Number(inv.allocated_amount) || 0),
        0,
      ),
    [incompleteInvestments],
  );

  if (loading) return <LoadingState label="Chargement catégorie…" />;
  if (error) return <ErrorAlert message={error} />;
  if (!data) return null;

  const { asset_class: ac, stats } = data;
  const currency = stats.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/investissements/categories"
            className="text-xs font-medium text-[var(--sf-green)] hover:underline"
          >
            ← Catégories
          </Link>
          <h2 className="mt-1 text-xl font-semibold text-[var(--sf-green-deep)]">{ac.label}</h2>
          <p className="text-sm text-[var(--sf-green)]/55">{ac.description || ac.slug}</p>
        </div>
        {canWrite ? (
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-gold)]"
          >
            {showForm ? "Annuler" : "+ Nouvel investissement"}
          </button>
        ) : null}
      </div>

      <div className="h-1.5 w-full max-w-xs rounded-full" style={{ backgroundColor: color }} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <DashboardKpi
          label="Positions"
          value={String(stats.investment_count)}
          hint={`${stats.active_count ?? stats.investment_count} active(s)`}
        />
        <DashboardKpi
          label="Capital investi"
          moneyAmount={stats.total_invested}
        />
        <DashboardKpi
          label="Valeur actuelle"
          moneyAmount={stats.total_current_value}
          hint={
            stats.performance_percent != null
              ? `${stats.performance_percent >= 0 ? "+" : ""}${stats.performance_percent} %`
              : undefined
          }
        />
        <DashboardKpi
          label="Alloué aux dossiers"
          moneyAmount={stats.total_allocated ?? "0"}
          hint={`${stats.dossier_count ?? 0} dossier(s) · ${Math.round(stats.allocation_progress_percent ?? 0)} %`}
        />
        <DashboardKpi
          label="Reste à allouer"
          moneyAmount={stats.unallocated_amount ?? "0"}
          hint={
            (stats.incomplete_allocation_count ?? 0) > 0
              ? `${stats.incomplete_allocation_count} investissement(s) incomplet(s)`
              : "Allocation complète"
          }
          accent={(Number(stats.unallocated_amount) || 0) > 0 ? "gold" : "default"}
        />
        <DashboardKpi
          label="Plus-value latente"
          moneyAmount={stats.latent_gain}
          hint={`Gains ${formatMoney(stats.total_gains, currency)}`}
          accent={Number(stats.latent_gain) >= 0 ? "default" : "muted"}
        />
        <DashboardKpi
          label="Pertes latentes"
          moneyAmount={stats.total_losses}
          accent="muted"
        />
        <DashboardKpi
          label="Allocations complètes"
          value={String(stats.complete_allocation_count ?? 0)}
          hint={`Sur ${stats.investment_count} position(s)`}
        />
        <DashboardKpi
          label="Allocations incomplètes"
          value={String(stats.incomplete_allocation_count ?? 0)}
          hint={
            (stats.incomplete_allocation_count ?? 0) > 0
              ? "À compléter"
              : "Tout est alloué"
          }
          accent={
            (stats.incomplete_allocation_count ?? 0) > 0 ? "gold" : "default"
          }
        />
        <DashboardKpi
          label="Poids cible PIGFI"
          value={`${stats.target_weight_min}–${stats.target_weight_max} %`}
          hint="Fourchette recommandée"
          accent="muted"
        />
      </div>

      {showForm && canWrite ? (
        <DashboardPanel title="Nouvel investissement" subtitle={`Catégorie ${ac.label}`}>
          <InvestmentCreateWizard
            initialAssetClassId={ac.id}
            assetClasses={[ac]}
            cases={data.cases.map((c) => ({
              id: c.id,
              reference: c.reference,
              title: c.title,
            }))}
            onCreated={() => {
              setShowForm(false);
              load();
            }}
            onCancel={() => setShowForm(false)}
          />
        </DashboardPanel>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel
          title="Allocations à compléter"
          subtitle="Capital des investissements incomplets"
        >
          <div className="flex flex-wrap items-start gap-6">
            {incompleteAllocationSlices.length === 0 ? (
              <p className="py-8 text-sm text-[var(--sf-green)]/45">
                Aucun investissement incomplet dans cette catégorie.
              </p>
            ) : (
              <DonutChart
                slices={incompleteAllocationSlices}
                currency={currency}
                size={220}
                hideLegend
                centerLabel={formatMoney(String(incompleteCapitalTotal), currency)}
                centerHint="Capital concerné"
              />
            )}

            <div className="min-w-0 flex-1">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                Investissements non complets
                {incompleteAllocatedTotal > 0 ? (
                  <span className="ml-1 font-normal normal-case tracking-normal text-[var(--sf-green)]/40">
                    · {formatMoney(String(incompleteAllocatedTotal), currency)} déjà alloués
                  </span>
                ) : null}
              </p>
              {incompleteInvestments.length === 0 ? (
                <p className="py-4 text-sm text-[var(--sf-green)]/45">
                  Toutes les allocations de la catégorie sont complètes.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--sf-cream-dark)]">
                  {incompleteInvestments.map((inv) => {
                    const progress = inv.allocation_progress_percent ?? 0;
                    const invColor =
                      incompleteInvestmentColors.get(inv.id) ?? sliceColor(0);
                    return (
                      <li key={inv.id} className="py-2.5 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-3">
                          <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-[var(--sf-green-deep)]">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: invColor }}
                              aria-hidden
                            />
                            <span className="truncate">{inv.label}</span>
                          </p>
                          <Link
                            href={`/investissements/liste/${inv.id}`}
                            className="shrink-0 text-xs font-medium text-[var(--sf-green)] hover:underline"
                          >
                            Compléter →
                          </Link>
                        </div>
                        <p className="mt-0.5 text-xs tabular-nums text-[var(--sf-green)]/55">
                          {formatMoney(inv.allocated_amount ?? "0", currency)} /{" "}
                          {formatMoney(inv.amount_invested, currency)} ·{" "}
                          {Math.round(progress)} % alloué
                        </p>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--sf-cream)]">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, progress)}%`,
                              backgroundColor: invColor,
                            }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </DashboardPanel>

        <DashboardPanel title="Évolution" subtitle={`Investissements ${ac.label}`}>
          <PatrimonyEvolutionChart series={evolutionSeries} currency={currency} />
        </DashboardPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel
          title="Investissements en cours"
          subtitle={`${data.investments.length} position(s)`}
        >
          {data.investments.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--sf-green)]/45">
              Aucun investissement dans cette catégorie.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--sf-cream-dark)]">
              {data.investments.map((inv) => {
                const gain = Number(inv.latent_gain ?? 0);
                return (
                  <li key={inv.id} className="py-3 first:pt-0 last:pb-0">
                    <p className="font-medium text-[var(--sf-green-deep)]">{inv.label}</p>
                    <p className="text-xs text-[var(--sf-green)]/50">
                      {inv.case_reference || "Sans dossier"} · {INVESTMENT_STATUS_LABELS[inv.status] ?? inv.status}
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-emerald-900">
                      {formatMoney(inv.current_value, currency)}
                      <span
                        className={`ml-2 text-xs ${gain >= 0 ? "text-emerald-600" : "text-red-600"}`}
                      >
                        ({gain >= 0 ? "+" : ""}
                        {formatMoney(String(gain), currency)})
                      </span>
                    </p>
                    <p className="text-xs text-[var(--sf-green)]/45">{formatDate(inv.start_date)}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </DashboardPanel>
      </div>
    </div>
  );
}
