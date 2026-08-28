"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";

import { DashboardPanel } from "@/components/investments/investment-charts";
import {
  allocationProgressStyle,
  InvestmentCreateWizard,
} from "@/components/investments/investment-create-wizard";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { INVESTMENT_STATUS_LABELS } from "@/lib/investment-labels";
import { formatDate, formatMoney } from "@/lib/labels";
import { userCanWriteCase } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { InvestmentsManagement, ManagementInvestment } from "@/types/api";

export default function InvestissementsListePage() {
  const { user } = useAuth();
  const canWrite = userCanWriteCase(user);
  const [data, setData] = useState<InvestmentsManagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categorySlug, setCategorySlug] = useState("");
  const [showWizard, setShowWizard] = useState(false);
  const [completing, setCompleting] = useState<ManagementInvestment | null>(
    null,
  );

  function load() {
    setLoading(true);
    apiRequest<InvestmentsManagement>("/investments/management/")
      .then(setData)
      .catch((err) =>
        setError(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger les investissements.",
        ),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    if (!data) return [];
    const fromCatalog = data.asset_classes.map((c) => ({
      slug: c.slug,
      label: c.label,
    }));
    if (fromCatalog.length > 0) return fromCatalog;

    const bySlug = new Map<string, string>();
    for (const inv of data.management_investments) {
      if (inv.asset_class_slug) {
        bySlug.set(inv.asset_class_slug, inv.asset_class_label);
      }
    }
    return Array.from(bySlug.entries())
      .map(([slug, label]) => ({ slug, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    const items = data.management_investments;
    if (!categorySlug) return items;
    return items.filter((inv) => inv.asset_class_slug === categorySlug);
  }, [data, categorySlug]);

  if (loading && !data) return <LoadingState label="Chargement…" />;
  if (error && !data) return <ErrorAlert message={error} />;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
            Liste des investissements
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/55">
            {filtered.length} position
            {filtered.length > 1 ? "s" : ""}
            {categorySlug
              ? ` · ${categories.find((c) => c.slug === categorySlug)?.label ?? categorySlug}`
              : ` · ${data.management_investments.length} au total`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-[var(--sf-green)]/55">
              Filtrer par catégorie
            </span>
            <select
              value={categorySlug}
              onChange={(e) => setCategorySlug(e.target.value)}
              className="min-w-[14rem] rounded-lg border border-[var(--sf-cream-dark)] bg-white px-3.5 py-2.5 text-sm text-[var(--sf-green-deep)] outline-none transition focus:border-[var(--sf-green)]/40 focus:ring-2 focus:ring-[var(--sf-green)]/10"
            >
              <option value="">Toutes les catégories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          {canWrite ? (
            <button
              type="button"
              onClick={() => {
                setCompleting(null);
                setShowWizard(true);
              }}
              className="rounded-lg bg-[var(--sf-green)] px-4 py-2.5 text-sm font-medium text-[var(--sf-gold)]"
            >
              + Nouvel investissement
            </button>
          ) : null}
        </div>
      </header>

      <DashboardPanel
        title="Investissements"
        subtitle={
          categorySlug
            ? `Filtre : ${categories.find((c) => c.slug === categorySlug)?.label ?? categorySlug}`
            : "Toutes catégories"
        }
      >
        {filtered.length === 0 ? (
          <div className="rounded-lg bg-[var(--sf-cream)]/25 px-4 py-10 text-center text-sm text-[var(--sf-green)]/45">
            {data.management_investments.length === 0 ? (
              <>
                Aucun investissement.
                {canWrite ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => setShowWizard(true)}
                      className="font-medium text-[var(--sf-green)] underline-offset-2 hover:underline"
                    >
                      Créer le premier
                    </button>
                  </>
                ) : null}
              </>
            ) : (
              <>
                Aucun investissement dans cette catégorie.{" "}
                <button
                  type="button"
                  onClick={() => setCategorySlug("")}
                  className="font-medium text-[var(--sf-green)] underline-offset-2 hover:underline"
                >
                  Voir toutes
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--sf-cream-dark)] text-xs uppercase tracking-wide text-[var(--sf-green)]/45">
                  <th className="pb-3 pr-3 font-medium">Investissement</th>
                  <th className="pb-3 pr-3 font-medium">Catégorie</th>
                  <th className="pb-3 pr-3 font-medium">Montant</th>
                  <th className="pb-3 pr-3 font-medium">Allocation</th>
                  <th className="pb-3 pr-3 font-medium">Statut</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sf-cream-dark)]">
                {filtered.map((inv) => (
                  <InvestmentRow
                    key={inv.id}
                    inv={inv}
                    canWrite={canWrite}
                    onComplete={() => {
                      setCompleting(inv);
                      setShowWizard(true);
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </DashboardPanel>

      {showWizard ? (
        <CreateInvestmentModal
          cases={data.cases}
          assetClasses={data.asset_classes}
          existingInvestment={completing}
          onClose={() => {
            setShowWizard(false);
            setCompleting(null);
          }}
          onCreated={() => {
            setShowWizard(false);
            setCompleting(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}

function InvestmentRow({
  inv,
  canWrite,
  onComplete,
}: {
  inv: ManagementInvestment;
  canWrite: boolean;
  onComplete: () => void;
}) {
  const progress = inv.allocation_progress_percent ?? 100;
  const complete = inv.is_allocation_complete ?? true;
  const allocated = Number(inv.allocated_amount ?? inv.amount_invested) || 0;

  return (
    <tr className="align-top hover:bg-[var(--sf-cream)]/20">
      <td className="py-3.5 pr-3">
        <p className="font-medium text-[var(--sf-green-deep)]">{inv.label}</p>
        <p className="mt-0.5 text-xs text-[var(--sf-green)]/45">
          {formatDate(inv.start_date)}
        </p>
      </td>
      <td className="py-3.5 pr-3 text-[var(--sf-green)]/70">
        {inv.asset_class_label}
      </td>
      <td className="py-3.5 pr-3 tabular-nums text-[var(--sf-green)]/80">
        {formatMoney(inv.amount_invested, "XOF")}
      </td>
      <td className="py-3.5 pr-3">
        <div className="min-w-[8rem]">
          <div className="mb-1 flex justify-between text-[10px] text-[var(--sf-green)]/50">
            <span>{Math.round(progress)} %</span>
            <span>
              {formatMoney(String(allocated), "XOF")}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-[var(--sf-cream)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, progress)}%`,
                ...allocationProgressStyle(progress),
              }}
            />
          </div>
          <p
            className="mt-1 text-[10px] font-medium"
            style={{ color: allocationProgressStyle(progress).backgroundColor }}
          >
            {complete ? "Complet" : "À compléter"}
          </p>
        </div>
      </td>
      <td className="py-3.5 pr-3">
        <span className="inline-flex rounded-full bg-[var(--sf-cream)] px-2 py-0.5 text-xs font-medium text-[var(--sf-green-deep)]">
          {INVESTMENT_STATUS_LABELS[inv.status] ?? inv.status}
        </span>
      </td>
      <td className="py-3.5">
        <div className="flex flex-col gap-1">
          {!complete && canWrite ? (
            <button
              type="button"
              onClick={onComplete}
              className="rounded-md px-2 py-1 text-left text-xs font-medium text-white"
              style={allocationProgressStyle(progress)}
            >
              Compléter
            </button>
          ) : null}
          <Link
            href={`/investissements/liste/${inv.id}`}
            className="text-xs font-medium text-[var(--sf-green)] hover:underline"
          >
            Détail
          </Link>
        </div>
      </td>
    </tr>
  );
}

function CreateInvestmentModal({
  cases,
  assetClasses,
  existingInvestment,
  onClose,
  onCreated,
}: {
  cases: InvestmentsManagement["cases"];
  assetClasses: InvestmentsManagement["asset_classes"];
  existingInvestment: ManagementInvestment | null;
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
        className="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-xl sm:p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2
              id={titleId}
              className="text-base font-semibold text-[var(--sf-green-deep)] sm:text-lg"
            >
              {existingInvestment
                ? "Compléter l'allocation"
                : "Nouvel investissement"}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
              {existingInvestment
                ? "Ajoutez des dossiers clients pour finaliser l'enveloppe."
                : "Enregistrez sans dossier si besoin — la couleur indique la progression."}
            </p>
          </div>
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
          existingInvestment={existingInvestment}
          onCancel={onClose}
          onCreated={onCreated}
        />
      </div>
    </div>
  );
}
