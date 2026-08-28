"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ReportPdfPreviewModal } from "@/components/case/report-pdf-preview-modal";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import {
  formatDate,
  CASE_TYPE_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
} from "@/lib/labels";
import { getReportServiceProfile } from "@/lib/report-service-profiles";
import {
  userCanApproveReports,
  userCanGenerateReports,
} from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useCaseDetail } from "@/providers/case-detail-provider";
import type { ReportItem, ReportSnapshot } from "@/types/api";

function asSnapshot(raw: ReportItem["metadata_json"]): ReportSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (!("version" in raw) && !("kpis" in raw) && !("period" in raw)) return null;
  return raw as ReportSnapshot;
}

const MONTHS_FR = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

type PeriodMode = "month" | "year";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function periodBounds(
  mode: PeriodMode,
  year: number,
  month: number,
): { start: string; end: string; label: string } {
  if (mode === "year") {
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
      label: `année ${year}`,
    };
  }
  const endDay = lastDayOfMonth(year, month);
  return {
    start: `${year}-${pad2(month)}-01`,
    end: `${year}-${pad2(month)}-${pad2(endDay)}`,
    label: `${MONTHS_FR[month - 1]} ${year}`,
  };
}

function statusClass(status: string) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "REJECTED") return "bg-red-50 text-red-800 ring-red-200";
  if (status === "DRAFT" || status === "PENDING_APPROVAL") {
    return "bg-amber-50 text-amber-900 ring-amber-200";
  }
  return "bg-[var(--sf-cream)] text-[var(--sf-green)]/60 ring-[var(--sf-cream-dark)]";
}

export function CaseReportsWorkspace() {
  const { caseId, data: caseData } = useCaseDetail();
  const { user } = useAuth();
  const now = useMemo(() => new Date(), []);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("Aperçu PDF A4");
  const [pdfSnap, setPdfSnap] = useState<ReportSnapshot | null>(null);

  const serviceProfile = useMemo(
    () => getReportServiceProfile(caseData?.case_type),
    [caseData?.case_type],
  );

  const period = useMemo(
    () => periodBounds(periodMode, year, month),
    [periodMode, year, month],
  );

  const reportType =
    periodMode === "month"
      ? "MONTHLY_MANAGEMENT_REPORT"
      : "ANNUAL_MANAGEMENT_REPORT";

  const autoTitle = useMemo(() => {
    const base = serviceProfile.report_name;
    if (periodMode === "year" && !base.toLowerCase().includes("annuel")) {
      return `${base.replace("Rapport de", "Rapport annuel de")} — ${period.label}`;
    }
    return `${base} — ${period.label}`;
  }, [serviceProfile.report_name, periodMode, period.label]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ReportItem[]>(`/cases/${caseId}/reports/`);
      setReports(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de charger les rapports.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const canGenerate = userCanGenerateReports(user);
  const canApprove = userCanApproveReports(user);
  const years = useMemo(() => {
    const y = now.getFullYear();
    return [y, y - 1, y - 2, y - 3, y - 4];
  }, [now]);

  async function generateReport() {
    setGenerating(true);
    setError(null);
    try {
      await apiRequest("/reports/generate/", {
        method: "POST",
        body: JSON.stringify({
          case_id: Number(caseId),
          report_type: reportType,
          title: autoTitle,
          period_start: period.start,
          period_end: period.end,
        }),
      });
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Génération du rapport impossible.",
      );
    } finally {
      setGenerating(false);
    }
  }

  async function approveReport(id: number) {
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

  async function downloadReport(id: number) {
    setActing(id);
    try {
      // Même HTML A4 que l'aperçu — pas le fichier ReportLab (présentation différente)
      const report = await apiRequest<ReportItem>(`/reports/${id}/`);
      const snap = asSnapshot(report.metadata_json);
      if (!snap) {
        setError(
          "Ce rapport n'a pas encore de contenu enrichi. Ouvrez l'aperçu ou régénérez-le.",
        );
        return;
      }
      setPdfTitle(report.title);
      setPdfSnap(snap);
      setPdfOpen(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Aperçu PDF impossible.");
    } finally {
      setActing(null);
    }
  }

  if (loading) return <LoadingState label="Chargement des rapports…" />;

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      {canGenerate ? (
        <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
            Générer un rapport
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/55">
            Contenu adapté au service{" "}
            <strong>
              {CASE_TYPE_LABELS[caseData?.case_type || ""] || caseData?.case_type || "—"}
            </strong>
            {" — "}
            {serviceProfile.subtitle}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setPeriodMode("month")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition ${
                periodMode === "month"
                  ? "bg-[var(--sf-green)] text-[var(--sf-gold)] ring-[var(--sf-green)]"
                  : "bg-white text-[var(--sf-green-deep)] ring-[var(--sf-cream-dark)] hover:bg-[var(--sf-cream)]/40"
              }`}
            >
              Mensuel
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("year")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 transition ${
                periodMode === "year"
                  ? "bg-[var(--sf-green)] text-[var(--sf-gold)] ring-[var(--sf-green)]"
                  : "bg-white text-[var(--sf-green-deep)] ring-[var(--sf-cream-dark)] hover:bg-[var(--sf-cream)]/40"
              }`}
            >
              Annuel
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            {periodMode === "month" ? (
              <div className="min-w-[160px]">
                <label className="block text-xs font-medium text-[var(--sf-green)]/70">
                  Mois
                </label>
                <select
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                  className="sf-input mt-1"
                >
                  {MONTHS_FR.map((label, i) => (
                    <option key={label} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="min-w-[120px]">
              <label className="block text-xs font-medium text-[var(--sf-green)]/70">
                Année
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="sf-input mt-1"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            <div className="min-w-[220px] flex-1">
              <p className="text-xs font-medium text-[var(--sf-green)]/70">Titre</p>
              <p className="mt-1 text-sm font-medium text-[var(--sf-green-deep)]">
                {autoTitle}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--sf-green)]/45">
                Période : {period.start} → {period.end}
              </p>
            </div>
            <button
              type="button"
              disabled={generating}
              onClick={() => void generateReport()}
              className="sf-btn-primary"
            >
              {generating ? "Génération…" : "Générer le rapport"}
            </button>
          </div>
        </section>
      ) : null}

      {reports.length === 0 ? (
        <EmptyState
          title="Aucun rapport"
          description="Générez un rapport mensuel ou annuel pour ce dossier."
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((report) => {
            const snap = report.metadata_json as ReportItem["metadata_json"];
            const periodLabel =
              snap && typeof snap === "object" && "period" in snap
                ? (snap as { period?: { label?: string } }).period?.label
                : null;
            return (
              <li
                key={report.id}
                className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-[var(--sf-green-deep)]">
                      {report.title}
                    </p>
                    <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                      {report.report_type_label
                        || REPORT_TYPE_LABELS[report.report_type]
                        || report.report_type}
                      {periodLabel ? ` · ${periodLabel}` : null}
                      {report.period_start && report.period_end && !periodLabel
                        ? ` · ${report.period_start} → ${report.period_end}`
                        : null}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--sf-green)]/45">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${statusClass(report.status)}`}
                      >
                        {REPORT_STATUS_LABELS[report.status] || report.status_label}
                      </span>
                      <span>
                        Par {report.generated_by_username} —{" "}
                        {formatDate(report.created_at)}
                      </span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dossiers/${caseId}/rapports/${report.id}`}
                      className="sf-btn-primary text-sm"
                    >
                      Aperçu
                    </Link>
                    {report.can_download ? (
                      <button
                        type="button"
                        disabled={acting === report.id}
                        onClick={() => void downloadReport(report.id)}
                        className="sf-btn-secondary text-sm"
                      >
                        PDF
                      </button>
                    ) : null}
                    {canApprove && report.status === "DRAFT" ? (
                      <button
                        type="button"
                        disabled={acting === report.id}
                        onClick={() => void approveReport(report.id)}
                        className="sf-btn-secondary text-sm"
                      >
                        Approuver
                      </button>
                    ) : null}
                    {canApprove && report.status === "APPROVED" ? (
                      <button
                        type="button"
                        disabled={acting === report.id}
                        onClick={async () => {
                          setActing(report.id);
                          try {
                            await apiRequest(`/reports/${report.id}/archive/`, {
                              method: "POST",
                            });
                            await load();
                          } catch (err) {
                            setError(
                              err instanceof ApiError
                                ? err.message
                                : "Archivage impossible.",
                            );
                          } finally {
                            setActing(null);
                          }
                        }}
                        className="sf-btn-secondary text-sm"
                      >
                        Archiver
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ReportPdfPreviewModal
        open={pdfOpen}
        title={pdfTitle}
        snap={pdfSnap}
        onClose={() => {
          setPdfOpen(false);
          setPdfSnap(null);
        }}
      />
    </div>
  );
}
