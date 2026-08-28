"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import {
  DashboardKpi,
  DashboardPanel,
  DonutChart,
  PatrimonyEvolutionChart,
} from "@/components/investments/investment-charts";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { INVESTMENT_STATUS_LABELS, assetClassColor } from "@/lib/investment-labels";
import { CASE_TYPE_LABELS, formatDate, formatMoney } from "@/lib/labels";
import type { InvestmentsGlobalDashboard } from "@/types/api";

export default function InvestissementsDashboardPage() {
  const [data, setData] = useState<InvestmentsGlobalDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assetClassFilter, setAssetClassFilter] = useState("");

  useEffect(() => {
    apiRequest<InvestmentsGlobalDashboard>("/investments/dashboard/")
      .then(setData)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, []);

  const distributionSlices = useMemo(() => {
    if (!data) return [];
    return data.distribution.map((s, i) => ({
      ...s,
      color:
        s.code === "non-investi"
          ? "#CBD5E1"
          : assetClassColor(s.code ?? "", i),
    }));
  }, [data]);

  const activeInvestments = useMemo(
    () => data?.management_investments.filter((i) => i.status === "ACTIVE") ?? [],
    [data],
  );

  if (loading) return <LoadingState label="Chargement tableau de bord…" />;
  if (error) return <ErrorAlert message={error} />;
  if (!data) return null;

  const { stats, totals } = data;
  const currency = stats.currency;
  const hasPlannedEnvelope = Number(stats.total_planned_envelope ?? 0) > 0;
  const remainingPlanned = stats.remaining_planned_envelope ?? stats.uninvested_amount;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <DashboardKpi
          label="Somme à investir"
          value={
            hasPlannedEnvelope
              ? formatMoney(stats.total_planned_envelope, currency)
              : "—"
          }
          hint="Somme des enveloppes définies en Gestion (dossier → Finance)"
        />
        <DashboardKpi
          label="Capital investi"
          value={formatMoney(stats.total_invested, currency)}
          hint={`${totals.investment_count} position(s) ouverte(s)`}
        />
        <DashboardKpi
          label="Valeur actuelle"
          value={formatMoney(stats.total_current_value, currency)}
          hint={`Plus-value ${formatMoney(stats.latent_gain, currency)}`}
        />
        <DashboardKpi
          label="Dossiers S1 / S2"
          value={String(totals.case_count)}
          hint="Mandats & tutelles éligibles"
        />
        <DashboardKpi
          label="Gains latents"
          value={formatMoney(stats.total_gains, currency)}
          hint="Positions en plus-value"
          accent="default"
        />
        <DashboardKpi
          label="Pertes latentes"
          value={formatMoney(stats.total_losses, currency)}
          hint="Positions en moins-value"
          accent="muted"
        />
        <DashboardKpi
          label="Reste à investir"
          value={
            hasPlannedEnvelope
              ? formatMoney(remainingPlanned, currency)
              : formatMoney(stats.uninvested_amount, currency)
          }
          hint={
            hasPlannedEnvelope
              ? "Enveloppes Gestion moins capital déjà investi"
              : "Patrimoine disponible (aucune enveloppe Gestion)"
          }
          accent="muted"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DashboardPanel
          title="Répartition du patrimoine"
          subtitle="Investi par catégorie + part non investie"
        >
          {distributionSlices.length > 0 ? (
            <DonutChart slices={distributionSlices} currency={currency} />
          ) : (
            <p className="py-8 text-center text-sm text-[var(--sf-green)]/45">
              Valorisez le patrimoine des dossiers pour afficher la répartition.
            </p>
          )}
        </DashboardPanel>

        <DashboardPanel
          title="Évolution par catégorie"
          subtitle="Cumul des investissements par classe d'actif"
        >
          <PatrimonyEvolutionChart
            series={data.patrimony_evolution_by_asset_class ?? []}
            assetClassFilter={assetClassFilter}
            onAssetClassFilterChange={setAssetClassFilter}
            assetClasses={data.asset_classes.map((c) => ({
              slug: c.slug,
              label: c.label,
            }))}
            currency={currency}
          />
        </DashboardPanel>
      </div>

      <DashboardPanel
        title="Investissements en cours"
        subtitle={`${activeInvestments.length} actif(s) sur ${data.management_investments.length}`}
        action={
          <Link
            href="/investissements/liste"
            className="text-xs font-medium text-[var(--sf-green)] hover:underline"
          >
            Tout voir →
          </Link>
        }
      >
        {data.management_investments.length === 0 ? (
          <p className="py-6 text-center text-sm text-[var(--sf-green)]/45">
            Aucun investissement. Créez-en un depuis une{" "}
            <Link href="/investissements/categories" className="underline">
              catégorie
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-[var(--sf-cream-dark)]">
            {data.management_investments.slice(0, 12).map((inv) => {
              const gain = Number(inv.latent_gain ?? 0);
              return (
                <li
                  key={inv.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--sf-green-deep)]">{inv.label}</p>
                    <p className="text-xs text-[var(--sf-green)]/50">
                      {inv.case_reference || "Sans dossier"} · {inv.asset_class_label} ·{" "}
                      {INVESTMENT_STATUS_LABELS[inv.status] ?? inv.status}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-mono font-medium text-emerald-900">
                      {formatMoney(inv.current_value, currency)}
                    </p>
                    <p
                      className={`text-xs tabular-nums ${gain >= 0 ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {gain >= 0 ? "+" : ""}
                      {formatMoney(String(gain), currency)} · {formatDate(inv.start_date)}
                    </p>
                  </div>
                  <Link
                    href={`/dossiers/${inv.case_id}/finance`}
                    className="rounded-lg border border-[var(--sf-green)]/25 px-3 py-1.5 text-xs font-medium text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]/40"
                  >
                    Dossier
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DashboardPanel>

      <DashboardPanel title="Dossiers éligibles" subtitle="Accès finance PIGFI">
        <ul className="divide-y divide-[var(--sf-cream-dark)]">
          {data.cases.map((c) => (
            <li
              key={c.id}
              className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-[var(--sf-green-deep)]">{c.reference}</p>
                <p className="text-xs text-[var(--sf-green)]/50">
                  {c.title} · {CASE_TYPE_LABELS[c.case_type] ?? c.case_type}
                </p>
              </div>
              <div className="text-right text-xs">
                {c.planned_investment_amount ? (
                  <p className="font-mono text-[var(--sf-green-deep)]">
                    {formatMoney(c.planned_investment_amount, currency)} · Gestion
                  </p>
                ) : (
                  <p className="text-[var(--sf-green)]/45">Enveloppe non définie</p>
                )}
                <p className="font-mono text-emerald-900">{formatMoney(c.total_value, currency)} investi</p>
                <p className="text-[var(--sf-green)]/45">{c.investment_count} investissement(s)</p>
              </div>
              <Link
                href={`/dossiers/${c.id}/finance`}
                className="text-xs font-medium text-[var(--sf-green)] hover:underline"
              >
                Ouvrir →
              </Link>
            </li>
          ))}
        </ul>
      </DashboardPanel>
    </div>
  );
}
