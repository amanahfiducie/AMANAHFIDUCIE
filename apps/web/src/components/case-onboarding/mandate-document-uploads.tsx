"use client";

import { useMemo, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError } from "@/lib/api";
import {
  type CaseDocumentItem,
  uploadCaseDocument,
} from "@/lib/case-onboarding";
import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { previewMandateFilename } from "@/lib/mandate-documents";

export function filterMandateDocuments(
  documents: CaseDocumentItem[],
  mandateId?: number | null,
): CaseDocumentItem[] {
  return documents.filter((doc) => {
    if (doc.category !== "MANDATE") return false;
    return mandateId != null
      ? doc.mandate === mandateId
      : doc.mandate == null && !doc.identity_kind;
  });
}

export function MandateDocumentUploads({
  caseId,
  mandateId,
  mandateType,
  title,
  referenceNumber,
  documents,
  onUploaded,
  disabled,
  sectionTitle,
  deferUpload = false,
  pendingFile = null,
  onPendingFileChange,
  compact = false,
  readOnly = false,
}: {
  caseId: number | null;
  mandateId?: number | null;
  mandateType: string;
  title: string;
  referenceNumber: string;
  documents: CaseDocumentItem[];
  onUploaded: () => void;
  disabled?: boolean;
  sectionTitle?: string;
  /** Ne pas envoyer au serveur tant que le mandat n'est pas enregistré */
  deferUpload?: boolean;
  pendingFile?: File | null;
  onPendingFileChange?: (file: File | null) => void;
  /** Style intégré dans une carte mandat (moins de bordures) */
  compact?: boolean;
  /** Lecture seule : aperçu en modale, pas de téléversement */
  readOnly?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    id: number;
    title: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function openPreview(doc: CaseDocumentItem) {
    setError(null);
    setPreviewDoc({
      id: doc.id,
      title: doc.original_filename ?? doc.title,
    });
  }

  const titleReady = title.trim().length > 0;
  const scoped = useMemo(
    () => filterMandateDocuments(documents, mandateId),
    [documents, mandateId],
  );
  const existing = deferUpload ? undefined : scoped[0];
  const hasPending = deferUpload && pendingFile != null;
  const preview = titleReady
    ? previewMandateFilename(mandateType, title, referenceNumber)
    : null;

  function validatePdf(file: File): boolean {
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés pour les actes de mandat.");
      return false;
    }
    return true;
  }

  async function handleFile(file: File | undefined) {
    if (!file || !caseId || !titleReady) return;
    if (!validatePdf(file)) return;

    if (deferUpload) {
      setError(null);
      onPendingFileChange?.(file);
      return;
    }

    setUploading(true);
    setError(null);
    try {
      await uploadCaseDocument(caseId, file, {
        category: "MANDATE",
        mandateId: mandateId ?? undefined,
        mandateType,
        mandateTitle: title.trim(),
        mandateReferenceNumber: referenceNumber.trim(),
      });
      onUploaded();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Échec du téléversement.",
      );
    } finally {
      setUploading(false);
    }
  }

  if (compact) {
    return (
      <section className="rounded-lg border border-[var(--sf-cream-dark)]/80 bg-[var(--sf-cream)]/20 p-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] font-medium text-[var(--sf-green-deep)]">PDF</p>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
              existing
                ? "bg-emerald-50 text-emerald-800"
                : hasPending
                  ? "bg-amber-100 text-amber-900"
                  : "text-[var(--sf-green)]/40"
            }`}
          >
            {existing ? "OK" : hasPending ? "Attente" : "—"}
          </span>
        </div>

        {!titleReady ? (
          <p className="mt-1.5 text-[10px] text-amber-900/80">Intitulé requis</p>
        ) : null}

        {error ? (
          <div className="mt-1.5">
            <ErrorAlert message={error} />
          </div>
        ) : null}

        {existing && readOnly ? (
          <button
            type="button"
            onClick={() => openPreview(existing)}
            className="mt-1.5 line-clamp-2 w-full text-left text-[11px] font-medium text-[var(--sf-green-mid)] underline-offset-2 hover:underline"
          >
            {existing.original_filename ?? existing.title}
          </button>
        ) : (
          <p className="mt-1.5 line-clamp-1 text-[11px] text-[var(--sf-green)]/55">
            {existing
              ? existing.original_filename ?? existing.title
              : hasPending
                ? pendingFile!.name
                : "Aucun fichier"}
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5">
          {existing && !readOnly ? (
            <button
              type="button"
              onClick={() => openPreview(existing)}
              className="rounded-md border border-[var(--sf-cream-dark)] px-2 py-1 text-[11px] font-medium text-[var(--sf-green-deep)] hover:bg-white"
            >
              Aperçu
            </button>
          ) : null}
          {!readOnly ? (
            <label
              className={`rounded-md border px-2 py-1 text-[11px] font-medium ${
                !disabled && titleReady && caseId && !uploading
                  ? "cursor-pointer border-[var(--sf-green)]/20 text-[var(--sf-green-deep)] hover:bg-white"
                  : "cursor-not-allowed border-[var(--sf-cream-dark)] text-[var(--sf-green)]/35"
              }`}
            >
              {uploading
                ? "…"
                : existing || hasPending
                  ? "Remplacer"
                  : deferUpload
                    ? "Choisir"
                    : "PDF"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                disabled={disabled || !titleReady || !caseId || uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  void handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          ) : existing ? (
            <span className="text-[10px] text-[var(--sf-green)]/45">Cliquez le nom du fichier</span>
          ) : null}
        </div>

        <DocumentPreviewModal
          open={previewDoc != null}
          documentId={previewDoc?.id ?? null}
          title={previewDoc?.title}
          onClose={() => setPreviewDoc(null)}
        />
      </section>
    );
  }

  const shellClass =
    "rounded-2xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/20 p-5 shadow-sm";

  return (
    <section className={shellClass}>
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--sf-cream-dark)]/90 pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[var(--sf-green-deep)]">
            {sectionTitle ?? "Acte de mandat (PDF)"}
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--sf-green)]/60">
            PDF uniquement. Le fichier est renommé automatiquement
            {preview ? (
              <>
                {" "}
                (ex. <span className="font-mono text-xs">{preview}</span>).
              </>
            ) : (
              "."
            )}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            existing
              ? "bg-[var(--sf-green)]/10 text-[var(--sf-green-mid)]"
              : hasPending
                ? "bg-amber-100 text-amber-900"
                : "bg-[var(--sf-cream)] text-[var(--sf-green)]/45"
          }`}
        >
          {existing ? "Téléversé" : hasPending ? "En attente" : "Manquant"}
        </span>
      </div>

      {!titleReady ? (
        <p className="mt-4 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900/90">
          Renseignez l&apos;<strong>intitulé du mandat</strong> avant de sélectionner l&apos;acte.
        </p>
      ) : deferUpload ? (
        <p className="mt-4 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900/90">
          Le PDF sera enregistré avec le mandat (
          <strong>Enregistrer le mandat</strong>).
        </p>
      ) : null}

      {error ? (
        <div className="mt-3">
          <ErrorAlert message={error} />
        </div>
      ) : null}

      <div className="mt-4 rounded-xl border border-dashed border-[var(--sf-green-mid)]/20 bg-[var(--sf-cream)]/30 p-4">
        {existing && readOnly ? (
          <button
            type="button"
            onClick={() => openPreview(existing)}
            className="line-clamp-2 w-full text-left text-sm font-medium text-[var(--sf-green-mid)] underline-offset-2 hover:underline"
          >
            {existing.original_filename ?? existing.title}
          </button>
        ) : existing ? (
          <p className="line-clamp-2 text-sm text-[var(--sf-green-mid)]">
            {existing.original_filename ?? existing.title}
          </p>
        ) : hasPending ? (
          <p className="line-clamp-2 text-sm text-[var(--sf-green-mid)]">
            {pendingFile!.name}
            <span className="mt-1 block text-xs text-amber-800/80">En attente</span>
          </p>
        ) : (
          <p className="text-sm text-[var(--sf-green)]/40">Aucun fichier</p>
        )}

        {preview ? (
          <p className="mt-2 truncate font-mono text-[11px] text-[var(--sf-green)]/50">
            {preview}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {existing && !readOnly ? (
            <button
              type="button"
              onClick={() => openPreview(existing)}
              className="sf-btn-secondary text-sm"
            >
              Aperçu
            </button>
          ) : null}
          {!readOnly ? (
            <label
              className={`inline-flex items-center justify-center rounded-lg border px-3 py-2 text-center text-sm font-medium transition ${
                !disabled && titleReady && caseId && !uploading
                  ? "cursor-pointer border-[var(--sf-green)]/20 text-[var(--sf-green-deep)] hover:border-[var(--sf-green-mid)]/40 hover:bg-[var(--sf-cream)]/60"
                  : "cursor-not-allowed border-[var(--sf-cream-dark)] text-[var(--sf-green)]/35"
              }`}
            >
              {uploading
                ? "Envoi…"
                : existing || hasPending
                  ? "Remplacer"
                  : deferUpload
                    ? "Choisir PDF"
                    : "Téléverser PDF"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                disabled={disabled || !titleReady || !caseId || uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  void handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          ) : existing ? (
            <p className="text-xs text-[var(--sf-green)]/45">
              Cliquez sur le nom du fichier pour l&apos;aperçu.
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-[var(--sf-green)]/45">
        {readOnly
          ? "Aperçu en lecture seule."
          : "Facultatif — un fichier par mandat."}
      </p>

      <DocumentPreviewModal
        open={previewDoc != null}
        documentId={previewDoc?.id ?? null}
        title={previewDoc?.title}
        onClose={() => setPreviewDoc(null)}
      />
    </section>
  );
}
