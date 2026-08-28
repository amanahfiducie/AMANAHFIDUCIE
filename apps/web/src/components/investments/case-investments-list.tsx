"use client";

import Link from "next/link";

import { DashboardPanel, DonutChart } from "@/components/investments/investment-charts";
import { INVESTMENT_STATUS_LABELS } from "@/lib/investment-labels";
import { formatDate, formatMoney } from "@/lib/labels";
import type { CaseInvestmentDashboard, InvestmentRecord } from "@/types/api";

function sortInvestmentsNewestFirst(items: InvestmentRecord[]): InvestmentRecord[] {
  return [...items].sort((a, b) => {
    const da = a.start_date || "";
    const db = b.start_date || "";
    if (da !== db) return db.localeCompare(da);
    return b.id - a.id;
  });
}

export function CaseInvestmentsPreview({
  caseId,
  investments,
  limit = 5,
}: {
  caseId: number;
  investments: InvestmentRecord[];
  limit?: number;
}) {
  const sorted = sortInvestmentsNewestFirst(investments);
  const visible = sorted.slice(0, limit);
  const hasMore = sorted.length > limit;

  return (
    <DashboardPanel
      title="Investissements du dossier"
      subtitle={
        sorted.length === 0
          ? "Aucune position"
          : `${sorted.length} position(s) · ${limit} dernières`
      }
      action={
        <Link
          href={`/dossiers/${caseId}/finance/investissements`}
          className="text-xs font-medium text-[var(--sf-green)] hover:underline"
        >
          {hasMore || sorted.length > 0 ? "Voir tout →" : "Ouvrir →"}
        </Link>
      }
    >
      {visible.length === 0 ? (
        <div className="rounded-lg bg-[var(--sf-cream)]/25 px-4 py-6 text-center text-sm text-[var(--sf-green)]/50">
          Aucun investissement.{" "}
          <Link
            href="/investissements/categories"
            className="font-medium text-[var(--sf-green)] underline-offset-2 hover:underline"
          >
            Créer depuis les catégories
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--sf-cream-dark)]">
          {visible.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div>
                <p className="text-sm font-medium text-[var(--sf-green-deep)]">
                  {inv.label}
                </p>
                <p className="text-xs text-[var(--sf-green)]/50">
                  {inv.asset_class.label} ·{" "}
                  {INVESTMENT_STATUS_LABELS[inv.status] ?? inv.status} ·{" "}
                  {formatDate(inv.start_date)}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums text-emerald-900">
                {formatMoney(inv.current_value, inv.currency)}
              </p>
            </li>
          ))}
        </ul>
      )}
      {hasMore ? (
        <p className="mt-3 text-center text-xs text-[var(--sf-green)]/45">
          +{sorted.length - limit} autre(s) —{" "}
          <Link
            href={`/dossiers/${caseId}/finance/investissements`}
            className="font-medium text-[var(--sf-green)] hover:underline"
          >
            page dédiée
          </Link>
        </p>
      ) : null}
    </DashboardPanel>
  );
}

export function CaseInvestmentsFullList({
  caseId,
  investments,
  charts,
}: {
  caseId: number;
  investments: InvestmentRecord[];
  charts: CaseInvestmentDashboard["charts"];
}) {
  const sorted = sortInvestmentsNewestFirst(investments);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
            Investissements
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/55">
            Liste des placements réalisés avec les sommes versées (
            {sorted.length} position
            {sorted.length > 1 ? "s" : ""}).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dossiers/${caseId}/finance/versements`}
            className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-xs font-medium text-[var(--sf-green)]/70 hover:bg-[var(--sf-cream)]/40"
          >
            Versements clients
          </Link>
          <Link
            href={`/dossiers/${caseId}/finance/gestion`}
            className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-xs font-medium text-[var(--sf-green)]/70 hover:bg-[var(--sf-cream)]/40"
          >
            ← Gestion
          </Link>
          <Link
            href="/investissements/categories"
            className="rounded-lg bg-[var(--sf-green)] px-3 py-2 text-xs font-medium text-[var(--sf-gold)]"
          >
            + Nouvel investissement
          </Link>
        </div>
      </header>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-white px-4 py-10 text-center text-sm text-[var(--sf-green)]/50">
          Aucun investissement sur ce dossier.
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((inv) => {
            const shareData = charts.participant_shares.find(
              (s) => s.investment_id === inv.id,
            );
            return (
              <li
                key={inv.id}
                className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--sf-green-deep)]">
                      {inv.label}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                      {inv.asset_class.label} ·{" "}
                      {INVESTMENT_STATUS_LABELS[inv.status] ?? inv.status} ·{" "}
                      {formatDate(inv.start_date)}
                    </p>
                    {inv.reference ? (
                      <p className="mt-1 text-xs text-[var(--sf-green)]/40">
                        Réf. {inv.reference}
                      </p>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="text-base font-semibold tabular-nums text-emerald-900">
                      {formatMoney(inv.current_value, inv.currency)}
                    </p>
                    <p className="text-xs text-[var(--sf-green)]/45">
                      Investi {formatMoney(inv.amount_invested, inv.currency)}
                    </p>
                  </div>
                </div>
                {shareData && shareData.participants.length > 0 ? (
                  <div className="mt-4 border-t border-[var(--sf-cream-dark)] pt-4">
                    <p className="mb-2 text-xs font-medium text-[var(--sf-green)]/55">
                      Répartition clients
                    </p>
                    <DonutChart
                      size={160}
                      slices={shareData.participants.map((p) => ({
                        label: p.beneficiary_name,
                        amount: p.amount,
                        percent: p.percent,
                      }))}
                    />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
