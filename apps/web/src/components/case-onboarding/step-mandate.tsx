"use client";

import { MandateDocumentUploads } from "@/components/case-onboarding/mandate-document-uploads";
import {
  wizardAsideColumn,
  wizardFieldGrid,
  wizardFormColumn,
  wizardSplitRow,
} from "@/components/case-onboarding/wizard-layout";
import {
  FieldLabel,
  WizardSection,
} from "@/components/case-onboarding/wizard-section";
import { WizardStepHeader } from "@/components/case-onboarding/wizard-step-header";
import type { CaseDocumentItem } from "@/lib/case-onboarding";
import { MANDATE_TYPE_LABELS } from "@/lib/labels";
import type { Mandate } from "@/types/api";

export type MandateFormState = {
  mandate_type: string;
  title: string;
  reference_number: string;
  issuing_authority: string;
  signed_at: string;
  effective_from: string;
  effective_to: string;
  notes: string;
};

export const emptyMandateForm = (mandateType = "FAMILY"): MandateFormState => ({
  mandate_type: mandateType,
  title: "",
  reference_number: "",
  issuing_authority: "",
  signed_at: "",
  effective_from: "",
  effective_to: "",
  notes: "",
});

export function mandateFormValid(form: MandateFormState): boolean {
  return Boolean(form.title.trim());
}

export function mandateToFormState(mandate: Mandate): MandateFormState {
  return {
    mandate_type: mandate.mandate_type,
    title: mandate.title,
    reference_number: mandate.reference_number ?? "",
    issuing_authority: mandate.issuing_authority ?? "",
    signed_at: mandate.signed_at ?? "",
    effective_from: mandate.effective_from ?? "",
    effective_to: mandate.effective_to ?? "",
    notes: mandate.notes ?? "",
  };
}

export function buildMandateRequestBody(form: MandateFormState) {
  return {
    mandate_type: form.mandate_type,
    title: form.title.trim(),
    reference_number: form.reference_number.trim(),
    issuing_authority: form.issuing_authority.trim(),
    signed_at: form.signed_at || null,
    effective_from: form.effective_from || null,
    effective_to: form.effective_to || null,
    notes: form.notes.trim(),
  };
}

export function StepMandate({
  form,
  onChange,
  existing,
  caseId,
  documents,
  onDocumentsChange,
  stepIndex,
  totalSteps,
  variant = "wizard",
  deferNewMandateUpload = false,
  editingMandateId = null,
  pendingMandateFile = null,
  onPendingMandateFileChange,
}: {
  form: MandateFormState;
  onChange: (v: MandateFormState) => void;
  existing: Mandate[];
  caseId: number | null;
  documents: CaseDocumentItem[];
  onDocumentsChange: () => void;
  stepIndex?: number;
  totalSteps?: number;
  /** wizard = assistant complet ; embed = onglet Mandat (formulaire seul) */
  variant?: "wizard" | "embed";
  deferNewMandateUpload?: boolean;
  /** En modification : identifiant du mandat pour l'acte PDF. */
  editingMandateId?: number | null;
  pendingMandateFile?: File | null;
  onPendingMandateFileChange?: (file: File | null) => void;
}) {
  const isWizard = variant === "wizard";

  return (
    <div className={isWizard ? "space-y-8" : ""}>
      {isWizard ? (
        <WizardStepHeader
          title="Mandats"
          description="Enregistrez chaque mandat (acte, décision, procuration) et téléversez le PDF correspondant. Vous pouvez ajouter plusieurs mandats au même dossier."
          stepIndex={stepIndex}
          totalSteps={totalSteps}
        />
      ) : null}

      {isWizard && existing.length > 0 ? (
        <WizardSection title={`Mandats enregistrés (${existing.length})`}>
          <ul className="grid gap-6 lg:grid-cols-2">
            {existing.map((m) => (
              <li
                key={m.id}
                className="grid gap-4 rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 lg:grid-cols-2 lg:items-start"
              >
                <div className="text-sm">
                  <p className="font-medium text-[var(--sf-green-deep)]">{m.title}</p>
                  <p className="mt-1 text-[var(--sf-green)]/50">
                    {MANDATE_TYPE_LABELS[m.mandate_type] ?? m.mandate_type}
                    {m.reference_number ? ` · Réf. ${m.reference_number}` : null}
                  </p>
                  {m.issuing_authority ? (
                    <p className="mt-0.5 text-xs text-[var(--sf-green)]/45">{m.issuing_authority}</p>
                  ) : null}
                  {m.notes?.trim() ? (
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--sf-green)]/50">{m.notes.trim()}</p>
                  ) : null}
                </div>
                <MandateDocumentUploads
                  caseId={caseId}
                  mandateId={m.id}
                  mandateType={m.mandate_type}
                  title={m.title}
                  referenceNumber={m.reference_number ?? ""}
                  documents={documents}
                  onUploaded={onDocumentsChange}
                  sectionTitle={`Acte PDF`}
                  readOnly
                />
              </li>
            ))}
          </ul>
        </WizardSection>
      ) : null}

      {isWizard ? (
        <WizardSection
          title="Nouveau mandat"
          description="Renseignez les informations puis téléversez l'acte PDF."
        >
          <MandateFormBody
            form={form}
            onChange={onChange}
            caseId={caseId}
            documents={documents}
            onDocumentsChange={onDocumentsChange}
            deferNewMandateUpload={deferNewMandateUpload}
            editingMandateId={editingMandateId}
            pendingMandateFile={pendingMandateFile}
            onPendingMandateFileChange={onPendingMandateFileChange}
          />
        </WizardSection>
      ) : (
        <MandateFormBody
          form={form}
          onChange={onChange}
          caseId={caseId}
          documents={documents}
          onDocumentsChange={onDocumentsChange}
          deferNewMandateUpload={deferNewMandateUpload}
          editingMandateId={editingMandateId}
          pendingMandateFile={pendingMandateFile}
          onPendingMandateFileChange={onPendingMandateFileChange}
          compactLayout
        />
      )}
    </div>
  );
}

function MandateFormBody({
  form,
  onChange,
  caseId,
  documents,
  onDocumentsChange,
  deferNewMandateUpload,
  editingMandateId,
  pendingMandateFile,
  onPendingMandateFileChange,
  compactLayout,
}: {
  form: MandateFormState;
  onChange: (v: MandateFormState) => void;
  caseId: number | null;
  documents: CaseDocumentItem[];
  onDocumentsChange: () => void;
  deferNewMandateUpload: boolean;
  editingMandateId?: number | null;
  pendingMandateFile: File | null;
  onPendingMandateFileChange?: (file: File | null) => void;
  compactLayout?: boolean;
}) {
  const fieldGrid = compactLayout
    ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    : wizardFieldGrid;
  const splitRow = compactLayout
    ? "lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-5 lg:gap-y-4"
    : wizardSplitRow;

  return (
        <div className={splitRow}>
          <div className={wizardFormColumn}>
            <div className={fieldGrid}>
              <div>
                <FieldLabel required htmlFor="mandate-type">
                  Type de mandat
                </FieldLabel>
                <select
                  id="mandate-type"
                  value={form.mandate_type}
                  onChange={(e) => onChange({ ...form, mandate_type: e.target.value })}
                  className="sf-input mt-1.5"
                >
                  {Object.entries(MANDATE_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <FieldLabel required htmlFor="mandate-title">
                  Intitulé du mandat
                </FieldLabel>
                <input
                  id="mandate-title"
                  value={form.title}
                  onChange={(e) => onChange({ ...form, title: e.target.value })}
                  className="sf-input mt-1.5"
                  placeholder="Ex. Mandat de protection future"
                />
              </div>
              <div>
                <FieldLabel htmlFor="mandate-ref">N° de référence</FieldLabel>
                <input
                  id="mandate-ref"
                  value={form.reference_number}
                  onChange={(e) => onChange({ ...form, reference_number: e.target.value })}
                  className="sf-input mt-1.5"
                />
              </div>
              <div>
                <FieldLabel htmlFor="mandate-authority">Autorité émettrice</FieldLabel>
                <input
                  id="mandate-authority"
                  value={form.issuing_authority}
                  onChange={(e) => onChange({ ...form, issuing_authority: e.target.value })}
                  className="sf-input mt-1.5"
                />
              </div>
              <div>
                <FieldLabel htmlFor="mandate-signed">Date de signature</FieldLabel>
                <input
                  id="mandate-signed"
                  type="date"
                  value={form.signed_at}
                  onChange={(e) => onChange({ ...form, signed_at: e.target.value })}
                  className="sf-input mt-1.5"
                />
              </div>
              <div>
                <FieldLabel htmlFor="mandate-from">Effet du</FieldLabel>
                <input
                  id="mandate-from"
                  type="date"
                  value={form.effective_from}
                  onChange={(e) => onChange({ ...form, effective_from: e.target.value })}
                  className="sf-input mt-1.5"
                />
              </div>
              <div>
                <FieldLabel htmlFor="mandate-to">Effet au</FieldLabel>
                <input
                  id="mandate-to"
                  type="date"
                  value={form.effective_to}
                  onChange={(e) => onChange({ ...form, effective_to: e.target.value })}
                  className="sf-input mt-1.5"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <FieldLabel htmlFor="mandate-notes">Informations complémentaires</FieldLabel>
                <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                  Contexte, périmètre du mandat, clauses ou remarques utiles au dossier.
                </p>
                <textarea
                  id="mandate-notes"
                  rows={compactLayout ? 3 : 4}
                  value={form.notes}
                  onChange={(e) => onChange({ ...form, notes: e.target.value })}
                  className="sf-input mt-1.5 resize-y"
                  placeholder="Ex. objet du mandat, limitations, lien avec le patrimoine concerné…"
                />
              </div>
            </div>
          </div>
          <div className={compactLayout ? "min-w-0 lg:col-span-5 xl:col-span-4" : wizardAsideColumn}>
            <MandateDocumentUploads
              caseId={caseId}
              mandateId={editingMandateId ?? undefined}
              mandateType={form.mandate_type}
              title={form.title}
              referenceNumber={form.reference_number}
              documents={documents}
              onUploaded={onDocumentsChange}
              sectionTitle={compactLayout ? "Acte PDF" : "Acte PDF — nouveau mandat"}
              deferUpload={deferNewMandateUpload && !editingMandateId}
              pendingFile={pendingMandateFile}
              onPendingFileChange={onPendingMandateFileChange}
            />
          </div>
        </div>
  );
}
