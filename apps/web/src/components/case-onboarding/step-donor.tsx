"use client";

import { DonorIdentityUploads } from "@/components/case-onboarding/donor-identity-uploads";
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
import type { CaseDonor } from "@/types/api";

export type DonorFormState = {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  nationality: string;
  identification_number: string;
  email: string;
  phone: string;
  address: string;
};

export function StepDonor({
  form,
  onChange,
  existing,
  caseId,
  donorId,
  documents,
  onDocumentsChange,
  submitting,
  stepIndex,
  totalSteps,
}: {
  form: DonorFormState;
  onChange: (v: DonorFormState) => void;
  existing: CaseDonor[];
  caseId: number | null;
  donorId?: number;
  documents: CaseDocumentItem[];
  onDocumentsChange: () => void;
  submitting?: boolean;
  stepIndex?: number;
  totalSteps?: number;
}) {
  const registered = existing[0];

  return (
    <div className="space-y-8">
      <WizardStepHeader
        title="Donateur"
        description="Le constituant ou donateur du dossier fiduciaire. Indiquez au minimum le prénom et le nom ; les pièces d'identité en PDF peuvent être ajoutées dès maintenant ou plus tard."
        stepIndex={stepIndex}
        totalSteps={totalSteps}
      />

      {registered ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--sf-green-mid)]/25 bg-[var(--sf-green)]/5 px-4 py-3">
          <span
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sf-green-deep)] text-sm font-semibold text-white"
            aria-hidden
          >
            {registered.first_name.charAt(0)}
            {registered.last_name.charAt(0)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/55">
              Donateur enregistré
            </p>
            <p className="font-medium text-[var(--sf-green-deep)]">
              {registered.first_name} {registered.last_name}
            </p>
          </div>
          <p className="text-xs text-[var(--sf-green)]/55">
            Modifiez les champs ci-dessous pour mettre à jour la fiche.
          </p>
        </div>
      ) : null}

      <div className={wizardSplitRow}>
        <div className={`${wizardFormColumn} space-y-6`}>
          <WizardSection
            title="Identité & coordonnées"
            description="État civil, pièce d'identité et contacts du donateur."
          >
            <div className={wizardFieldGrid}>
              <div>
                <FieldLabel required htmlFor="donor-first-name">
                  Prénom
                </FieldLabel>
                <input
                  id="donor-first-name"
                  value={form.first_name}
                  onChange={(e) => onChange({ ...form, first_name: e.target.value })}
                  className="sf-input mt-1.5"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <FieldLabel required htmlFor="donor-last-name">
                  Nom
                </FieldLabel>
                <input
                  id="donor-last-name"
                  value={form.last_name}
                  onChange={(e) => onChange({ ...form, last_name: e.target.value })}
                  className="sf-input mt-1.5"
                  autoComplete="family-name"
                />
              </div>
              <div>
                <FieldLabel htmlFor="donor-dob">Date de naissance</FieldLabel>
                <input
                  id="donor-dob"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => onChange({ ...form, date_of_birth: e.target.value })}
                  className="sf-input mt-1.5"
                />
              </div>
              <div>
                <FieldLabel htmlFor="donor-nationality">Nationalité</FieldLabel>
                <input
                  id="donor-nationality"
                  value={form.nationality}
                  onChange={(e) => onChange({ ...form, nationality: e.target.value })}
                  className="sf-input mt-1.5"
                  autoComplete="country-name"
                />
              </div>
              <div>
                <FieldLabel htmlFor="donor-id-number">
                  N° pièce d&apos;identité
                </FieldLabel>
                <input
                  id="donor-id-number"
                  value={form.identification_number}
                  onChange={(e) =>
                    onChange({ ...form, identification_number: e.target.value })
                  }
                  className="sf-input mt-1.5"
                />
              </div>
              <div>
                <FieldLabel htmlFor="donor-phone">Téléphone</FieldLabel>
                <input
                  id="donor-phone"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => onChange({ ...form, phone: e.target.value })}
                  className="sf-input mt-1.5"
                  autoComplete="tel"
                />
              </div>
              <div>
                <FieldLabel htmlFor="donor-email">E-mail</FieldLabel>
                <input
                  id="donor-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => onChange({ ...form, email: e.target.value })}
                  className="sf-input mt-1.5"
                  autoComplete="email"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <FieldLabel htmlFor="donor-address">Adresse</FieldLabel>
                <textarea
                  id="donor-address"
                  rows={2}
                  value={form.address}
                  onChange={(e) => onChange({ ...form, address: e.target.value })}
                  className="sf-input mt-1.5 resize-y"
                  autoComplete="street-address"
                />
              </div>
            </div>
          </WizardSection>
        </div>

        <div className={wizardAsideColumn}>
          <DonorIdentityUploads
            caseId={caseId}
            donorId={donorId}
            firstName={form.first_name}
            lastName={form.last_name}
            documents={documents}
            onUploaded={onDocumentsChange}
            disabled={submitting}
          />
        </div>
      </div>

      <p className="text-center text-xs text-[var(--sf-green)]/45">
        <span className="text-[var(--sf-green-mid)]">*</span> champs obligatoires pour valider
        l&apos;étape
      </p>
    </div>
  );
}
