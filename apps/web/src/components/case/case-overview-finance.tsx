"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  AllocationStackedBar,
  DashboardPanel,
  DonutChart,
  SemiCircleGauge,
} from "@/components/investments/investment-charts";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import {
  ASSET_CLASS_SLUG_LABELS,
  assetClassColor,
  caseSupportsFinance,
  caseSupportsInvestments,
  NON_INVESTED_COLOR,
  sortAssetClassSlugs,
} from "@/lib/investment-labels";
import { formatMoney } from "@/lib/labels";
import { userCanViewCaseFinanceTab } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type {
  CaseInvestmentDashboard,
  FinancialSummary,
} from "@/types/api";

/** Bloc finance sur la vue d'ensemble — type, répartitions, investi vs non investi. */
export function CaseOverviewFinanceSection({
  caseId,
  caseType,
}: {
  caseId: number;
  caseType: string | undefined;
}) {
  const { user } = useAuth();
  const show =
    userCanViewCaseFinanceTab(user) && caseSupportsFinance(caseType);
  const withInvestments = caseSupportsInvestments(caseType);

  const [finance, setFinance] = useState<FinancialSummary | null>(null);
  const [invest, setInvest] = useState<CaseInvestmentDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const requests: Promise<unknown>[] = [
          apiRequest<FinancialSummary>(
            `/cases/${caseId}/financial-summary/`,
          ).catch(() => null),
        ];
        if (withInvestments) {
          requests.push(
            apiRequest<CaseInvestmentDashboard>(
              `/cases/${caseId}/investment-dashboard/`,
            ).catch(() => null),
          );
        }
        const results = await Promise.all(requests);
        if (cancelled) return;
        setFinance(results[0] as FinancialSummary | null);
        if (withInvestments) {
          setInvest(results[1] as CaseInvestmentDashboard | null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Impossible de charger la finance du dossier.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [show, caseId, withInvestments]);

  const policyTargetSlices = useMemo(() => {
    if (!invest) return [];
    const targets = invest.policy.patrimony_category.allocation_targets ?? {};
    const planned = Number(invest.policy.planned_investment_amount) || 0;
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
  }, [invest]);

  const allocationRows = useMemo(() => {
    if (!invest) return [];
    const planned = Number(invest.policy.planned_investment_amount) || 0;
    const investedBySlug: Record<string, number> = {};
    for (const inv of invest.investments) {
      if (inv.status === "CLOSED") continue;
      const slug = inv.asset_class.slug;
      investedBySlug[slug] =
        (investedBySlug[slug] ?? 0) + (Number(inv.amount_invested) || 0);
    }
    const slugs = sortAssetClassSlugs([
      ...new Set([
        ...Object.keys(invest.summary.allocation_target),
        ...Object.keys(investedBySlug),
      ]),
    ]);
    return slugs.map((slug) => {
      const target = invest.summary.allocation_target[slug] ?? 0;
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
  }, [invest]);

  const investedByCategorySlices = useMemo(() => {
    if (!invest) return [];
    const { available_amount, estimated_uninvested } =
      invest.charts.invested_vs_available;
    const available =
      Number(available_amount) || Number(estimated_uninvested) || 0;

    const bySlug: Record<string, number> = {};
    for (const inv of invest.investments) {
      if (inv.status === "CLOSED") continue;
      const slug = inv.asset_class.slug;
      const amount =
        Number(inv.current_value) || Number(inv.amount_invested) || 0;
      if (amount <= 0) continue;
      bySlug[slug] = (bySlug[slug] ?? 0) + amount;
    }

    const categorySlices = sortAssetClassSlugs(Object.keys(bySlug))
      .filter((slug) => (bySlug[slug] ?? 0) > 0)
      .map((slug) => ({
        label: ASSET_CLASS_SLUG_LABELS[slug] ?? slug,
        amount: String(bySlug[slug]),
        percent: 0,
        color: assetClassColor(slug),
        code: slug,
      }));

    if (available > 0) {
      categorySlices.push({
        label: "Non investi",
        amount: String(available),
        percent: 0,
        color: NON_INVESTED_COLOR,
        code: "non-investi",
      });
    }

    return categorySlices;
  }, [invest]);

  if (!show) return null;

  const base = `/dossiers/${caseId}/finance`;
  const policy = invest?.policy;
  const charts = invest?.charts;
  const currency = finance?.currency ?? charts?.invested_vs_available.currency ?? "XOF";

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
            Finance & investissements
          </h2>
          <p className="mt-0.5 text-sm text-[var(--sf-green)]/55">
            Type, répartitions et part investie de ce dossier.
          </p>
        </div>
        <Link
          href={base}
          className="text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
        >
          Ouvrir la finance →
        </Link>
      </div>

      {loading ? <LoadingState label="Chargement finance…" /> : null}
      {error ? <ErrorAlert message={error} /> : null}

      {!loading && withInvestments && invest && policy && charts ? (
        <div className="space-y-4">
          {/* Type d'investissement */}
          <DashboardPanel
            title="Type d'investissement"
            subtitle={policy.management_profile.label}
            action={
              <Link
                href={`${base}/gestion`}
                className="text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
              >
                Gestion →
              </Link>
            }
          >
            <dl className="grid gap-3 sm:grid-cols-3 text-sm">
              <div>
                <dt className="text-[var(--sf-green)]/55">Catégorie patrimoniale</dt>
                <dd className="mt-0.5 font-semibold text-[var(--sf-green-deep)]">
                  {policy.patrimony_category.code} — {policy.patrimony_category.label}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--sf-green)]/55">Somme à investir</dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-[var(--sf-green-deep)]">
                  {policy.planned_investment_amount
                    ? formatMoney(policy.planned_investment_amount, currency)
                    : "Non définie"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--sf-green)]/55">Rendement cible</dt>
                <dd className="mt-0.5 font-semibold text-[var(--sf-green-deep)]">
                  {policy.patrimony_category.target_yield_min}–
                  {policy.patrimony_category.target_yield_max} %
                </dd>
              </div>
            </dl>
          </DashboardPanel>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Carte gauche : répartition cible en haut, puis investi / non investi */}
            <DashboardPanel
              title="Investi / non investi"
              subtitle="Répartition cible et positions actuelles"
            >
              <div className="mb-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                  Répartition cible — type {policy.patrimony_category.code}
                </p>
                {policyTargetSlices.length > 0 ? (
                  <DonutChart
                    slices={policyTargetSlices}
                    size={180}
                    currency={currency}
                    centerLabel={policy.patrimony_category.code}
                    centerHint="Type"
                  />
                ) : (
                  <p className="py-6 text-center text-sm text-[var(--sf-green)]/45">
                    Aucune répartition cible définie. Paramétrez le type en Gestion.
                  </p>
                )}
              </div>

              <div className="border-t border-[var(--sf-cream-dark)] pt-4">
                <SemiCircleGauge
                  investedPercent={charts.invested_vs_available.invested_percent}
                  investedAmount={charts.invested_vs_available.invested_amount}
                  availableAmount={charts.invested_vs_available.available_amount}
                  currency={charts.invested_vs_available.currency}
                />
                {investedByCategorySlices.length > 0 ? (
                  <div className="mt-4 border-t border-[var(--sf-cream-dark)] pt-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                      Détail par catégorie investie
                    </p>
                    <DonutChart
                      slices={investedByCategorySlices}
                      size={180}
                      currency={currency}
                      centerLabel={`${Math.round(charts.invested_vs_available.invested_percent)} %`}
                      centerHint="Investi"
                    />
                  </div>
                ) : (
                  <p className="mt-4 text-center text-sm text-[var(--sf-green)]/45">
                    Aucune catégorie investie pour le moment.
                  </p>
                )}
              </div>
            </DashboardPanel>

            {/* Carte droite : investi vs reste par catégorie */}
            <DashboardPanel
              title="Répartition cible"
              subtitle={`Investi vs reste à investir — type ${policy.patrimony_category.code}`}
            >
              {allocationRows.length > 0 ? (
                <AllocationStackedBar segments={allocationRows} />
              ) : (
                <p className="py-8 text-center text-sm text-[var(--sf-green)]/45">
                  Définissez une somme à investir et des positions pour voir le détail.
                </p>
              )}
            </DashboardPanel>
          </div>

          {finance && finance.account_count > 0 ? (
            <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 px-4 py-3 text-sm">
              <span className="text-[var(--sf-green)]/55">Liquidités fiduciaires : </span>
              <span className="font-semibold tabular-nums text-[var(--sf-green-deep)]">
                {formatMoney(finance.total_balance, finance.currency)}
              </span>
              <span className="text-[var(--sf-green)]/45">
                {" "}
                · {finance.account_count} compte
                {finance.account_count > 1 ? "s" : ""}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {!loading && !withInvestments ? (
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
          {finance && finance.account_count > 0 ? (
            <p className="text-sm text-[var(--sf-green-deep)]">
              Liquidités fiduciaires :{" "}
              <span className="font-semibold tabular-nums">
                {formatMoney(finance.total_balance, finance.currency)}
              </span>
            </p>
          ) : (
            <p className="text-sm text-[var(--sf-green)]/55">
              Ce type de dossier n&apos;a pas de volet investissements PIGFI.
            </p>
          )}
        </div>
      ) : null}

      {!loading && withInvestments && !invest && !error ? (
        <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/20 px-4 py-8 text-center text-sm text-[var(--sf-green)]/55">
          Finance non configurée.{" "}
          <Link
            href={`${base}/gestion`}
            className="font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Paramétrer en Gestion →
          </Link>
        </div>
      ) : null}
    </section>
  );
}
