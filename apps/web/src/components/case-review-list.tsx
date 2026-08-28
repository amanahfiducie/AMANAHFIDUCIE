"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import type { FiduciaryCaseListItem } from "@/types/api";

export function CaseReviewList({
  statusFilter,
  title,
}: {
  statusFilter: string;
  title: string;
}) {
  const [cases, setCases] = useState<FiduciaryCaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<FiduciaryCaseListItem[]>(`/cases/?status=${encodeURIComponent(statusFilter)}`)
      .then(setCases)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger les dossiers.",
        ),
      )
      .finally(() => setLoading(false));
  }, [statusFilter]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorAlert message={error} />;

  if (cases.length === 0) {
    return (
      <EmptyState
        title="Aucun dossier"
        description={`Aucun dossier avec le filtre : ${title}.`}
      />
    );
  }

  return (
    <ul className="space-y-2">
      {cases.map((c) => (
        <li key={c.id}>
          <Link
            href={`/dossiers/${c.id}`}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sf-cream-dark)] bg-white px-4 py-3 shadow-sm transition hover:border-[var(--sf-green)]/25"
          >
            <div>
              <p className="font-mono text-xs text-[var(--sf-green)]/50">{c.reference}</p>
              <p className="font-medium text-[var(--sf-green-deep)]">{c.title}</p>
              <p className="mt-0.5 text-xs text-[var(--sf-green)]/45">
                Mis à jour {formatDate(c.updated_at)}
              </p>
            </div>
            <StatusBadge status={c.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
