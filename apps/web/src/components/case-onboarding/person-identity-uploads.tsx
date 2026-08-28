"use client";

import { useMemo, useState } from "react";

import { DocumentPreviewModal } from "@/components/ui/document-preview-modal";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError } from "@/lib/api";
import {
  type CaseDocumentItem,
  uploadCaseDocument,
} from "@/lib/case-onboarding";
import type { PendingIdentityFiles } from "@/lib/upload-pending-identity";
import {
  type IdentitySubject,
  PERSON_IDENTITY_KINDS,
  type PersonIdentityKind,
  previewIdentityFilename,
} from "@/lib/person-identity-documents";

export function filterIdentityDocuments(
  documents: CaseDocumentItem[],
  subject: IdentitySubject,
  entityId?: number | null,
): CaseDocumentItem[] {
  return documents.filter((doc) => {
    if (!doc.identity_kind) return false;
    if (subject === "donor") {
      return entityId != null
        ? doc.donor === entityId
        : doc.donor == null && doc.beneficiary == null && doc.guardian == null;
    }
    if (subject === "beneficiary") {
      return entityId != null
        ? doc.beneficiary === entityId
        : doc.beneficiary == null && doc.guardian == null && doc.donor == null;
    }
    return entityId != null
      ? doc.guardian === entityId
      : doc.guardian == null && doc.beneficiary == null && doc.donor == null;
  });
}

function countReady(
  byKind: Map<string, CaseDocumentItem>,
  pending: PendingIdentityFiles | undefined,
  deferUpload: boolean,
): number {
  return PERSON_IDENTITY_KINDS.filter(({ kind }) => {
    if (byKind.has(kind)) return true;
    if (deferUpload && pending?.[kind]) return true;
    return false;
  }).length;
}

export function PersonIdentityUploads({
  caseId,
  subject,
  entityId,
  firstName,
  lastName,
  documents,
  onUploaded,
  disabled,
  title,
  description,
  compact = false,
  deferUpload = false,
  pendingFiles,
  onPendingFilesChange,
  readOnly = false,
}: {
  caseId: number | null;
  subject: IdentitySubject;
  entityId?: number | null;
  firstName: string;
  lastName: string;
  documents: CaseDocumentItem[];
  onUploaded: () => void;
  disabled?: boolean;
  title?: string;
  description?: string;
  compact?: boolean;
  deferUpload?: boolean;
  pendingFiles?: PendingIdentityFiles;
  onPendingFilesChange?: (files: PendingIdentityFiles) => void;
  /** Lecture seule : aperçu en modale, pas de téléversement */
  readOnly?: boolean;
}) {
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<{ id: number; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const namesReady = firstName.trim().length > 0 && lastName.trim().length > 0;
  const scopedDocuments = useMemo(
    () => (deferUpload ? [] : filterIdentityDocuments(documents, subject, entityId)),
    [documents, subject, entityId, deferUpload],
  );

  const byKind = useMemo(() => {
    const map = new Map<string, CaseDocumentItem>();
    for (const doc of scopedDocuments) {
      if (doc.identity_kind) map.set(doc.identity_kind, doc);
    }
    return map;
  }, [scopedDocuments]);

  const totalCount = PERSON_IDENTITY_KINDS.length;
  const readyCount = countReady(byKind, pendingFiles, deferUpload);
  const progressPct = Math.round((readyCount / totalCount) * 100);

  const defaultTitle =
    subject === "beneficiary"
      ? "Pièces d'identité"
      : subject === "guardian"
        ? "Pièces tuteur"
        : "Pièces d'identité";

  async function handleFile(kind: PersonIdentityKind, file: File | undefined) {
    if (!file || !namesReady) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      setError("Seuls les fichiers PDF sont acceptés.");
      return;
    }

    if (deferUpload && onPendingFilesChange) {
      setError(null);
      onPendingFilesChange({ ...pendingFiles, [kind]: file });
      return;
    }

    if (!caseId) return;
    setUploadingKind(kind);
    setError(null);
    try {
      const base = { identityKind: kind, category: "IDENTITY" as const };
      if (subject === "donor") {
        await uploadCaseDocument(caseId, file, {
          ...base,
          donorId: entityId ?? undefined,
          donorFirstName: firstName.trim(),
          donorLastName: lastName.trim(),
        });
      } else if (subject === "beneficiary") {
        await uploadCaseDocument(caseId, file, {
          ...base,
          beneficiaryId: entityId ?? undefined,
          beneficiaryFirstName: firstName.trim(),
          beneficiaryLastName: lastName.trim(),
        });
      } else {
        await uploadCaseDocument(caseId, file, {
          ...base,
          guardianId: entityId ?? undefined,
          guardianFirstName: firstName.trim(),
          guardianLastName: lastName.trim(),
        });
      }
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec du téléversement.");
    } finally {
      setUploadingKind(null);
    }
  }

  const gridClass = compact
    ? "mt-2 grid grid-cols-2 gap-1.5"
    : "mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4";

  const docCells = PERSON_IDENTITY_KINDS.map(({ kind, label, shortLabel }) => {
    const existing = deferUpload ? undefined : byKind.get(kind);
    const pending = deferUpload ? pendingFiles?.[kind] : undefined;
    const hasFile = Boolean(existing || pending);
    const isPending = deferUpload && Boolean(pending) && !existing;
    const isUploading = uploadingKind === kind;
    const canUpload =
      !readOnly && !disabled && namesReady && (deferUpload || caseId) && !isUploading;
    const canPreview = readOnly && Boolean(existing);

    return (
      <li
        key={kind}
        title={label}
        className={`flex min-w-0 flex-col rounded-md border p-2 transition-colors ${
          hasFile
            ? isPending
              ? "border-amber-200/80 bg-amber-50/50"
              : "border-[var(--sf-green-mid)]/35 bg-white"
            : "border-dashed border-[var(--sf-cream-dark)] bg-white/80"
        }`}
      >
        <div className="flex items-center justify-between gap-1">
          <p className="truncate text-[10px] font-medium text-[var(--sf-green-deep)]">
            {shortLabel}
          </p>
          <span
            className={`shrink-0 rounded px-1 text-[8px] font-semibold uppercase ${
              existing
                ? "bg-emerald-50 text-emerald-800"
                : isPending
                  ? "bg-amber-100 text-amber-900"
                  : "text-[var(--sf-green)]/35"
            }`}
          >
            {existing ? "OK" : isPending ? "·" : "—"}
          </span>
        </div>
        {canPreview && existing ? (
          <button
            type="button"
            onClick={() =>
              setPreviewDoc({
                id: existing.id,
                title: existing.original_filename ?? existing.title,
              })
            }
            className="mt-1 line-clamp-2 w-full text-left text-[9px] font-medium text-[var(--sf-green-mid)] underline-offset-2 hover:underline"
          >
            {existing.original_filename ?? existing.title}
          </button>
        ) : (
          <p className="mt-1 line-clamp-1 text-[9px] text-[var(--sf-green)]/50">
            {existing
              ? existing.original_filename ?? existing.title
              : pending
                ? pending.name
                : "—"}
          </p>
        )}
        {!readOnly ? (
          <label
            className={`mt-1.5 inline-flex w-full justify-center rounded border px-1.5 py-1 text-[10px] font-medium ${
              canUpload
                ? "cursor-pointer border-[var(--sf-green)]/20 hover:bg-[var(--sf-cream)]/60"
                : "cursor-not-allowed border-[var(--sf-cream-dark)] text-[var(--sf-green)]/35"
            }`}
          >
            {isUploading ? "…" : hasFile ? "Rempl." : deferUpload ? "Choisir" : "PDF"}
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              disabled={!canUpload}
              onChange={(e) => {
                void handleFile(kind, e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        ) : existing ? (
          <p className="mt-1 text-center text-[8px] text-[var(--sf-green)]/40">Aperçu</p>
        ) : null}
      </li>
    );
  });

  if (compact) {
    return (
      <section className="rounded-lg border border-[var(--sf-cream-dark)]/80 bg-[var(--sf-cream)]/20 p-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold text-[var(--sf-green-deep)]">
            {title ?? defaultTitle}
          </p>
          <span className="text-[10px] tabular-nums text-[var(--sf-green)]/50">
            {readyCount}/{totalCount}
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--sf-cream-dark)]">
          <div
            className="h-full rounded-full bg-[var(--sf-green-mid)]"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        {!namesReady ? (
          <p className="mt-2 text-[10px] text-amber-900/80">Prénom et nom requis</p>
        ) : deferUpload ? (
          <p className="mt-2 text-[10px] text-amber-900/80">
            Enregistrées avec l&apos;héritier
          </p>
        ) : null}
        {error ? (
          <div className="mt-2">
            <ErrorAlert message={error} />
          </div>
        ) : null}
        <ul className={gridClass}>{docCells}</ul>
        <DocumentPreviewModal
          open={previewDoc != null}
          documentId={previewDoc?.id ?? null}
          title={previewDoc?.title}
          onClose={() => setPreviewDoc(null)}
        />
      </section>
    );
  }

  const exampleName = namesReady
    ? previewIdentityFilename(subject, "CNI", firstName, lastName)
    : "CNI_…_….pdf";

  return (
    <section className="rounded-2xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/20 p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--sf-cream-dark)]/90 pb-4">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-[var(--sf-green-deep)]">
            {title ?? defaultTitle}
          </h3>
          <p className="mt-1 text-sm text-[var(--sf-green)]/60">
            {description ??
              `PDF uniquement (ex. ${exampleName}).`}
          </p>
        </div>
        <p className="text-2xl font-semibold tabular-nums text-[var(--sf-green-deep)]">
          {readyCount}
          <span className="text-base font-normal text-[var(--sf-green)]/45">/{totalCount}</span>
        </p>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[var(--sf-cream-dark)]">
        <div
          className="h-full rounded-full bg-[var(--sf-green-mid)]"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      {!namesReady ? (
        <p className="mt-4 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900/90">
          Renseignez le <strong>prénom</strong> et le <strong>nom</strong> avant les pièces.
        </p>
      ) : deferUpload ? (
        <p className="mt-4 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900/90">
          Les pièces seront enregistrées avec <strong>Enregistrer l&apos;héritier</strong>.
        </p>
      ) : null}
      {error ? (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      ) : null}
      <ul className={gridClass}>{docCells}</ul>
      <DocumentPreviewModal
        open={previewDoc != null}
        documentId={previewDoc?.id ?? null}
        title={previewDoc?.title}
        onClose={() => setPreviewDoc(null)}
      />
    </section>
  );
}
