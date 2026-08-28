"use client";

import { use, useEffect, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDateTime } from "@/lib/labels";
import type { AuditLogItem } from "@/types/api";

export default function CaseAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<AuditLogItem[]>(`/cases/${id}/audit-logs/`)
      .then(setLogs)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <div>
      {logs.length === 0 ? (
        <p className="text-sm text-[var(--sf-green)]/55">Aucune entrée pour ce dossier.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li
              key={log.id}
              className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-4 py-3 text-sm"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <span className="font-medium">{log.action}</span>
                <span className="text-xs text-[var(--sf-green)]/50">
                  {formatDateTime(log.timestamp)}
                </span>
              </div>
              <p className="mt-1 text-[var(--sf-green)]/65">
                {log.actor_username ?? "système"} — {log.entity_type} #{log.entity_id}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
