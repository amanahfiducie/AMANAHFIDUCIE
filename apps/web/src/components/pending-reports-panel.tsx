"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { usePlatformPermissions } from "@/hooks/use-platform-permissions";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate, REPORT_STATUS_LABELS, REPORT_TYPE_LABELS } from "@/lib/labels";
import type { ReportItem } from "@/types/api";

export function PendingReportsPanel() {
  const { canApproveReports } = usePlatformPermissions();
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ReportItem[]>("/reports/pending-approval/");
      setReports(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de charger les rapports.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(id: number) {
    setActing(id);
    try {
      await apiRequest(`/reports/${id}/approve/`, {
        method: "POST",
        body: JSON.stringify({ comment: "" }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approbation impossible.");
    } finally {
      setActing(null);
    }
  }

  if (loading) return <LoadingState />;
  if (error) return <ErrorAlert message={error} />;

  if (reports.length === 0) {
    return (
      <EmptyState
        title="Aucun rapport en attente"
        description="Les brouillons à approuver apparaîtront ici."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {reports.map((report) => (
        <li
          key={report.id}
          className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-[var(--sf-green-deep)]">{report.title}</p>
              <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                {REPORT_TYPE_LABELS[report.report_type] ?? report.report_type}
                {" · "}
                {REPORT_STATUS_LABELS[report.status] ?? report.status}
                {" · "}
                {formatDate(report.created_at)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/dossiers/${report.case}/rapports`}
                className="sf-btn-secondary text-sm"
              >
                Dossier
              </Link>
              {canApproveReports ? (
                <button
                  type="button"
                  disabled={acting === report.id}
                  onClick={() => approve(report.id)}
                  className="sf-btn-primary text-sm"
                >
                  Approuver
                </button>
              ) : null}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
