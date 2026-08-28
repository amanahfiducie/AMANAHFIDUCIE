"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  CategoryTrendChart,
  EXPENSE_CATEGORY_COLORS,
  HorizontalBarChart,
  MonthlyTrendChart,
  ResultGauge,
  REVENUE_CATEGORY_COLORS,
} from "@/components/comptable/enterprise-finance-charts";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatMoney } from "@/lib/labels";
import type { EnterpriseFinancialSummary, EnterpriseMovement } from "@/types/api";

const CURRENT_YEAR = new Date().getFullYear();

export default function ComptableOverviewPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [summary, setSummary] = useState<EnterpriseFinancialSummary | null>(null);
  const [drafts, setDrafts] = useState<EnterpriseMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      apiRequest<EnterpriseFinancialSummary>(`/enterprise/summary/?year=${year}`),
      apiRequest<EnterpriseMovement[]>("/enterprise/movements/?status=DRAFT&limit=8"),
    ])
      .then(([s, m]) => {
        setSummary(s);
        setDrafts(m);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, [year]);

  const perf = summary?.performance;
  const revenueChartData = useMemo(
    () =>
      (perf?.revenue_by_service ?? []).map((row) => ({
        label: row.label,
        value: Number(row.total),
      })),
    [perf?.revenue_by_service],
  );
  const expenseChartData = useMemo(
    () =>
      (perf?.expense_by_category ?? []).map((row) => ({
        label: row.label,
        value: Number(row.total),
      })),
    [perf?.expense_by_category],
  );
  const monthlyTrendData = useMemo(
    () =>
      (perf?.monthly_trends ?? []).map((row) => ({
        label: row.label,
        revenue: Number(row.revenue),
        expense: Number(row.expense),
      })),
    [perf?.monthly_trends],
  );
  const revenueTrendSeries = useMemo(
    () =>
      (perf?.revenue_monthly_by_category ?? []).map((s) => ({
        label: s.label,
        values: s.values.map(Number),
      })),
    [perf?.revenue_monthly_by_category],
  );
  const expenseTrendSeries = useMemo(
    () =>
      (perf?.expense_monthly_by_category ?? []).map((s) => ({
        label: s.label,
        values: s.values.map(Number),
      })),
    [perf?.expense_monthly_by_category],
  );

  if (loading) return <LoadingState />;
  if (error) return <ErrorAlert message={error} />;
  if (!summary || !perf) return null;

  const resultPositive = Number(perf.resultat_net) >= 0;

  return (
    <div className="mt-6 space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-[var(--sf-green)]/70">
          Exercice
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="ml-2 rounded-lg border border-[var(--sf-cream-dark)] bg-white px-3 py-1.5 text-sm"
          >
            {[CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </label>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/50">
            Chiffre d&apos;affaires {perf.period_label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-emerald-800">
            {formatMoney(perf.chiffre_affaires, summary.currency)}
          </p>
          <p className="mt-1 text-[10px] text-[var(--sf-green)]/45">
            Issu des factures validées
          </p>
          <Link
            href="/factures"
            className="mt-2 inline-block text-xs text-[var(--sf-green-mid)] hover:underline"
          >
            Voir les factures →
          </Link>
        </div>
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/50">
            Dépenses {perf.period_label}
          </p>
          <p className="mt-2 text-2xl font-semibold text-red-800">
            {formatMoney(perf.total_depenses, summary.currency)}
          </p>
          <Link
            href="/comptable/depenses"
            className="mt-2 inline-block text-xs text-[var(--sf-green-mid)] hover:underline"
          >
            Voir les dépenses →
          </Link>
        </div>
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/50">
            Résultat net
          </p>
          <p
            className={`mt-2 text-2xl font-semibold ${resultPositive ? "text-emerald-800" : "text-red-800"}`}
          >
            {formatMoney(perf.resultat_net, summary.currency)}
          </p>
          <p className="mt-1 text-xs text-[var(--sf-green)]/50">
            {perf.movement_count} mouvement{perf.movement_count > 1 ? "s" : ""} approuvé
            {perf.movement_count > 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/50">
            Trésorerie
          </p>
          <p className="mt-2 text-2xl font-semibold text-[var(--sf-green-deep)]">
            {formatMoney(summary.total_balance, summary.currency)}
          </p>
          <p className="mt-1 text-xs text-[var(--sf-green)]/50">
            {summary.account_count} compte{summary.account_count > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      <ResultGauge
        revenue={Number(perf.chiffre_affaires)}
        expense={Number(perf.total_depenses)}
        net={Number(perf.resultat_net)}
        currency={summary.currency}
      />

      <MonthlyTrendChart
        title={`Évolution mensuelle ${year}`}
        subtitle="Recettes (factures validées) vs dépenses approuvées"
        data={monthlyTrendData}
        currency={summary.currency}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <HorizontalBarChart
          title={`Recettes par catégorie (${perf.period_label})`}
          subtitle="Services métier et lignes personnalisées"
          data={revenueChartData}
          currency={summary.currency}
          palette={REVENUE_CATEGORY_COLORS}
        />
        <HorizontalBarChart
          title={`Dépenses par catégorie (${perf.period_label})`}
          subtitle="Postes de charges et catégories ajoutées"
          data={expenseChartData}
          currency={summary.currency}
          palette={EXPENSE_CATEGORY_COLORS}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryTrendChart
          title={`Évolution des recettes (${year})`}
          subtitle="Montant mensuel par catégorie de recette"
          series={revenueTrendSeries}
          currency={summary.currency}
          palette={REVENUE_CATEGORY_COLORS}
        />
        <CategoryTrendChart
          title={`Évolution des dépenses (${year})`}
          subtitle="Montant mensuel par poste de charge"
          series={expenseTrendSeries}
          currency={summary.currency}
          palette={EXPENSE_CATEGORY_COLORS}
        />
      </div>

      {drafts.length > 0 ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--sf-green-deep)]">
            Brouillons à valider
          </h2>
          <ul className="space-y-2">
            {drafts.map((m) => (
              <li
                key={m.id}
                className="flex justify-between rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-2 text-sm"
              >
                <span>{m.description || m.category_label || m.movement_type}</span>
                <span className="font-mono">{formatMoney(m.amount, m.currency)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
