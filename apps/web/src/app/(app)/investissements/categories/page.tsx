"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { DashboardKpi, DashboardPanel } from "@/components/investments/investment-charts";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { assetClassColor } from "@/lib/investment-labels";
import { userCanManageInvestmentCatalog } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { InvestmentAssetClass } from "@/types/api";

export default function CategoriesPage() {
  const { user } = useAuth();
  const canManage = userCanManageInvestmentCatalog(user);
  const [classes, setClasses] = useState<InvestmentAssetClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [weightMin, setWeightMin] = useState("5");
  const [weightMax, setWeightMax] = useState("30");

  const load = useCallback(() => {
    apiRequest<InvestmentAssetClass[]>("/investments/asset-classes/")
      .then(setClasses)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const activeCount = classes.filter((c) => c.is_active !== false).length;

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest<InvestmentAssetClass>("/investments/asset-classes/", {
        method: "POST",
        body: JSON.stringify({
          label,
          description,
          weight_min: Number(weightMin),
          weight_max: Number(weightMax),
          is_active: true,
        }),
      });
      setLabel("");
      setDescription("");
      setWeightMin("5");
      setWeightMax("30");
      setShowForm(false);
      setLoading(true);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(item: InvestmentAssetClass) {
    if (!canManage) return;
    setError(null);
    try {
      const updated = await apiRequest<InvestmentAssetClass>(
        `/investments/asset-classes/${item.id}/`,
        {
          method: "PATCH",
          body: JSON.stringify({ is_active: !item.is_active }),
        },
      );
      setClasses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Mise à jour impossible.");
    }
  }

  if (loading) return <LoadingState label="Chargement catégories…" />;
  if (error && classes.length === 0) return <ErrorAlert message={error} />;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <DashboardKpi label="Catégories" value={String(classes.length)} hint={`${activeCount} active(s)`} />
        <DashboardKpi
          label="Univers PIGFI"
          value="Or · Sukuk · Immobilier…"
          hint="Chaque catégorie a son tableau de bord"
          accent="muted"
        />
      </div>

      <DashboardPanel
        title="Catégories d'investissement"
        subtitle="Gérer et ouvrir le tableau de bord de chaque classe d'actif"
        action={
          canManage ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="rounded-lg bg-[var(--sf-green)] px-3 py-1.5 text-xs font-medium text-[var(--sf-gold)]"
            >
              {showForm ? "Annuler" : "+ Nouvelle catégorie"}
            </button>
          ) : undefined
        }
      >
        {error ? <ErrorAlert message={error} /> : null}

        {showForm && canManage ? (
          <form
            onSubmit={handleCreate}
            className="mb-6 grid gap-3 rounded-lg border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/15 p-4 md:grid-cols-2"
          >
            <label className="block md:col-span-2">
              <span className="text-xs text-[var(--sf-green)]/55">Libellé</span>
              <input
                required
                placeholder="Ex. Immobilier locatif"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="text-xs text-[var(--sf-green)]/55">Description</span>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--sf-green)]/55">Poids min (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={weightMin}
                onChange={(e) => setWeightMin(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--sf-green)]/55">Poids max (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={weightMax}
                onChange={(e) => setWeightMax(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              />
            </label>
            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-gold)] disabled:opacity-50"
              >
                {busy ? "Création…" : "Créer"}
              </button>
            </div>
          </form>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((item, index) => (
            <article
              key={item.id}
              className={`rounded-xl border border-[var(--sf-cream-dark)] p-4 transition hover:border-[var(--sf-green)]/40 ${
                item.is_active === false ? "opacity-50" : ""
              }`}
            >
              <div
                className="mb-3 h-1.5 w-full rounded-full"
                style={{ backgroundColor: assetClassColor(item.slug, index) }}
              />
              <h3 className="font-semibold text-[var(--sf-green-deep)]">{item.label}</h3>
              <p className="text-xs text-[var(--sf-green)]/45">{item.slug}</p>
              {item.description ? (
                <p className="mt-2 line-clamp-2 text-sm text-[var(--sf-green)]/65">{item.description}</p>
              ) : null}
              <p className="mt-2 text-xs tabular-nums text-emerald-800">
                Cible {item.weight_min}–{item.weight_max} %
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/investissements/categories/${item.slug}`}
                  className="rounded-lg bg-[var(--sf-green)] px-3 py-1.5 text-xs font-medium text-[var(--sf-gold)]"
                >
                  Tableau de bord →
                </Link>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => toggleActive(item)}
                    className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-1.5 text-xs"
                  >
                    {item.is_active === false ? "Activer" : "Désactiver"}
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </DashboardPanel>
    </div>
  );
}
