"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { CaseOverview } from "@/components/case/case-overview";
import { CaseBeneficiariesHub } from "@/components/case/case-beneficiaries-hub";
import { CaseMandatesHub } from "@/components/case/case-mandates-hub";
import { CasePatrimoineResume, CasePatrimoineAssetDetail } from "@/components/case/case-patrimony-hub";
import { PortalCaseObservations } from "@/components/case/case-observations-hub";
import { ReportPdfPreviewModal } from "@/components/case/report-pdf-preview-modal";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import {
  fetchPortalDocuments,
  fetchPortalReports,
  fetchPortalDocumentDownloadUrl,
  type PortalDocument,
  type PortalKind,
  type PortalReport,
} from "@/lib/portal-api";
import { useCaseDetail } from "@/providers/case-detail-provider";
import type { ReportSnapshot } from "@/types/api";

function asSnapshot(raw: PortalReport["metadata_json"]): ReportSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  if (!("version" in raw) && !("kpis" in raw) && !("period" in raw)) return null;
  return raw as ReportSnapshot;
}

export function PortalCaseOverviewPage() {
  const { data } = useCaseDetail();
  if (!data) return null;
  return <CaseOverview data={data} variant="client" />;
}

export function PortalCaseMandatPage() {
  return <CaseMandatesHub />;
}

export function PortalCaseBeneficiairesPage() {
  const { data, navBase } = useCaseDetail();
  const router = useRouter();

  useEffect(() => {
    if (data?.case_type === "SUCCESSION") {
      router.replace(`${navBase}/beneficiaires/informations`);
    }
  }, [data?.case_type, navBase, router]);

  if (!data) return null;
  if (data.case_type === "SUCCESSION") return null;
  return <CaseBeneficiariesHub readOnly />;
}

export function PortalCaseBeneficiairesInfosPage() {
  return <CaseBeneficiariesHub readOnly successionView />;
}

export function PortalCasePatrimoinePage() {
  return <CasePatrimoineResume />;
}

export function PortalCasePatrimoineAssetPage({ assetId }: { assetId: string }) {
  return <CasePatrimoineAssetDetail assetId={assetId} />;
}

export function PortalCaseObservationsPage() {
  const { caseId } = useCaseDetail();
  return (
    <div className="rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
      <h2 className="sf-display text-lg font-semibold text-[var(--sf-green-deep)]">
        Observations
      </h2>
      <p className="mt-1 text-sm text-[var(--sf-green)]/55">
        Déposez une observation pour l&apos;équipe Amanah Fiducie.
      </p>
      <div className="mt-4">
        <PortalCaseObservations caseId={caseId} />
      </div>
    </div>
  );
}

export function PortalCaseRapportsPage({ kind }: { kind: PortalKind }) {
  const { caseId } = useCaseDetail();
  const [reports, setReports] = useState<PortalReport[]>([]);
  const [documents, setDocuments] = useState<PortalDocument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportRequest, setReportRequest] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportOk, setReportOk] = useState<string | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfTitle, setPdfTitle] = useState("Rapport");
  const [pdfSnap, setPdfSnap] = useState<ReportSnapshot | null>(null);

  useEffect(() => {
    void Promise.all([
      fetchPortalReports(kind, caseId),
      fetchPortalDocuments(kind, caseId),
    ])
      .then(([reps, docs]) => {
        setReports(reps);
        setDocuments(docs);
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      );
  }, [kind, caseId]);

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
      setReportOk("Demande transmise à l'équipe Amanah Fiducie.");
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Envoi impossible.",
      );
    } finally {
      setReportBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      <section className="overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
        <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 px-5 py-4">
          <h2 className="sf-display text-lg font-semibold text-[var(--sf-green-deep)]">
            Demande de rapport
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/55">
            Sollicitez un rapport auprès de votre gestionnaire.
          </p>
        </div>
        <form onSubmit={submitReportRequest} className="space-y-3 p-5">
          <textarea
            value={reportRequest}
            onChange={(e) => setReportRequest(e.target.value)}
            rows={4}
            required
            placeholder="Ex. : Rapport de gestion du trimestre…"
            className="sf-input min-h-[100px] resize-y"
          />
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
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
        <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 px-5 py-4">
          <h2 className="sf-display text-lg font-semibold text-[var(--sf-green-deep)]">
            Rapports publiés
          </h2>
        </div>
        <div className="p-5">
          {reports.length === 0 ? (
            <p className="text-sm text-[var(--sf-green)]/50">Aucun rapport publié.</p>
          ) : (
            <ul className="space-y-2">
              {reports.map((report) => (
                <li
                  key={report.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sf-cream-dark)] px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-[var(--sf-green-deep)]">{report.title}</p>
                    <p className="text-xs text-[var(--sf-green)]/50">
                      {report.report_type_label}
                      {report.approved_at ? ` · ${formatDate(report.approved_at)}` : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="sf-btn-secondary text-xs"
                    onClick={() => {
                      const snap = asSnapshot(report.metadata_json);
                      if (!snap) {
                        setError("Contenu du rapport indisponible.");
                        return;
                      }
                      setPdfTitle(report.title);
                      setPdfSnap(snap);
                      setPdfOpen(true);
                    }}
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
        </div>
        <div className="p-5">
          {documents.length === 0 ? (
            <p className="text-sm text-[var(--sf-green)]/50">Aucun document partagé.</p>
          ) : (
            <ul className="space-y-2">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--sf-cream-dark)] px-4 py-3"
                >
                  <div>
                    <p className="font-medium text-[var(--sf-green-deep)]">{doc.title}</p>
                    <p className="text-xs text-[var(--sf-green)]/50">{doc.category}</p>
                  </div>
                  <button
                    type="button"
                    className="sf-btn-secondary text-xs"
                    onClick={() =>
                      void fetchPortalDocumentDownloadUrl(kind, doc.id).then((res) =>
                        window.open(res.url, "_blank", "noopener,noreferrer"),
                      )
                    }
                  >
                    Télécharger
                  </button>
                </li>
              ))}
            </ul>
          )}
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

export function PortalCaseTypePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <EmptyState title={title} description={description} />
  );
}
