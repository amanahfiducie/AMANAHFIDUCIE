"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import type { FiduciaryCaseListItem } from "@/types/api";

export default function ChariaPartagesPage() {
  const [cases, setCases] = useState<FiduciaryCaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<FiduciaryCaseListItem[]>("/cases/")
      .then((list) => setCases(list.filter((c) => c.case_type === "SUCCESSION")))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState label="Chargement des dossiers succession…" />;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
          Partages farāʾiḍ à traiter
        </h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Ouvrez la revue charaïque pour valider les héritiers, attribuer les parts et
          enregistrer les arrangements particuliers.
        </p>
        {!error ? (
          <p className="mt-2 text-xs text-[var(--sf-green)]/45">
            {cases.length} dossier{cases.length > 1 ? "s" : ""} succession
          </p>
        ) : null}
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      {cases.length === 0 && !error ? (
        <p className="text-sm text-[var(--sf-green)]/55">
          Aucun dossier succession accessible.
        </p>
      ) : (
        <ul className="space-y-2">
          {cases.map((c) => (
            <li key={c.id}>
              <Link
                href={`/charia/dossiers/${c.id}/partage`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sf-cream-dark)] bg-white px-4 py-3 transition hover:border-[var(--sf-green)]/30"
              >
                <span className="min-w-0">
                  <span className="font-medium text-[var(--sf-green-deep)]">
                    {c.reference}
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-[var(--sf-green)]/55">
                    {c.title}
                  </span>
                  <span className="mt-1 block text-xs text-[var(--sf-green)]/40">
                    Mis à jour {formatDate(c.updated_at)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={c.status} />
                  <span className="text-sm font-medium text-[var(--sf-green-mid)]">
                    Ouvrir la revue →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
