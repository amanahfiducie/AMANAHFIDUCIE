"use client";

import { PersonIdentityUploads } from "@/components/case-onboarding/person-identity-uploads";
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
import {
  getAvailableDonorRelations,
  parseDonorSmartRelation,
} from "@/lib/case-onboarding";
import { computePersonAge, formatMoney, formatSharePercent } from "@/lib/labels";
import type { PendingIdentityFiles } from "@/lib/upload-pending-identity";
import type { Beneficiary, CaseDonor, Guardian } from "@/types/api";

export type BeneficiaryFormState = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  is_minor: boolean;
  nationality: string;
  identification_number: string;
  notes: string;
  patrimony_share_percent: string;
  relation_to_donor: string;
  guardian_mode: "existing" | "new";
  guardian_id: string;
  guardian_first_name: string;
  guardian_last_name: string;
  guardian_relationship_label: string;
  guardian_email: string;
  guardian_phone: string;
};

export const emptyBeneficiaryForm = (): BeneficiaryFormState => ({
  first_name: "",
  last_name: "",
  date_of_birth: "",
  is_minor: false,
  nationality: "",
  identification_number: "",
  notes: "",
  patrimony_share_percent: "",
  relation_to_donor: "",
  guardian_mode: "existing",
  guardian_id: "",
  guardian_first_name: "",
  guardian_last_name: "",
  guardian_relationship_label: "",
  guardian_email: "",
  guardian_phone: "",
});

function buildBeneficiaryPayload(
  form: BeneficiaryFormState,
  donorId: number | null,
  requireGuardian: boolean,
) {
  const { relation_to_donor, gender } = parseDonorSmartRelation(form.relation_to_donor);
  const body: Record<string, unknown> = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    date_of_birth: form.date_of_birth || null,
    nationality: form.nationality.trim(),
    identification_number: form.identification_number.trim(),
    notes: form.notes.trim(),
    patrimony_share_percent: form.patrimony_share_percent.trim()
      ? form.patrimony_share_percent.trim()
      : null,
    is_minor: form.is_minor,
    relation_to_donor: relation_to_donor || "",
    donor: donorId,
  };
  if (gender) {
    body.gender = gender;
  }

  if (form.guardian_mode === "existing" && form.guardian_id) {
    body.guardian_id = Number(form.guardian_id);
  } else if (form.guardian_mode === "new") {
    body.new_guardian = {
      first_name: form.guardian_first_name.trim(),
      last_name: form.guardian_last_name.trim(),
      relationship_label: form.guardian_relationship_label.trim(),
      email: form.guardian_email.trim(),
      phone: form.guardian_phone.trim(),
    };
  } else if (requireGuardian) {
    throw new Error("Un tuteur est requis pour cet héritier.");
  }

  return body;
}

export function beneficiaryFormValid(
  form: BeneficiaryFormState,
  requireGuardian: boolean,
  existingGuardians: Guardian[],
): boolean {
  if (!form.first_name.trim() || !form.last_name.trim() || !form.relation_to_donor) {
    return false;
  }
  if (!requireGuardian) return true;
  if (existingGuardians.length === 0) {
    return Boolean(form.guardian_first_name.trim() && form.guardian_last_name.trim());
  }
  if (form.guardian_mode === "existing") {
    return Boolean(form.guardian_id);
  }
  return Boolean(form.guardian_first_name.trim() && form.guardian_last_name.trim());
}

export function buildBeneficiaryRequestBody(
  form: BeneficiaryFormState,
  donorId: number | null,
  requireGuardian: boolean,
) {
  return buildBeneficiaryPayload(form, donorId, requireGuardian);
}

export function beneficiaryToFormState(
  beneficiary: Beneficiary,
  guardian?: Guardian | null,
): BeneficiaryFormState {
  const g = guardian ?? null;
  const hasGuardian = Boolean(beneficiary.guardian);
  const genderSuffix =
    beneficiary.gender === "M" || beneficiary.gender === "F" ? beneficiary.gender : "";
  const smartRelation = beneficiary.relation_to_donor
    ? genderSuffix
      ? `DONOR:${beneficiary.relation_to_donor}:${genderSuffix}`
      : `DONOR:${beneficiary.relation_to_donor}:`
    : "";
  return {
    first_name: beneficiary.first_name,
    last_name: beneficiary.last_name,
    date_of_birth: beneficiary.date_of_birth ?? "",
    is_minor: beneficiary.is_minor,
    nationality: beneficiary.nationality ?? "",
    identification_number: beneficiary.identification_number ?? "",
    notes: beneficiary.notes ?? "",
    patrimony_share_percent:
      beneficiary.patrimony_share_percent != null &&
      beneficiary.patrimony_share_percent !== ""
        ? String(beneficiary.patrimony_share_percent)
        : "",
    relation_to_donor: smartRelation || beneficiary.relation_to_donor || "",
    guardian_mode: hasGuardian ? "existing" : "new",
    guardian_id: beneficiary.guardian ? String(beneficiary.guardian) : "",
    guardian_first_name: g?.first_name ?? "",
    guardian_last_name: g?.last_name ?? "",
    guardian_relationship_label: g?.relationship_label ?? "",
    guardian_email: g?.email ?? "",
    guardian_phone: g?.phone ?? "",
  };
}

export function buildBeneficiaryUpdateBody(
  form: BeneficiaryFormState,
  donorId: number | null,
  requireGuardian: boolean,
) {
  const { relation_to_donor, gender } = parseDonorSmartRelation(form.relation_to_donor);
  const body: Record<string, unknown> = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    date_of_birth: form.date_of_birth || null,
    nationality: form.nationality.trim(),
    identification_number: form.identification_number.trim(),
    notes: form.notes.trim(),
    patrimony_share_percent: form.patrimony_share_percent.trim()
      ? form.patrimony_share_percent.trim()
      : null,
    is_minor: form.is_minor,
    relation_to_donor: relation_to_donor || "",
    donor: donorId,
  };
  if (gender) {
    body.gender = gender;
  }

  if (!form.is_minor) {
    body.guardian_id = null;
  } else if (form.guardian_mode === "existing" && form.guardian_id) {
    body.guardian_id = Number(form.guardian_id);
  }

  return body;
}

export function StepBeneficiary({
  form,
  onChange,
  existing,
  existingGuardians,
  donor,
  optional,
  requireGuardian,
  stepIndex,
  totalSteps,
  caseId,
  documents,
  onDocumentsChange,
  variant = "wizard",
  deferNewBeneficiaryUpload = false,
  editingBeneficiaryId = null,
  pendingBeneficiaryFiles,
  onPendingBeneficiaryFilesChange,
  pendingGuardianFiles,
  onPendingGuardianFilesChange,
  casePatrimonyTotal = null,
  casePatrimonyCurrency = "XOF",
}: {
  form: BeneficiaryFormState;
  onChange: (v: BeneficiaryFormState) => void;
  existing: Beneficiary[];
  existingGuardians: Guardian[];
  donor: CaseDonor | null;
  optional?: boolean;
  requireGuardian: boolean;
  casePatrimonyTotal?: string | null;
  casePatrimonyCurrency?: string;
  stepIndex?: number;
  totalSteps?: number;
  caseId: number | null;
  documents: CaseDocumentItem[];
  onDocumentsChange: () => void;
  variant?: "wizard" | "embed";
  deferNewBeneficiaryUpload?: boolean;
  /** En modification : identifiant de l'héritier pour les pièces d'identité. */
  editingBeneficiaryId?: number | null;
  pendingBeneficiaryFiles?: PendingIdentityFiles;
  onPendingBeneficiaryFilesChange?: (files: PendingIdentityFiles) => void;
  pendingGuardianFiles?: PendingIdentityFiles;
  onPendingGuardianFilesChange?: (files: PendingIdentityFiles) => void;
}) {
  const isWizard = variant === "wizard";
  const hasGuardians = existingGuardians.length > 0;
  const selectedGuardian = form.guardian_id
    ? existingGuardians.find((g) => g.id === Number(form.guardian_id))
    : undefined;
  const showGuardianUploads =
    form.guardian_mode === "new"
      ? form.guardian_first_name.trim().length > 0 || form.guardian_last_name.trim().length > 0
      : Boolean(selectedGuardian);

  return (
    <div className={isWizard ? "space-y-8" : ""}>
      {isWizard ? (
      <WizardStepHeader
        title="Héritiers / bénéficiaires"
        description={
          optional
            ? "Ajoutez les parties concernées si besoin. Un tuteur est obligatoire uniquement pour les mineurs."
            : "Enregistrez chaque héritier. Le tuteur est obligatoire seulement si la case Mineur est cochée ; plusieurs héritiers peuvent partager le même tuteur."
        }
        stepIndex={stepIndex}
        totalSteps={totalSteps}
      />
      ) : null}

      {isWizard && donor ? (
        <p className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/50 px-4 py-3 text-sm text-[var(--sf-green-deep)]">
          Donateur : <strong>{donor.first_name} {donor.last_name}</strong>
        </p>
      ) : isWizard ? (
        <p className="rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
          Complétez d&apos;abord l&apos;étape Donateur pour indiquer le lien familial.
        </p>
      ) : !donor ? (
        <p className="mb-3 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-900">
          Donateur requis pour le lien familial — complétez l&apos;enregistrement.
        </p>
      ) : null}

      {isWizard && existing.length > 0 ? (
        <WizardSection title={`Héritiers enregistrés (${existing.length})`}>
          <ul className="grid gap-6 lg:grid-cols-2">
            {existing.map((b) => (
              <li
                key={b.id}
                className="flex flex-col gap-4 rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
                  <div>
                    <p className="font-medium text-[var(--sf-green-deep)]">
                      {b.first_name} {b.last_name}
                      {b.is_minor ? (
                        <span className="ml-2 text-xs font-normal text-amber-800">(mineur)</span>
                      ) : null}
                    </p>
                    {b.relation_to_donor_label ? (
                      <p className="text-xs text-[var(--sf-green)]/50">
                        {b.relation_to_donor_label}
                      </p>
                    ) : null}
                    {computePersonAge(b.date_of_birth) ? (
                      <p className="text-xs font-medium text-[var(--sf-green-mid)]">
                        {computePersonAge(b.date_of_birth)}
                      </p>
                    ) : null}
                    {b.nationality ? (
                      <p className="text-xs text-[var(--sf-green)]/45">{b.nationality}</p>
                    ) : null}
                    {formatSharePercent(b.patrimony_share_percent) ? (
                      <p className="text-xs font-medium text-[var(--sf-green-mid)]">
                        Part : {formatSharePercent(b.patrimony_share_percent)}
                        {b.patrimony_share_value && b.case_patrimony_total
                          ? ` · ${formatMoney(b.patrimony_share_value)} / ${formatMoney(b.case_patrimony_total)}`
                          : null}
                      </p>
                    ) : null}
                    {b.notes?.trim() ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--sf-green)]/50">
                        {b.notes.trim()}
                      </p>
                    ) : null}
                  </div>
                  {b.guardian_name ? (
                    <p className="text-xs text-[var(--sf-green-mid)]">
                      Tuteur : {b.guardian_name}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-800/70">Sans tuteur</p>
                  )}
                </div>
                <PersonIdentityUploads
                  caseId={caseId}
                  subject="beneficiary"
                  entityId={b.id}
                  firstName={b.first_name}
                  lastName={b.last_name}
                  documents={documents}
                  onUploaded={onDocumentsChange}
                  title={`Pièces — ${b.first_name} ${b.last_name}`}
                  readOnly
                />
              </li>
            ))}
          </ul>
        </WizardSection>
      ) : null}

      {isWizard ? (
        <WizardSection
          title="Nouvel héritier"
          description="Renseignez l'identité puis le tuteur associé."
        >
          <BeneficiaryFormBody
            form={form}
            onChange={onChange}
            donor={donor}
            existing={existing}
            existingGuardians={existingGuardians}
            requireGuardian={requireGuardian}
            hasGuardians={hasGuardians}
            selectedGuardian={selectedGuardian}
            showGuardianUploads={showGuardianUploads}
            caseId={caseId}
            documents={documents}
            onDocumentsChange={onDocumentsChange}
            deferNewBeneficiaryUpload={deferNewBeneficiaryUpload}
            editingBeneficiaryId={editingBeneficiaryId}
            pendingBeneficiaryFiles={pendingBeneficiaryFiles}
            onPendingBeneficiaryFilesChange={onPendingBeneficiaryFilesChange}
            pendingGuardianFiles={pendingGuardianFiles}
            onPendingGuardianFilesChange={onPendingGuardianFilesChange}
            casePatrimonyTotal={casePatrimonyTotal}
            casePatrimonyCurrency={casePatrimonyCurrency}
          />
        </WizardSection>
      ) : (
        <BeneficiaryFormBody
          form={form}
          onChange={onChange}
          donor={donor}
          existing={existing}
          existingGuardians={existingGuardians}
          requireGuardian={requireGuardian}
          hasGuardians={hasGuardians}
          selectedGuardian={selectedGuardian}
          showGuardianUploads={showGuardianUploads}
          caseId={caseId}
          documents={documents}
          onDocumentsChange={onDocumentsChange}
          deferNewBeneficiaryUpload={deferNewBeneficiaryUpload}
          editingBeneficiaryId={editingBeneficiaryId}
          pendingBeneficiaryFiles={pendingBeneficiaryFiles}
          onPendingBeneficiaryFilesChange={onPendingBeneficiaryFilesChange}
          pendingGuardianFiles={pendingGuardianFiles}
          onPendingGuardianFilesChange={onPendingGuardianFilesChange}
          compactLayout
          casePatrimonyTotal={casePatrimonyTotal}
          casePatrimonyCurrency={casePatrimonyCurrency}
        />
      )}
    </div>
  );
}

function BeneficiaryFormBody({
  form,
  onChange,
  donor,
  existing,
  existingGuardians,
  requireGuardian,
  hasGuardians,
  selectedGuardian,
  showGuardianUploads,
  caseId,
  documents,
  onDocumentsChange,
  deferNewBeneficiaryUpload,
  editingBeneficiaryId,
  pendingBeneficiaryFiles,
  onPendingBeneficiaryFilesChange,
  pendingGuardianFiles,
  onPendingGuardianFilesChange,
  compactLayout,
  casePatrimonyTotal,
  casePatrimonyCurrency,
}: {
  form: BeneficiaryFormState;
  onChange: (v: BeneficiaryFormState) => void;
  donor: CaseDonor | null;
  existing: Beneficiary[];
  casePatrimonyTotal?: string | null;
  casePatrimonyCurrency?: string;
  existingGuardians: Guardian[];
  requireGuardian: boolean;
  hasGuardians: boolean;
  selectedGuardian?: Guardian;
  showGuardianUploads: boolean;
  caseId: number | null;
  documents: CaseDocumentItem[];
  onDocumentsChange: () => void;
  deferNewBeneficiaryUpload: boolean;
  editingBeneficiaryId?: number | null;
  pendingBeneficiaryFiles?: PendingIdentityFiles;
  onPendingBeneficiaryFilesChange?: (files: PendingIdentityFiles) => void;
  pendingGuardianFiles?: PendingIdentityFiles;
  onPendingGuardianFilesChange?: (files: PendingIdentityFiles) => void;
  compactLayout?: boolean;
}) {
  const sharePercent = form.patrimony_share_percent.trim();
  const sharePercentNum = sharePercent ? Number(sharePercent) : NaN;
  const totalNum = casePatrimonyTotal ? Number(casePatrimonyTotal) : NaN;
  const donorRelations = getAvailableDonorRelations(existing);
  const selectedRelation = parseDonorSmartRelation(form.relation_to_donor);
  const estimatedShareValue =
    !Number.isNaN(sharePercentNum) &&
    !Number.isNaN(totalNum) &&
    totalNum > 0 &&
    sharePercentNum >= 0
      ? formatMoney(String((totalNum * sharePercentNum) / 100))
      : null;

  const fieldGrid = compactLayout
    ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    : wizardFieldGrid;
  const splitRow = compactLayout
    ? "lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-5 lg:gap-y-4"
    : wizardSplitRow;

  return (
        <div className={splitRow}>
          <div className={`${wizardFormColumn} space-y-6`}>
        <div className={fieldGrid}>
          <div>
            <FieldLabel required htmlFor="ben-first-name">
              Prénom
            </FieldLabel>
            <input
              id="ben-first-name"
              value={form.first_name}
              onChange={(e) => onChange({ ...form, first_name: e.target.value })}
              className="sf-input mt-1.5"
            />
          </div>
          <div>
            <FieldLabel required htmlFor="ben-last-name">
              Nom
            </FieldLabel>
            <input
              id="ben-last-name"
              value={form.last_name}
              onChange={(e) => onChange({ ...form, last_name: e.target.value })}
              className="sf-input mt-1.5"
            />
          </div>
          <div>
            <FieldLabel htmlFor="ben-dob">Date de naissance</FieldLabel>
            <input
              id="ben-dob"
              type="date"
              value={form.date_of_birth}
              onChange={(e) => onChange({ ...form, date_of_birth: e.target.value })}
              className="sf-input mt-1.5"
            />
            {form.date_of_birth && computePersonAge(form.date_of_birth) ? (
              <p className="mt-1 text-xs font-medium text-[var(--sf-green-mid)]">
                Âge : {computePersonAge(form.date_of_birth)}
              </p>
            ) : null}
          </div>
          <div>
            <FieldLabel htmlFor="ben-nationality">Nationalité</FieldLabel>
            <input
              id="ben-nationality"
              value={form.nationality}
              onChange={(e) => onChange({ ...form, nationality: e.target.value })}
              className="sf-input mt-1.5"
              placeholder="Ex. Sénégalaise"
            />
          </div>
          <div>
            <FieldLabel htmlFor="ben-id">N° pièce d&apos;identité</FieldLabel>
            <input
              id="ben-id"
              value={form.identification_number}
              onChange={(e) =>
                onChange({ ...form, identification_number: e.target.value })
              }
              className="sf-input mt-1.5"
            />
          </div>
          <div>
            <FieldLabel required htmlFor="ben-relation">
              Lien avec le donateur
            </FieldLabel>
            <select
              id="ben-relation"
              value={form.relation_to_donor}
              onChange={(e) => onChange({ ...form, relation_to_donor: e.target.value })}
              className="sf-input mt-1.5"
              disabled={!donor}
            >
              <option value="">— Choisir le lien —</option>
              {donorRelations.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {selectedRelation.relation_to_donor ? (
              <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                Le sexe est inclus dans le lien choisi — aucun champ supplémentaire.
              </p>
            ) : null}
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_minor}
                onChange={(e) => {
                  const isMinor = e.target.checked;
                  onChange({
                    ...form,
                    is_minor: isMinor,
                    ...(isMinor
                      ? {}
                      : {
                          guardian_mode: "existing" as const,
                          guardian_id: "",
                          guardian_first_name: "",
                          guardian_last_name: "",
                          guardian_relationship_label: "",
                          guardian_email: "",
                          guardian_phone: "",
                        }),
                  });
                }}
              />
              Mineur
            </label>
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <FieldLabel htmlFor="ben-notes">Situation de la personne</FieldLabel>
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
              Décrivez le contexte familial, social ou patrimonial utile au suivi du dossier.
            </p>
            <textarea
              id="ben-notes"
              rows={compactLayout ? 3 : 4}
              value={form.notes}
              onChange={(e) => onChange({ ...form, notes: e.target.value })}
              className="sf-input mt-1.5 resize-y"
              placeholder="Ex. études en cours, situation de handicap, garde partagée, dépendance, projet de transmission…"
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-3">
            <FieldLabel htmlFor="ben-share">Part du patrimoine</FieldLabel>
            {casePatrimonyTotal && Number(casePatrimonyTotal) > 0 ? (
              <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                Patrimoine total du dossier : {formatMoney(casePatrimonyTotal)}
                {casePatrimonyCurrency ? ` ${casePatrimonyCurrency}` : ""}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-amber-900/80">
                Aucune valorisation patrimoniale — complétez l&apos;onglet Patrimoine pour
                calculer la part.
              </p>
            )}
            <div className="mt-1.5 flex items-center gap-2">
              <input
                id="ben-share"
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.patrimony_share_percent}
                onChange={(e) =>
                  onChange({ ...form, patrimony_share_percent: e.target.value })
                }
                className="sf-input w-28"
                placeholder="Ex. 25"
              />
              <span className="text-sm text-[var(--sf-green)]/50">%</span>
            </div>
            {estimatedShareValue ? (
              <p className="mt-1 text-xs font-medium text-[var(--sf-green-mid)]">
                Valeur de la part : {estimatedShareValue}
                {casePatrimonyCurrency ? ` ${casePatrimonyCurrency}` : ""}
                {formatSharePercent(form.patrimony_share_percent)
                  ? ` (${formatSharePercent(form.patrimony_share_percent)} du patrimoine)`
                  : null}
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[var(--sf-cream-dark)] pt-6">
          <h4 className="text-sm font-semibold text-[var(--sf-green-deep)]">
            Tuteur{" "}
            {requireGuardian ? (
              <span className="text-[var(--sf-green-mid)]">*</span>
            ) : (
              <span className="text-xs font-normal text-[var(--sf-green)]/45">(facultatif)</span>
            )}
          </h4>
          {requireGuardian ? (
            <p className="mt-1 text-xs text-amber-900/80">
              Obligatoire pour un bénéficiaire mineur.
            </p>
          ) : null}

          {form.guardian_mode === "new" ? (
            <>
              <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                Renseignez les informations du nouveau tuteur.
              </p>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...form,
                    guardian_mode: "existing",
                    guardian_first_name: "",
                    guardian_last_name: "",
                    guardian_relationship_label: "",
                    guardian_email: "",
                    guardian_phone: "",
                  })
                }
                className="mt-3 text-xs font-medium text-[var(--sf-green-mid)] hover:text-[var(--sf-green)] hover:underline"
              >
                ← Choisir un tuteur déjà enregistré
              </button>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <FieldLabel required htmlFor="g-first-name">
                    Prénom du tuteur
                  </FieldLabel>
                  <input
                    id="g-first-name"
                    value={form.guardian_first_name}
                    onChange={(e) =>
                      onChange({ ...form, guardian_first_name: e.target.value })
                    }
                    className="sf-input mt-1.5"
                  />
                </div>
                <div>
                  <FieldLabel required htmlFor="g-last-name">
                    Nom du tuteur
                  </FieldLabel>
                  <input
                    id="g-last-name"
                    value={form.guardian_last_name}
                    onChange={(e) =>
                      onChange({ ...form, guardian_last_name: e.target.value })
                    }
                    className="sf-input mt-1.5"
                  />
                </div>
                <div className="sm:col-span-2 lg:col-span-1">
                  <FieldLabel htmlFor="g-relation">Lien / qualité</FieldLabel>
                  <input
                    id="g-relation"
                    value={form.guardian_relationship_label}
                    onChange={(e) =>
                      onChange({ ...form, guardian_relationship_label: e.target.value })
                    }
                    className="sf-input mt-1.5"
                    placeholder="Ex. Tuteur légal, oncle maternel"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="g-phone">Téléphone</FieldLabel>
                  <input
                    id="g-phone"
                    type="tel"
                    value={form.guardian_phone}
                    onChange={(e) => onChange({ ...form, guardian_phone: e.target.value })}
                    className="sf-input mt-1.5"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="g-email">E-mail</FieldLabel>
                  <input
                    id="g-email"
                    type="email"
                    value={form.guardian_email}
                    onChange={(e) => onChange({ ...form, guardian_email: e.target.value })}
                    className="sf-input mt-1.5"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                {requireGuardian
                  ? hasGuardians
                    ? "Sélectionnez le tuteur du mineur ou créez-en un nouveau."
                    : "Créez le tuteur du mineur (aucun tuteur enregistré dans le dossier)."
                  : hasGuardians
                    ? "Vous pouvez associer un tuteur existant ou en créer un nouveau."
                    : "Vous pouvez créer un tuteur si nécessaire."}
              </p>
              <div className="mt-4">
                <FieldLabel required={requireGuardian} htmlFor="ben-guardian-id">
                  Tuteur
                </FieldLabel>
                <select
                  id="ben-guardian-id"
                  value={form.guardian_id}
                  onChange={(e) => onChange({ ...form, guardian_id: e.target.value })}
                  className="sf-input mt-1.5"
                  disabled={!hasGuardians}
                >
                  <option value="">
                    {hasGuardians
                      ? "— Choisir un tuteur —"
                      : "— Aucun tuteur disponible —"}
                  </option>
                  {existingGuardians.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.first_name} {g.last_name}
                      {g.relationship_label ? ` (${g.relationship_label})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    ...form,
                    guardian_mode: "new",
                    guardian_id: "",
                  })
                }
                className="mt-3 text-sm font-medium text-[var(--sf-green-mid)] hover:text-[var(--sf-green)]"
              >
                + Nouveau tuteur
              </button>
            </>
          )}
        </div>
          </div>

          <div className={compactLayout ? "min-w-0 space-y-2.5 lg:col-span-5 xl:col-span-4" : wizardAsideColumn}>
            <PersonIdentityUploads
              caseId={caseId}
              subject="beneficiary"
              entityId={editingBeneficiaryId ?? undefined}
              firstName={form.first_name}
              lastName={form.last_name}
              documents={documents}
              onUploaded={onDocumentsChange}
              title="Pièces héritier"
              compact={compactLayout}
              deferUpload={deferNewBeneficiaryUpload && !editingBeneficiaryId}
              pendingFiles={pendingBeneficiaryFiles}
              onPendingFilesChange={onPendingBeneficiaryFilesChange}
            />
            {showGuardianUploads ? (
              <PersonIdentityUploads
                caseId={caseId}
                subject="guardian"
                entityId={
                  deferNewBeneficiaryUpload && !editingBeneficiaryId
                    ? undefined
                    : form.guardian_mode === "existing" && selectedGuardian
                      ? selectedGuardian.id
                      : undefined
                }
                firstName={
                  form.guardian_mode === "existing" && selectedGuardian
                    ? selectedGuardian.first_name
                    : form.guardian_first_name
                }
                lastName={
                  form.guardian_mode === "existing" && selectedGuardian
                    ? selectedGuardian.last_name
                    : form.guardian_last_name
                }
                documents={documents}
                onUploaded={onDocumentsChange}
                title={
                  form.guardian_mode === "existing" && selectedGuardian
                    ? `Pièces tuteur`
                    : "Pièces tuteur"
                }
                compact={compactLayout}
                deferUpload={deferNewBeneficiaryUpload && !editingBeneficiaryId}
                pendingFiles={pendingGuardianFiles}
                onPendingFilesChange={onPendingGuardianFilesChange}
              />
            ) : null}
          </div>
        </div>
  );
}
