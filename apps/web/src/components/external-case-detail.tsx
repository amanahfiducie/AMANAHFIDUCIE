"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

import { CaseOverview } from "@/components/case/case-overview";
import { PortalCaseObservations } from "@/components/case/case-observations-hub";
import { ReportPdfPreviewModal } from "@/components/case/report-pdf-preview-modal";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import {
  fetchPortalDocumentDownloadUrl,
  fetchPortalDocuments,
  fetchPortalReports,
  uploadPortalDocument,
  type PortalDocument,
  type PortalKind,
  type PortalReport,
} from "@/lib/portal-api";
import { usePortalCases } from "@/providers/portal-cases-provider";
import type { FiduciaryCaseDetail, ReportSnapshot } from "@/types/api";

function asSnapshot(raw: PortalReport["metadata_json"]): ReportSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (!("version" in raw) && !("kpis" in raw) && !("period" in raw)) return null;
  return raw as ReportSnapshot;
}

/**
 * Portail client : même vue d'ensemble que /dossiers/[id] (sans finance / investissements),
 * lecture seule + observations + demande de rapport.
 */
export function ExternalCaseDetail({
  kind,
  caseId,
  basePath,
  allowUpload = false,
}: {
  kind: PortalKind;
  caseId: string;
  basePath: string;
  allowUpload?: boolean;
}) {
  const { cases, rememberCase } = usePortalCases();
  const [detail, setDetail] = useState<FiduciaryCaseDetail | null>(null);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [reports, setReports] = useState<PortalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [reportRequest, setReportRequest] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportOk, setReportOk] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("Rapport");
  const [pdfSnap, setPdfSnap] = useState<ReportSnapshot | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [caseData, docs, reps] = await Promise.all([
        apiRequest<FiduciaryCaseDetail>(`/cases/${caseId}/`),
        fetchPortalDocuments(kind, caseId),
        fetchPortalReports(kind, caseId),
      ]);
      setDetail(caseData);
      setDocuments(docs);
      setReports(reps);
      rememberCase(Number(caseId));
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de charger le dossier.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, caseId]);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!allowUpload) return;
    const form = e.currentTarget;
    const fileInput = form.elements.namedItem("file") as HTMLInputElement;
    const titleInput = form.elements.namedItem("title") as HTMLInputElement;
    const file = fileInput.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadPortalDocument(
        Number(caseId),
        file,
        titleInput.value || file.name,
        "OTHER",
      );
      form.reset();
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Échec du dépôt de pièce.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function submitReportRequest(e: FormEvent) {
    e.preventDefault();
    const message = reportRequest.trim();
    if (!message) return;
    setReportBusy(true);
    setReportOk(null);
    setError(null);
    try {
      await apiRequest(`/cases/${caseId}/observations/`, {
        method: "POST",
        body: JSON.stringify({
          kind: "SUBMISSION",
          body: `[Demande de rapport]\n${message}`,
          share: true,
        }),
      });
      setReportRequest("");
      setReportOk(
        "Votre demande de rapport a été transmise à l'équipe Amanah Fiducie.",
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'envoyer la demande de rapport.",
      );
    } finally {
      setReportBusy(false);
    }
  }

  function openReport(report: PortalReport) {
    const snap = asSnapshot(report.metadata_json);
    if (!snap) {
      setError(
        "Ce rapport n'a pas de contenu à afficher. Contactez Amanah Fiducie.",
      );
      return;
    }
    setPdfTitle(report.title);
    setPdfSnap(snap);
    setPdfOpen(true);
  }

  async function downloadDoc(docId: number) {
    try {
      const res = await fetchPortalDocumentDownloadUrl(kind, docId);
      window.open(res.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Téléchargement impossible.",
      );
    }
  }

  if (loading) return <LoadingState label="Chargement du dossier…" />;
  if (error && !detail) return <ErrorAlert message={error} />;
  if (!detail) return null;

  const multiCase = cases.length > 1;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`${basePath}/dossiers`}
          className="text-sm text-[var(--sf-green-mid)] hover:underline"
        >
          ← Tous mes dossiers
        </Link>
        {multiCase ? (
          <p className="text-xs text-[var(--sf-green)]/50">
            {cases.length} dossiers — basculez via le sélecteur en haut
          </p>
        ) : null}
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      <CaseOverview data={detail} variant="client" />

      {/* Actions autorisées */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
          <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 px-5 py-4">
            <h2 className="sf-display text-lg font-semibold text-[var(--sf-green-deep)]">
              Observations
            </h2>
            <p className="mt-1 text-sm text-[var(--sf-green)]/55">
              Déposez une observation ou un message pour l&apos;équipe.
            </p>
          </div>
          <div className="p-5">
            <PortalCaseObservations caseId={caseId} />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
          <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 px-5 py-4">
            <h2 className="sf-display text-lg font-semibold text-[var(--sf-green-deep)]">
              Demande de rapport
            </h2>
            <p className="mt-1 text-sm text-[var(--sf-green)]/55">
              Sollicitez un rapport de période ou une synthèse auprès de votre
              gestionnaire.
            </p>
          </div>
          <form onSubmit={submitReportRequest} className="space-y-3 p-5">
            <label className="block text-xs font-medium text-[var(--sf-green)]/70">
              Précisez votre besoin
              <textarea
                value={reportRequest}
                onChange={(e) => setReportRequest(e.target.value)}
                rows={4}
                required
                placeholder="Ex. : Rapport de gestion du trimestre en cours, synthèse patrimoniale…"
                className="sf-input mt-1.5 min-h-[100px] resize-y"
              />
            </label>
            {reportOk ? (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {reportOk}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={reportBusy || !reportRequest.trim()}
              className="sf-btn-primary text-sm disabled:opacity-60"
            >
              {reportBusy ? "Envoi…" : "Envoyer la demande"}
            </button>
          </form>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
        <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 px-5 py-4">
          <h2 className="sf-display text-lg font-semibold text-[var(--sf-green-deep)]">
            Rapports publiés
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/55">
            Rapports approuvés mis à votre disposition.
          </p>
        </div>
        <div className="p-5">
          {reports.length === 0 ? (
            <p className="text-sm text-[var(--sf-green)]/50">
              Aucun rapport publié pour le moment.
            </p>
          ) : (
            <ul className="space-y-2">
              {reports.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sf-cream-dark)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--sf-green-deep)]">
                      {report.title}
                    </p>
                    <p className="text-xs text-[var(--sf-green)]/50">
                      {report.report_type_label}
                      {report.approved_at
                        ? ` · ${formatDate(report.approved_at)}`
                        : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openReport(report)}
                    className="sf-btn-secondary text-xs"
                  >
                    Consulter
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
        <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 px-5 py-4">
          <h2 className="sf-display text-lg font-semibold text-[var(--sf-green-deep)]">
            Documents partagés
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/55">
            Pièces mises à votre disposition de façon sécurisée.
          </p>
        </div>
        <div className="p-5">
          {documents.length === 0 ? (
            <p className="text-sm text-[var(--sf-green)]/50">
              Aucun document partagé pour le moment.
            </p>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sf-cream-dark)] px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--sf-green-deep)]">{doc.title}</p>
                    <p className="text-xs text-[var(--sf-green)]/50">{doc.category}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void downloadDoc(doc.id)}
                    className="sf-btn-secondary text-xs"
                  >
                    Télécharger
                  </button>
                </li>
              ))}
            </ul>
          )}

          {allowUpload ? (
            <form
              onSubmit={handleUpload}
              className="mt-6 border-t border-[var(--sf-cream-dark)] pt-5"
            >
              <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                Déposer une pièce
              </h3>
              <input
                name="title"
                placeholder="Titre du document"
                className="sf-input mt-3"
              />
              <input name="file" type="file" required className="mt-2 w-full text-sm" />
              <button
                type="submit"
                disabled={uploading}
                className="sf-btn-primary mt-3 text-sm disabled:opacity-60"
              >
                {uploading ? "Envoi…" : "Envoyer"}
              </button>
            </form>
          ) : null}
        </div>
      </section>

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
