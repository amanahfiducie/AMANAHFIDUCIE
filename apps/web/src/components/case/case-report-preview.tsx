"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CaseReportDocument } from "@/components/case/case-report-document";
import { ReportPdfPreviewModal } from "@/components/case/report-pdf-preview-modal";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import {
  formatDate,
  REPORT_STATUS_LABELS,
  REPORT_TYPE_LABELS,
} from "@/lib/labels";
import { printReportHtml } from "@/lib/print-report-html";
import {
  userCanApproveReports,
  userCanGenerateReports,
} from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { ReportItem, ReportSnapshot } from "@/types/api";

function asSnapshot(raw: ReportItem["metadata_json"]): ReportSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (!("version" in raw) && !("kpis" in raw) && !("period" in raw)) return null;
  return raw as ReportSnapshot;
}

export function CaseReportPreview({
  caseId,
  reportId,
}: {
  caseId: string;
  reportId: string;
}) {
  const { user } = useAuth();
  const [report, setReport] = useState<ReportItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<ReportItem>(`/reports/${reportId}/`);
      if (String(data.case) !== String(caseId)) {
        setError("Ce rapport n'appartient pas à ce dossier.");
        setReport(null);
        return;
      }
      setReport(data);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de charger le rapport.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId, reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const snap = useMemo(() => asSnapshot(report?.metadata_json), [report]);
  const canApprove = userCanApproveReports(user);
  const canGenerate = userCanGenerateReports(user);

  function downloadPdf() {
    const node = printRef.current;
    if (!node || !report) {
      setPdfOpen(true);
      return;
    }
    // Impression directe du même HTML que l'aperçu (sans menu app)
    printReportHtml(node, report.title);
  }

  async function copyShareLink() {
    if (!report) return;
    setActing(true);
    setCopied(false);
    try {
      // Lien vers l'aperçu HTML (identique à l'écran), pas le fichier ReportLab
      const url = `${window.location.origin}/dossiers/${caseId}/rapports/${report.id}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de créer le lien de partage.",
      );
    } finally {
      setActing(false);
    }
  }

  async function approve() {
    if (!report) return;
    setActing(true);
    try {
      await apiRequest(`/reports/${report.id}/approve/`, {
        method: "POST",
        body: JSON.stringify({ comment: "" }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Approbation impossible.");
    } finally {
      setActing(false);
    }
  }

  async function archive() {
    if (!report) return;
    setActing(true);
    try {
      await apiRequest(`/reports/${report.id}/archive/`, { method: "POST" });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Archivage impossible.");
    } finally {
      setActing(false);
    }
  }

  if (loading) return <LoadingState label="Chargement de l'aperçu…" />;
  if (error && !report) return <ErrorAlert message={error} />;
  if (!report) return <ErrorAlert message="Rapport introuvable." />;

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href={`/dossiers/${caseId}/rapports`}
            className="text-sm text-[var(--sf-green-mid)] hover:underline"
          >
            ← Retour aux rapports
          </Link>
          <h1 className="mt-2 text-xl font-semibold text-[var(--sf-green-deep)]">
            {report.title}
          </h1>
          <p className="mt-1 text-sm text-[var(--sf-green)]/55">
            {report.report_type_label
              || REPORT_TYPE_LABELS[report.report_type]
              || report.report_type}
            {snap?.period?.label ? ` · ${snap.period.label}` : null}
            {" · "}
            {REPORT_STATUS_LABELS[report.status] || report.status_label}
          </p>
          <p className="mt-0.5 text-xs text-[var(--sf-green)]/45">
            Généré par {report.generated_by_username} — {formatDate(report.created_at)}
            {report.approved_at
              ? ` · Approuvé ${formatDate(report.approved_at)}`
              : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {report.can_download || canGenerate ? (
            <>
              <button
                type="button"
                disabled={acting}
                onClick={() => setPdfOpen(true)}
                className="sf-btn-secondary text-sm"
              >
                Aperçu PDF
              </button>
              <button
                type="button"
                disabled={acting || !snap}
                onClick={downloadPdf}
                className="sf-btn-secondary text-sm"
              >
                Télécharger
              </button>
              <button
                type="button"
                disabled={acting}
                onClick={() => void copyShareLink()}
                className="sf-btn-secondary text-sm"
              >
                {copied ? "Lien copié ✓" : "Copier le lien"}
              </button>
            </>
          ) : null}
          {canApprove && report.status === "DRAFT" ? (
            <button
              type="button"
              disabled={acting}
              onClick={() => void approve()}
              className="sf-btn-primary text-sm"
            >
              Approuver & publier
            </button>
          ) : null}
          {canApprove && report.status === "APPROVED" ? (
            <button
              type="button"
              disabled={acting}
              onClick={() => void archive()}
              className="sf-btn-secondary text-sm"
            >
              Archiver
            </button>
          ) : null}
        </div>
      </div>

      {report.status === "APPROVED" ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900">
          Publié sur les portails famille / notaire / juge. « Télécharger » ouvre
          l&apos;impression : choisissez « Enregistrer au format PDF ».
        </p>
      ) : report.status === "DRAFT" ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-950">
          Brouillon — visible en interne. Approuvez pour publier sur les portails.
        </p>
      ) : null}

      {!snap ? (
        <p className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-6 text-sm text-[var(--sf-green)]/55">
          Ce rapport ne contient pas encore de snapshot enrichi. Régénérez un rapport
          mensuel ou annuel pour obtenir diagrammes et indicateurs.
        </p>
      ) : (
        <div className="mx-auto w-full max-w-[210mm]">
          <div
            ref={printRef}
            className="rounded-sm border border-[var(--sf-cream-dark)] bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6"
          >
            <CaseReportDocument
              snap={snap}
              showLetterhead
              documentTitle={report.title}
            />
          </div>
        </div>
      )}

      <ReportPdfPreviewModal
        open={pdfOpen}
        title={report.title}
        snap={snap}
        onClose={() => setPdfOpen(false)}
      />
    </div>
  );
}
