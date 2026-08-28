"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { DashboardPanel } from "@/components/investments/investment-charts";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { CASE_TYPE_LABELS } from "@/lib/labels";
import { userCanManageInvestmentCatalog } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { PatrimonyInvestmentCategory } from "@/types/api";

export default function TypesPatrimoniauxPage() {
  const { user } = useAuth();
  const canManage = userCanManageInvestmentCatalog(user);
  const [categories, setCategories] = useState<PatrimonyInvestmentCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<PatrimonyInvestmentCategory | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiRequest<PatrimonyInvestmentCategory[]>("/investments/patrimony-categories/")
      .then(setCategories)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!editing || !canManage) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await apiRequest<PatrimonyInvestmentCategory>(
        `/investments/patrimony-categories/${editing.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({
            label: editing.label,
            objective: editing.objective,
            target_yield_min: editing.target_yield_min,
            target_yield_max: editing.target_yield_max,
          }),
        },
      );
      setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditing(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <LoadingState label="Chargement types patrimoniaux…" />;
  if (error && categories.length === 0) return <ErrorAlert message={error} />;

  return (
    <div className="space-y-6">
      <DashboardPanel
        title="Types d'investissement patrimonial PIGFI"
        subtitle="Catégories A–D : profil de risque et rendement cible selon le mandat"
      >
        <p className="mb-4 text-sm text-[var(--sf-green)]/60">
          Chaque dossier S1/S2 est rattaché à un type (ex. tutelle → A mineurs). Les catégories
          concrètes (Immobilier, Or…) se gèrent dans{" "}
          <Link href="/investissements/categories" className="font-medium text-[var(--sf-green)] underline">
            Catégories
          </Link>
          .
        </p>

        {error ? <ErrorAlert message={error} /> : null}

        <div className="grid gap-4 md:grid-cols-2">
          {categories.map((cat) => (
            <article
              key={cat.id}
              className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/10 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sf-green)] text-sm font-bold text-[var(--sf-gold)]">
                    {cat.code}
                  </span>
                  <h3 className="mt-2 text-base font-semibold text-[var(--sf-green-deep)]">
                    {cat.label}
                  </h3>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium tabular-nums text-emerald-900">
                  {cat.target_yield_min}–{cat.target_yield_max} %
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--sf-green)]/70">{cat.objective}</p>
              {cat.default_case_types.length > 0 ? (
                <p className="mt-2 text-xs text-[var(--sf-green)]/45">
                  Dossiers :{" "}
                  {cat.default_case_types.map((t) => CASE_TYPE_LABELS[t] ?? t).join(", ")}
                </p>
              ) : null}
              <div className="mt-3">
                <p className="text-xs font-medium text-[var(--sf-green)]/55">
                  Allocation cible par catégorie
                </p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {Object.entries(cat.allocation_targets).map(([slug, pct]) => (
                    <li
                      key={slug}
                      className="rounded-md bg-white px-2 py-0.5 text-xs text-[var(--sf-green-deep)]"
                    >
                      {slug} {pct} %
                    </li>
                  ))}
                </ul>
              </div>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setEditing(cat)}
                  className="mt-4 text-xs font-medium text-[var(--sf-green)] hover:underline"
                >
                  Modifier
                </button>
              ) : null}
            </article>
          ))}
        </div>
      </DashboardPanel>

      {editing ? (
        <DashboardPanel title={`Modifier le type ${editing.code}`} subtitle={editing.label}>
          <form onSubmit={handleSave} className="grid max-w-xl gap-3 text-sm">
            <label className="block">
              <span className="text-[var(--sf-green)]/55">Libellé</span>
              <input
                required
                value={editing.label}
                onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
              />
            </label>
            <label className="block">
              <span className="text-[var(--sf-green)]/55">Objectif</span>
              <textarea
                required
                rows={3}
                value={editing.objective}
                onChange={(e) => setEditing({ ...editing, objective: e.target.value })}
                className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[var(--sf-green)]/55">Rendement min (%)</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={editing.target_yield_min}
                  onChange={(e) =>
                    setEditing({ ...editing, target_yield_min: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-[var(--sf-green)]/55">Rendement max (%)</span>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={editing.target_yield_max}
                  onChange={(e) =>
                    setEditing({ ...editing, target_yield_max: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-gold)] disabled:opacity-50"
              >
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-lg border border-[var(--sf-cream-dark)] px-4 py-2 text-sm"
              >
                Annuler
              </button>
            </div>
          </form>
        </DashboardPanel>
      ) : null}
    </div>
  );
}
