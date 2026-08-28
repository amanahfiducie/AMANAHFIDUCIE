"use client";

import type { ReactNode } from "react";

import { GenealogyTree } from "@/components/succession/genealogy-tree";
import { WizardStepHeader } from "@/components/case-onboarding/wizard-step-header";
import {
  buildSmartRelationPayload,
  childMissingSpouseForParent,
  childNeedsFatherSelect,
  childNeedsMotherSelect,
  findFemaleSpouses,
  findMaleSpouses,
  getAvailableSmartRelations,
  inferDefaultParents,
  inferDeceasedGenderFromFamily,
  parseSmartRelation,
  relationNeedsParentFields,
  smartRelationFormValid,
} from "@/lib/succession/family-relations";
import type { Beneficiary } from "@/types/api";

export type SuccessionFamilyFormState = {
  first_name: string;
  last_name: string;
  relation_to_donor: string;
  father_id: string;
  mother_id: string;
  date_of_birth: string;
  notes: string;
};

export const emptySuccessionFamilyForm = (): SuccessionFamilyFormState => ({
  first_name: "",
  last_name: "",
  relation_to_donor: "",
  father_id: "",
  mother_id: "",
  date_of_birth: "",
  notes: "",
});

export function successionFamilyFormValid(
  form: SuccessionFamilyFormState,
  existing: Beneficiary[] = [],
): boolean {
  return smartRelationFormValid(form, existing);
}

export function buildSuccessionFamilyBody(
  form: SuccessionFamilyFormState,
  donorId: number | null,
  existing: Beneficiary[] = [],
): Record<string, unknown> {
  return buildSmartRelationPayload(form, donorId, existing) ?? {};
}

function memberLabel(b: Beneficiary): string {
  const rel = b.relation_to_donor_label || b.relation_to_donor;
  return `${b.first_name} ${b.last_name} (${rel})`;
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StepSuccessionFamily({
  form,
  onChange,
  existing,
  donorId,
  caseId,
  deceasedName,
  onMembersChange,
  stepIndex,
  totalSteps,
}: {
  form: SuccessionFamilyFormState;
  onChange: (v: SuccessionFamilyFormState) => void;
  existing: Beneficiary[];
  donorId: number | null;
  caseId?: number | null;
  deceasedName: string;
  onMembersChange?: () => void;
  stepIndex?: number;
  totalSteps?: number;
}) {
  const parsed = parseSmartRelation(form.relation_to_donor);
  const availableRelations = getAvailableSmartRelations(existing);
  const inferred = inferDefaultParents(form.relation_to_donor, existing);
  const deceasedGender = inferDeceasedGenderFromFamily(existing);
  const wives = findFemaleSpouses(existing);
  const husbands = findMaleSpouses(existing);
  const isChild = parsed?.relationToDonor === "CHILD";
  const needsMotherPick = childNeedsMotherSelect(form.relation_to_donor, existing);
  const needsFatherPick = childNeedsFatherSelect(form.relation_to_donor, existing);
  const missingSpouse = childMissingSpouseForParent(form.relation_to_donor, existing);
  const showIndirectParentFields =
    parsed?.isIndirect &&
    relationNeedsParentFields(
      form.relation_to_donor,
      form.father_id,
      form.mother_id,
      existing,
    );

  function handleRelationChange(relation: string) {
    const auto = inferDefaultParents(relation, existing);
    onChange({
      ...form,
      relation_to_donor: relation,
      father_id: auto.father_id,
      mother_id: auto.mother_id,
    });
  }

  const directOptions = availableRelations.filter((o) => o.group === "direct");
  const indirectOptions = availableRelations.filter((o) => o.group === "indirect");

  const hasContextFields =
    needsMotherPick ||
    needsFatherPick ||
    showIndirectParentFields ||
    (isChild && wives.length === 1 && !needsMotherPick);

  return (
    <div>
      <WizardStepHeader
        title="Arbre généalogique"
        description="Choisissez le lien exact (épouse, fils, père, neveu…). Le sexe et le rattachement à l'arbre sont déduits automatiquement — inutile de les resaisir."
        stepIndex={stepIndex}
        totalSteps={totalSteps}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:items-start">
        <div className="min-w-0">
          <div className="space-y-6 rounded-2xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 p-4 sm:p-5">
            <FormSection title="Ajouter un membre à l'arbre">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Prénom *</label>
                  <input
                    value={form.first_name}
                    onChange={(e) => onChange({ ...form, first_name: e.target.value })}
                    className="sf-input mt-1.5"
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Nom *</label>
                  <input
                    value={form.last_name}
                    onChange={(e) => onChange({ ...form, last_name: e.target.value })}
                    className="sf-input mt-1.5"
                    autoComplete="family-name"
                  />
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Lien avec le défunt"
              description="Le type de lien détermine automatiquement le sexe et le rattachement dans l'arbre."
            >
              <select
                value={form.relation_to_donor}
                onChange={(e) => handleRelationChange(e.target.value)}
                className="sf-input w-full"
              >
                <option value="">— Choisir le lien —</option>
                {directOptions.length > 0 ? (
                  <optgroup label="Lien direct">
                    {directOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {indirectOptions.length > 0 ? (
                  <optgroup label="Lien indirect (via un autre membre)">
                    {indirectOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
              {parsed?.isDirect ? (
                <p className="text-xs text-[var(--sf-green)]/55">
                  Rattaché directement au défunt
                  {parsed.gender === "F" ? " · femme" : parsed.gender === "M" ? " · homme" : ""}.
                </p>
              ) : null}
              {parsed?.isIndirect ? (
                <p className="text-xs text-[var(--sf-green)]/55">
                  Rattaché via un parent déjà présent dans l&apos;arbre.
                </p>
              ) : null}
              {inferred.hint ? (
                <p className="text-xs font-medium text-[var(--sf-green-mid)]">{inferred.hint}</p>
              ) : null}
              {missingSpouse ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  Enregistrez d&apos;abord au moins une épouse (ou l&apos;époux) du défunt avant
                  d&apos;ajouter un enfant.
                </p>
              ) : null}
            </FormSection>

            {hasContextFields ? (
              <FormSection
                title="Rattachement dans l'arbre"
                description="Champs affichés selon le lien choisi."
              >
                <div className="space-y-4">
                  {needsMotherPick ? (
                    <div>
                      <label className="block text-sm font-medium">Mère de l&apos;enfant *</label>
                      <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">
                        Le défunt a plusieurs épouses — indiquez la mère de cet enfant.
                      </p>
                      <select
                        value={form.mother_id}
                        onChange={(e) => onChange({ ...form, mother_id: e.target.value })}
                        className="sf-input mt-1.5 w-full"
                      >
                        <option value="">— Choisir l&apos;épouse —</option>
                        {wives.map((w) => (
                          <option key={w.id} value={String(w.id)}>
                            {w.first_name} {w.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {needsFatherPick ? (
                    <div>
                      <label className="block text-sm font-medium">Père de l&apos;enfant *</label>
                      <select
                        value={form.father_id}
                        onChange={(e) => onChange({ ...form, father_id: e.target.value })}
                        className="sf-input mt-1.5 w-full"
                      >
                        <option value="">— Choisir —</option>
                        {husbands.map((h) => (
                          <option key={h.id} value={String(h.id)}>
                            {h.first_name} {h.last_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}

                  {showIndirectParentFields ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium">Père dans l&apos;arbre *</label>
                        <select
                          value={form.father_id}
                          onChange={(e) => onChange({ ...form, father_id: e.target.value })}
                          className="sf-input mt-1.5 w-full"
                        >
                          <option value="">— Choisir —</option>
                          {existing
                            .filter((b) => b.gender !== "F")
                            .map((b) => (
                              <option key={b.id} value={String(b.id)}>
                                {memberLabel(b)}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium">Mère dans l&apos;arbre *</label>
                        <select
                          value={form.mother_id}
                          onChange={(e) => onChange({ ...form, mother_id: e.target.value })}
                          className="sf-input mt-1.5 w-full"
                        >
                          <option value="">— Choisir —</option>
                          {existing
                            .filter((b) => b.gender !== "M")
                            .map((b) => (
                              <option key={b.id} value={String(b.id)}>
                                {memberLabel(b)}
                              </option>
                            ))}
                        </select>
                      </div>
                    </div>
                  ) : null}

                  {isChild && wives.length === 1 && !needsMotherPick ? (
                    <p className="rounded-lg border border-[var(--sf-cream-dark)] bg-white/70 px-3 py-2 text-xs text-[var(--sf-green)]/65">
                      Père : le défunt · Mère : {wives[0]!.first_name} {wives[0]!.last_name}
                    </p>
                  ) : null}
                </div>
              </FormSection>
            ) : null}

            <FormSection title="Informations complémentaires">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium">Date de naissance</label>
                  <input
                    type="date"
                    value={form.date_of_birth}
                    onChange={(e) => onChange({ ...form, date_of_birth: e.target.value })}
                    className="sf-input mt-1.5 w-full sm:max-w-xs"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => onChange({ ...form, notes: e.target.value })}
                    className="sf-input mt-1.5 min-h-[72px] w-full resize-y"
                    rows={2}
                    placeholder="Précisions utiles pour le dossier (optionnel)"
                  />
                </div>
              </div>
            </FormSection>
          </div>

          {!donorId ? (
            <p className="mt-4 text-sm text-amber-800">
              Complétez d&apos;abord l&apos;étape « Le défunt ».
            </p>
          ) : null}
        </div>

        <div className="flex min-w-0 flex-col lg:sticky lg:top-4 lg:self-start">
          <GenealogyTree
            deceasedName={deceasedName}
            familyMembers={existing}
            deceasedGender={deceasedGender}
            variant="preview"
            previewHeightClass="h-[min(24rem,52vh)] min-h-[16rem]"
            className="flex-1"
            caseId={caseId}
            donorId={donorId}
            editable={Boolean(caseId && onMembersChange)}
            onMembersChange={onMembersChange}
          />
        </div>
      </div>
    </div>
  );
}
