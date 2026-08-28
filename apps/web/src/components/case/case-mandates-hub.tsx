"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { filterMandateDocuments } from "@/components/case-onboarding/mandate-document-uploads";
import {
  buildMandateRequestBody,
  emptyMandateForm,
  mandateFormValid,
  mandateToFormState,
  StepMandate,
  type MandateFormState,
} from "@/components/case-onboarding/step-mandate";
import { MandateDocumentUploads } from "@/components/case-onboarding/mandate-document-uploads";
import { ErrorAlert } from "@/components/ui/error-alert";
import { PasswordConfirmModal } from "@/components/ui/password-confirm-modal";
import { ApiError, apiRequest, verifyPassword } from "@/lib/api";
import {
  type CaseDocumentItem,
  fetchCaseDocuments,
  uploadCaseDocument,
} from "@/lib/case-onboarding";
import {
  formatDate,
  MANDATE_TYPE_LABELS,
  MANDATE_VALIDATION_LABELS,
} from "@/lib/labels";
import { userIsCaseReadOnly } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useCaseDetail } from "@/providers/case-detail-provider";
import type { Mandate } from "@/types/api";

function mapDocuments(
  docs: {
    id: number;
    title: string;
    category: string;
    mandate?: number | null;
    identity_kind?: string;
    original_filename?: string | null;
    created_at: string;
  }[],
): CaseDocumentItem[] {
  return docs.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    donor: null,
    beneficiary: null,
    guardian: null,
    mandate: d.mandate ?? null,
    identity_kind: d.identity_kind ?? "",
    original_filename: d.original_filename ?? null,
    created_at: d.created_at,
  }));
}

function MandateTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded-full bg-[var(--sf-green)]/8 px-2 py-0.5 text-[10px] font-medium text-[var(--sf-green-mid)]">
      {MANDATE_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function PdfStatusBadge({ hasPdf, pending }: { hasPdf: boolean; pending?: boolean }) {
  if (pending) {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-900">
        PDF en attente
      </span>
    );
  }
  if (hasPdf) {
    return (
      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
        PDF OK
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[var(--sf-cream)] px-2 py-0.5 text-[10px] font-medium text-[var(--sf-green)]/45">
      Sans PDF
    </span>
  );
}

function ValidationBadge({ decision }: { decision: string | null | undefined }) {
  if (!decision) return null;
  const label = MANDATE_VALIDATION_LABELS[decision] ?? decision;
  const tone =
    decision === "APPROVED"
      ? "bg-emerald-50 text-emerald-800"
      : decision === "REJECTED"
        ? "bg-red-50 text-red-800"
        : decision === "REQUEST_CHANGES"
          ? "bg-amber-100 text-amber-900"
          : "bg-[var(--sf-cream)] text-[var(--sf-green)]/55";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      {label}
    </span>
  );
}

function MandateCard({
  mandate,
  caseId,
  documents,
  onDocumentsChange,
  onEdit,
  readOnly = false,
}: {
  mandate: Mandate;
  caseId: number;
  documents: CaseDocumentItem[];
  onDocumentsChange: () => void;
  onEdit: () => void;
  readOnly?: boolean;
}) {
  const hasPdf = filterMandateDocuments(documents, mandate.id).length > 0;

  const infoRows: { label: string; value: string }[] = [
    { label: "Type", value: MANDATE_TYPE_LABELS[mandate.mandate_type] ?? mandate.mandate_type },
  ];
  if (mandate.reference_number) {
    infoRows.push({ label: "Référence", value: mandate.reference_number });
  }
  if (mandate.issuing_authority) {
    infoRows.push({ label: "Autorité", value: mandate.issuing_authority });
  }
  if (mandate.signed_at) {
    infoRows.push({ label: "Signature", value: formatDate(mandate.signed_at) });
  }
  if (mandate.effective_from || mandate.effective_to) {
    infoRows.push({
      label: "Validité",
      value: `${mandate.effective_from ? formatDate(mandate.effective_from) : "—"} → ${mandate.effective_to ? formatDate(mandate.effective_to) : "—"}`,
    });
  }

  return (
    <article className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-3 shadow-sm sm:p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_minmax(220px,300px)] lg:items-start lg:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <MandateTypeBadge type={mandate.mandate_type} />
              <ValidationBadge decision={mandate.latest_decision} />
              <PdfStatusBadge hasPdf={hasPdf} />
            </div>
            {!readOnly ? (
              <button
                type="button"
                onClick={onEdit}
                className="text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
              >
                Modifier
              </button>
            ) : null}
          </div>
          <h3 className="mt-1.5 text-sm font-semibold leading-snug text-[var(--sf-green-deep)] sm:text-base">
            {mandate.title}
          </h3>
          <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {infoRows.map((row) => (
              <div key={row.label} className="rounded-md bg-[var(--sf-cream)]/40 px-2 py-1.5">
                <dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                  {row.label}
                </dt>
                <dd className="text-xs font-medium text-[var(--sf-green-deep)]">{row.value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-2 rounded-md border border-[var(--sf-cream-dark)]/80 bg-[var(--sf-cream)]/30 px-2.5 py-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
              Informations complémentaires
            </p>
            {mandate.notes?.trim() ? (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-[var(--sf-green-deep)]">
                {mandate.notes.trim()}
              </p>
            ) : (
              <p className="mt-1 text-xs italic text-[var(--sf-green)]/45">
                Non renseignées — utilisez Modifier pour décrire le contexte du mandat.
              </p>
            )}
          </div>
        </div>
        <MandateDocumentUploads
          caseId={caseId}
          mandateId={mandate.id}
          mandateType={mandate.mandate_type}
          title={mandate.title}
          referenceNumber={mandate.reference_number ?? ""}
          documents={documents}
          onUploaded={onDocumentsChange}
          compact
          readOnly
        />
      </div>
    </article>
  );
}

function MandatesEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 px-4 py-6 text-center">
      <p className="text-sm font-medium text-[var(--sf-green-deep)]">Aucun mandat</p>
      <p className="mt-1 text-xs text-[var(--sf-green)]/50">
        Ajoutez un acte, une décision ou une procuration.
      </p>
      <button type="button" onClick={onAdd} className="mt-3 sf-btn-primary text-sm">
        + Nouveau mandat
      </button>
    </div>
  );
}

export function CaseMandatesHub() {
  const { user } = useAuth();
  const { data, caseId, reload } = useCaseDetail();
  const readOnly = userIsCaseReadOnly(user, data?.status);
  const numericCaseId = caseId ? Number(caseId) : null;
  const [documents, setDocuments] = useState<CaseDocumentItem[]>([]);
  const [form, setForm] = useState<MandateFormState>(emptyMandateForm());
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pendingMandatePdf, setPendingMandatePdf] = useState<File | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const reloadDocuments = useCallback(async () => {
    if (!numericCaseId) return;
    const docs = await fetchCaseDocuments(numericCaseId);
    setDocuments(docs);
  }, [numericCaseId]);

  useEffect(() => {
    if (data?.documents?.length) {
      setDocuments(mapDocuments(data.documents));
      return;
    }
    void reloadDocuments();
  }, [data?.documents, reloadDocuments]);

  const stats = useMemo(() => {
    if (!data) return { total: 0, withPdf: 0 };
    let withPdf = 0;
    for (const m of data.mandates) {
      if (filterMandateDocuments(documents, m.id).length > 0) withPdf += 1;
    }
    return { total: data.mandates.length, withPdf };
  }, [data, documents]);

  if (!data || !numericCaseId) return null;

  async function addMandate() {
    if (!mandateFormValid(form)) return;
    setAdding(true);
    setError(null);
    try {
      const created = await apiRequest<Mandate>(`/cases/${numericCaseId}/mandates/`, {
        method: "POST",
        body: JSON.stringify(buildMandateRequestBody(form)),
      });
      if (pendingMandatePdf) {
        await uploadCaseDocument(numericCaseId!, pendingMandatePdf, {
          category: "MANDATE",
          mandateId: created.id,
          mandateType: form.mandate_type,
          mandateTitle: form.title.trim(),
          mandateReferenceNumber: form.reference_number.trim(),
        });
      }
      await reload();
      await reloadDocuments();
      cancelForm();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur lors de l'ajout du mandat.");
    } finally {
      setAdding(false);
    }
  }

  async function updateMandate() {
    if (!editingId || !mandateFormValid(form)) return;
    setAdding(true);
    setError(null);
    try {
      await apiRequest<Mandate>(`/mandates/${editingId}/`, {
        method: "PATCH",
        body: JSON.stringify(buildMandateRequestBody(form)),
      });
      if (pendingMandatePdf) {
        await uploadCaseDocument(numericCaseId!, pendingMandatePdf, {
          category: "MANDATE",
          mandateId: editingId,
          mandateType: form.mandate_type,
          mandateTitle: form.title.trim(),
          mandateReferenceNumber: form.reference_number.trim(),
        });
      }
      await reload();
      await reloadDocuments();
      cancelForm();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de la modification du mandat.",
      );
    } finally {
      setAdding(false);
    }
  }

  async function handleDocumentsChange() {
    await reloadDocuments();
    await reload();
  }

  function openNewMandateForm() {
    setEditingId(null);
    setForm(emptyMandateForm());
    setPendingMandatePdf(null);
    setError(null);
    setShowForm(true);
  }

  function openEditForm(mandate: Mandate) {
    setEditingId(mandate.id);
    setForm(mandateToFormState(mandate));
    setPendingMandatePdf(null);
    setError(null);
    setShowForm(true);
  }

  function cancelForm() {
    setForm(emptyMandateForm());
    setPendingMandatePdf(null);
    setShowForm(false);
    setEditingId(null);
    setError(null);
    setPasswordModalOpen(false);
    setPasswordError(null);
  }

  function requestSave() {
    if (!mandateFormValid(form)) return;
    if (editingId) {
      setPasswordError(null);
      setPasswordModalOpen(true);
      return;
    }
    void addMandate();
  }

  async function confirmPasswordAndSave(password: string) {
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await verifyPassword(password);
      setPasswordModalOpen(false);
      await updateMandate();
    } catch (err) {
      setPasswordError(
        err instanceof ApiError
          ? err.message
          : "Mot de passe incorrect ou erreur de vérification.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
            Mandats
            {stats.total > 0 ? (
              <span className="ml-2 text-xs font-normal text-[var(--sf-green)]/50">
                {stats.total} · {stats.withPdf} PDF
              </span>
            ) : null}
          </h2>
        </div>
        {!readOnly && !showForm ? (
          <button
            type="button"
            onClick={openNewMandateForm}
            className="sf-btn-primary shrink-0 text-sm"
          >
            + Nouveau mandat
          </button>
        ) : null}
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      {!showForm && data.mandates.length > 0 ? (
        <ul className="space-y-2.5">
          {data.mandates.map((m) => (
            <li key={m.id}>
              <MandateCard
                mandate={m}
                caseId={numericCaseId}
                documents={documents}
                onDocumentsChange={() => void handleDocumentsChange()}
                onEdit={() => openEditForm(m)}
                readOnly={readOnly}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {!showForm && data.mandates.length === 0 ? (
        readOnly ? (
          <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 px-4 py-6 text-center text-sm text-[var(--sf-green)]/55">
            Aucun mandat enregistré.
          </div>
        ) : (
          <MandatesEmptyState onAdd={openNewMandateForm} />
        )
      ) : null}

      {!readOnly && showForm ? (
        <section className="rounded-xl border border-[var(--sf-green-mid)]/20 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--sf-cream-dark)] px-3 py-2.5 sm:px-4">
            <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
              {editingId ? "Modifier le mandat" : "Nouveau mandat"}
            </h3>
            <div className="flex items-center gap-2">
              {pendingMandatePdf ? <PdfStatusBadge hasPdf={false} pending /> : null}
              <button
                type="button"
                onClick={cancelForm}
                className="text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
              >
                Fermer
              </button>
            </div>
          </div>

          <div className="p-3 sm:p-4">
            <StepMandate
              variant="embed"
              form={form}
              onChange={setForm}
              existing={[]}
              caseId={numericCaseId}
              documents={documents}
              onDocumentsChange={() => void handleDocumentsChange()}
              deferNewMandateUpload={!editingId}
              editingMandateId={editingId}
              pendingMandateFile={pendingMandatePdf}
              onPendingMandateFileChange={setPendingMandatePdf}
            />
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--sf-cream-dark)] px-3 py-2.5 sm:px-4">
            <button
              type="button"
              disabled={adding}
              onClick={cancelForm}
              className="sf-btn-secondary text-sm"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={adding || !mandateFormValid(form)}
              onClick={() => requestSave()}
              className="sf-btn-primary text-sm"
            >
              {adding
                ? "Enregistrement…"
                : editingId
                  ? "Enregistrer les modifications"
                  : "Enregistrer le mandat"}
            </button>
          </div>
        </section>
      ) : null}

      <PasswordConfirmModal
        open={passwordModalOpen}
        title="Confirmer la modification"
        description="Saisissez votre mot de passe pour enregistrer les changements sur ce mandat."
        confirmLabel="Enregistrer"
        busy={passwordBusy || adding}
        error={passwordError}
        onClose={() => {
          if (!passwordBusy && !adding) {
            setPasswordModalOpen(false);
            setPasswordError(null);
          }
        }}
        onConfirm={confirmPasswordAndSave}
      />

      <p className="text-center text-[11px] text-[var(--sf-green)]/40">
        <Link
          href={`/dossiers/${caseId}/enregistrement?step=mandate`}
          className="font-medium text-[var(--sf-green-mid)] hover:underline"
        >
          Assistant d&apos;enregistrement
        </Link>
      </p>
    </div>
  );
}
