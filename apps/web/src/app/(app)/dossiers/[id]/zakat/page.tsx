"use client";

import { use, useEffect, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { usePlatformPermissions } from "@/hooks/use-platform-permissions";
import { ApiError, apiRequest } from "@/lib/api";
import { formatMoney } from "@/lib/labels";
import type { ZakatAssessment } from "@/types/api";

export default function CaseZakatPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { canWriteCase } = usePlatformPermissions();
  const [items, setItems] = useState<ZakatAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [zakatable, setZakatable] = useState("");
  const [zakatDue, setZakatDue] = useState("");

  function load() {
    setLoading(true);
    apiRequest<ZakatAssessment[]>(`/cases/${id}/zakat-assessments/`)
      .then(setItems)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addAssessment() {
    setError(null);
    try {
      await apiRequest<ZakatAssessment>(`/cases/${id}/zakat-assessments/`, {
        method: "POST",
        body: JSON.stringify({
          assessment_year: Number(year),
          zakatable_wealth: zakatable || "0",
          zakat_due: zakatDue || "0",
          currency: "XOF",
        }),
      });
      setZakatable("");
      setZakatDue("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création impossible.");
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      {canWriteCase ? (
        <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4">
          <h2 className="font-semibold text-[var(--sf-green-deep)]">Nouvelle évaluation</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="w-28 rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              placeholder="Année"
            />
            <input
              value={zakatable}
              onChange={(e) => setZakatable(e.target.value)}
              className="min-w-[140px] flex-1 rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              placeholder="Patrimoine zakatable"
            />
            <input
              value={zakatDue}
              onChange={(e) => setZakatDue(e.target.value)}
              className="min-w-[140px] flex-1 rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              placeholder="Zakat due"
            />
            <button
              type="button"
              onClick={addAssessment}
              className="rounded-lg bg-[var(--sf-green-deep)] px-4 py-2 text-sm font-medium text-white"
            >
              Ajouter
            </button>
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 font-semibold text-[var(--sf-green-deep)]">Historique</h2>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--sf-green)]/55">Aucune évaluation.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((z) => (
              <li
                key={z.id}
                className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-4 py-3 text-sm"
              >
                <span className="font-medium">{z.assessment_year}</span>
                {" — "}
                {formatMoney(z.zakat_due, z.currency)} ({z.status}) ·{" "}
                {formatMoney(z.zakatable_wealth, z.currency)} zakatable
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
