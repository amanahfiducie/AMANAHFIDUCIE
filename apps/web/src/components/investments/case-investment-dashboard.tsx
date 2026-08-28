"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  AllocationStackedBar,
  DashboardKpi,
  DashboardPanel,
  DonutChart,
  PatrimonyEvolutionChart,
  SemiCircleGauge,
} from "@/components/investments/investment-charts";
import { useCaseInvestmentData } from "@/components/investments/use-case-investment-data";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import {
  ASSET_CLASS_SLUG_LABELS,
  INVESTMENT_STATUS_LABELS,
  assetClassColor,
  sortAssetClassSlugs,
} from "@/lib/investment-labels";
import { formatDate, formatMoney } from "@/lib/labels";
import type { CaseInvestmentDashboard, FinancialSummary } from "@/types/api";

type Props = {
  caseId: number;
  showFinanceSummary?: boolean;
};

export function CaseInvestmentDashboardView({
  caseId,
  showFinanceSummary = true,
}: Props) {
  const { dashboard, catalog, finance, loading, error } = useCaseInvestmentData(
    caseId,
    showFinanceSummary,
  );
  const [assetClassFilter, setAssetClassFilter] = useState("");

  const allocationRows = useMemo(() => {
    if (!dashboard) return [];
    const planned = Number(dashboard.policy.planned_investment_amount) || 0;
    const investedBySlug: Record<string, number> = {};
    for (const inv of dashboard.investments) {
      if (inv.status === "CLOSED") continue;
      const slug = inv.asset_class.slug;
      investedBySlug[slug] =
        (investedBySlug[slug] ?? 0) + (Number(inv.amount_invested) || 0);
    }
    const slugs = sortAssetClassSlugs([
      ...new Set([
        ...Object.keys(dashboard.summary.allocation_target),
        ...Object.keys(investedBySlug),
      ]),
    ]);
    return slugs.map((slug) => {
      const target = dashboard.summary.allocation_target[slug] ?? 0;
      const targetAmount = planned > 0 ? (planned * target) / 100 : 0;
      const investedAmount = investedBySlug[slug] ?? 0;
      const remainingAmount = Math.max(targetAmount - investedAmount, 0);
      return {
        slug,
        label: ASSET_CLASS_SLUG_LABELS[slug] ?? slug,
        target,
        targetAmount,
        investedAmount,
        remainingAmount,
      };
    });
  }, [dashboard]);

  const policyTargetSlices = useMemo(() => {
    if (!dashboard) return [];
    const targets = dashboard.policy.patrimony_category.allocation_targets ?? {};
    const planned = Number(dashboard.policy.planned_investment_amount) || 0;
    const slugs = sortAssetClassSlugs(
      Object.entries(targets)
        .filter(([, percent]) => Number(percent) > 0)
        .map(([slug]) => slug),
    );
    return slugs.map((slug) => {
      const percent = Number(targets[slug]) || 0;
      return {
        label: ASSET_CLASS_SLUG_LABELS[slug] ?? slug,
        percent,
        amount:
          planned > 0 ? String((planned * percent) / 100) : undefined,
        color: assetClassColor(slug),
        code: slug,
      };
    });
  }, [dashboard]);

  if (loading) return <LoadingState label="Chargement tableau de bord…" />;
  if (error && !dashboard) return <ErrorAlert message={error} />;
  if (!dashboard || !catalog) return null;

  const { policy, summary, investments, watchlist, charts } = dashboard;

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardKpi
          label="Patrimoine investi"
          value={formatMoney(summary.total_value, "XOF")}
          hint={
            policy.planned_investment_amount
              ? `${summary.asset_count} position(s) · À investir ${formatMoney(policy.planned_investment_amount, "XOF")}`
              : `${summary.asset_count} position(s) active(s)`
          }
        />
        <DashboardKpi
          label="Rendement annuel"
          value={
            summary.annual_yield_percent != null
              ? `${summary.annual_yield_percent.toFixed(1)} %`
              : "—"
          }
          hint={`Cible ${policy.patrimony_category.target_yield_min}–${policy.patrimony_category.target_yield_max} %`}
        />
        <DashboardKpi
          label="Revenus distribués"
          value={formatMoney(summary.distributed_income, "XOF")}
          hint={`Plus-value ${formatMoney(summary.latent_gain, "XOF")}`}
        />
        <DashboardKpi
          label="Conformité charaïque"
          value={
            summary.sharia_compliance_score != null
              ? `${summary.sharia_compliance_score.toFixed(0)} / 100`
              : "—"
          }
          hint={
            summary.watchlist_count > 0
              ? `${summary.watchlist_count} alerte(s)`
              : "Aucune alerte"
          }
        />
      </div>

      {showFinanceSummary && finance && finance.account_count > 0 ? (
        <DashboardKpi
          label="Liquidités fiduciaires disponibles"
          value={formatMoney(finance.total_balance, finance.currency)}
          hint={`${finance.account_count} compte(s) séquestre`}
          accent="muted"
        />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel
          title="Évolution du patrimoine"
          subtitle="Par catégorie d'investissement"
        >
          <PatrimonyEvolutionChart
            series={charts.patrimony_evolution_by_asset_class ?? []}
            assetClassFilter={assetClassFilter}
            onAssetClassFilterChange={setAssetClassFilter}
            assetClasses={catalog.asset_classes.map((c) => ({
              slug: c.slug,
              label: c.label,
            }))}
            currency={charts.invested_vs_available.currency}
          />
        </DashboardPanel>

        <DashboardPanel title="Taux d'investissement" subtitle="Investi vs capital disponible">
          <SemiCircleGauge
            investedPercent={charts.invested_vs_available.invested_percent}
            investedAmount={charts.invested_vs_available.invested_amount}
            availableAmount={charts.invested_vs_available.available_amount}
            currency={charts.invested_vs_available.currency}
          />
        </DashboardPanel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel title="Politique PIGFI" subtitle={policy.management_profile.label}>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-[var(--sf-green)]/55">Type d&apos;investissement</dt>
              <dd className="font-medium text-[var(--sf-green-deep)]">
                {policy.patrimony_category.code} — {policy.patrimony_category.label}
              </dd>
            </div>
            {policy.planned_investment_amount ? (
              <div>
                <dt className="text-[var(--sf-green)]/55">Somme à investir</dt>
                <dd className="font-medium tabular-nums">
                  {formatMoney(policy.planned_investment_amount, "XOF")}
                </dd>
                <dd className="text-xs text-[var(--sf-green)]/45">
                  Définie en{" "}
                  <Link href={`/dossiers/${caseId}/finance/gestion`} className="underline">
                    Gestion
                  </Link>
                </dd>
              </div>
            ) : (
              <div>
                <dt className="text-[var(--sf-green)]/55">Somme à investir</dt>
                <dd className="text-sm text-[var(--sf-green)]/50">
                  Non définie —{" "}
                  <Link href={`/dossiers/${caseId}/finance/gestion`} className="underline">
                    paramétrer en Gestion
                  </Link>
                </dd>
              </div>
            )}
            {policy.amanah_management_share_percent ? (
              <div>
                <dt className="text-[var(--sf-green)]/55">Part AMANAH gestion</dt>
                <dd className="font-medium">{policy.amanah_management_share_percent} %</dd>
              </div>
            ) : null}
          </dl>

          {policyTargetSlices.length > 0 ? (
            <div className="mt-5 border-t border-[var(--sf-cream-dark)] pt-4">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                Répartition du patrimoine — type {policy.patrimony_category.code}
              </p>
              <DonutChart
                slices={policyTargetSlices}
                size={180}
                centerLabel={policy.patrimony_category.code}
                centerHint="Type actuel"
              />
            </div>
          ) : null}
        </DashboardPanel>

        {allocationRows.length > 0 ? (
          <DashboardPanel
            title="Classes d'actifs"
            subtitle="Investi vs reste à investir par catégorie"
          >
            <AllocationStackedBar segments={allocationRows} />
          </DashboardPanel>
        ) : null}
      </div>

      <DashboardPanel
        title="Positions ouvertes"
        subtitle={`${investments.length} investissement(s)`}
        action={
          <Link
            href={`/dossiers/${caseId}/finance/gestion`}
            className="text-xs font-medium text-[var(--sf-green)] hover:underline"
          >
            Gérer →
          </Link>
        }
      >
        {investments.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--sf-green)]/45">
            Aucun investissement. Paramétrez la gestion dans l&apos;onglet{" "}
            <Link href={`/dossiers/${caseId}/finance/gestion`} className="underline">
              Gestion
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-[var(--sf-cream-dark)]">
            {investments.slice(0, 5).map((inv) => (
              <li key={inv.id} className="flex justify-between gap-3 py-2.5 first:pt-0">
                <div>
                  <p className="text-sm font-medium text-[var(--sf-green-deep)]">{inv.label}</p>
                  <p className="text-xs text-[var(--sf-green)]/50">
                    {inv.asset_class.label} · {INVESTMENT_STATUS_LABELS[inv.status] ?? inv.status}
                  </p>
                </div>
                <p className="text-sm font-medium tabular-nums text-emerald-900">
                  {formatMoney(inv.current_value, inv.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DashboardPanel>

      {watchlist.length > 0 ? (
        <DashboardPanel title="Actifs à surveiller" subtitle="Conformité charaïque">
          <ul className="space-y-1 text-sm text-amber-900">
            {watchlist.map((item) => (
              <li key={item.id}>
                {item.label} — {item.reason}
              </li>
            ))}
          </ul>
        </DashboardPanel>
      ) : null}
    </div>
  );
}
