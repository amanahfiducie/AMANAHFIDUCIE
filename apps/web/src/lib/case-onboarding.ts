import { apiRequest } from "@/lib/api";

export type OnboardingStepId =
  | "type"
  | "identification"
  | "donor"
  | "donor_trusted"
  | "mandate"
  | "beneficiaries"
  | "patrimoine"
  | "waqf_intention"
  | "documents"
  | "review";

export type OnboardingStepDef = {
  id: OnboardingStepId | string;
  label: string;
  description: string;
  required: boolean;
};

export type CaseTypeSchema = {
  id: string;
  label: string;
  description: string;
  default_mandate_type: string;
  steps: OnboardingStepDef[];
};

export type OnboardingSchema = {
  case_types: CaseTypeSchema[];
};

export type OnboardingStepStatus = "completed" | "skipped" | "pending";

export type OnboardingStepProgress = OnboardingStepDef & {
  status: OnboardingStepStatus;
  completed: boolean;
  skipped: boolean;
  skippable?: boolean;
};

export type OnboardingPendingTask = {
  id: string;
  label: string;
  status: OnboardingStepStatus;
  required: boolean;
};

export type OnboardingProgress = {
  case_type: string;
  case_type_label: string;
  current_step: string;
  steps: OnboardingStepProgress[];
  pending_tasks: OnboardingPendingTask[];
  completed: boolean;
  can_submit: boolean;
  onboarding_data: Record<string, unknown>;
};

/** @deprecated Préférer SKIPPABLE_ONBOARDING_STEPS depuis onboarding-step-hints */
export const SKIPPABLE_STEPS = new Set([
  "identification",
  "donor",
  "donor_trusted",
  "mandate",
  "beneficiaries",
  "patrimoine",
  "waqf_intention",
  "documents",
]);

export type CaseDocumentItem = {
  id: number;
  title: string;
  category: string;
  donor: number | null;
  beneficiary: number | null;
  guardian: number | null;
  mandate: number | null;
  identity_kind: string;
  original_filename: string | null;
  created_at: string;
};

export function fetchCaseDocuments(caseId: number): Promise<CaseDocumentItem[]> {
  return apiRequest<CaseDocumentItem[]>(`/cases/${caseId}/documents/`);
}

export type UploadCaseDocumentOptions = {
  title?: string;
  category?: string;
  donorId?: number;
  identityKind?: string;
  donorFirstName?: string;
  donorLastName?: string;
  beneficiaryId?: number;
  beneficiaryFirstName?: string;
  beneficiaryLastName?: string;
  guardianId?: number;
  guardianFirstName?: string;
  guardianLastName?: string;
  mandateId?: number;
  mandateType?: string;
  mandateTitle?: string;
  mandateReferenceNumber?: string;
};

export function uploadCaseDocument(
  caseId: number,
  file: File,
  titleOrOptions: string | UploadCaseDocumentOptions,
  category = "IDENTITY",
): Promise<CaseDocumentItem> {
  const opts: UploadCaseDocumentOptions =
    typeof titleOrOptions === "string"
      ? { title: titleOrOptions, category }
      : { category, ...titleOrOptions };

  const form = new FormData();
  form.append("case_id", String(caseId));
  form.append("category", opts.category ?? "IDENTITY");
  if (opts.title) form.append("title", opts.title);
  if (opts.identityKind) form.append("identity_kind", opts.identityKind);
  if (opts.donorId) form.append("donor_id", String(opts.donorId));
  if (opts.donorFirstName) form.append("donor_first_name", opts.donorFirstName);
  if (opts.donorLastName) form.append("donor_last_name", opts.donorLastName);
  if (opts.beneficiaryId) form.append("beneficiary_id", String(opts.beneficiaryId));
  if (opts.beneficiaryFirstName) {
    form.append("beneficiary_first_name", opts.beneficiaryFirstName);
  }
  if (opts.beneficiaryLastName) {
    form.append("beneficiary_last_name", opts.beneficiaryLastName);
  }
  if (opts.guardianId) form.append("guardian_id", String(opts.guardianId));
  if (opts.guardianFirstName) form.append("guardian_first_name", opts.guardianFirstName);
  if (opts.guardianLastName) form.append("guardian_last_name", opts.guardianLastName);
  if (opts.mandateId) form.append("mandate_id", String(opts.mandateId));
  if (opts.mandateType) form.append("mandate_type", opts.mandateType);
  if (opts.mandateTitle) form.append("mandate_title", opts.mandateTitle);
  if (opts.mandateReferenceNumber) {
    form.append("mandate_reference_number", opts.mandateReferenceNumber);
  }
  form.append("file", file);
  return apiRequest<CaseDocumentItem>("/documents/upload/", {
    method: "POST",
    body: form,
  });
}

export const PRE_CREATE_STEPS: OnboardingStepId[] = ["type", "identification"];

export function fetchOnboardingSchema(): Promise<OnboardingSchema> {
  return apiRequest<OnboardingSchema>("/cases/onboarding-schema/");
}

export function fetchCaseOnboarding(caseId: number): Promise<OnboardingProgress> {
  return apiRequest<OnboardingProgress>(`/cases/${caseId}/onboarding/`);
}

export function completeOnboardingStep(
  caseId: number,
  stepId: string,
  options?: {
    onboardingData?: Record<string, unknown>;
    skip?: boolean;
  },
): Promise<OnboardingProgress> {
  return apiRequest<OnboardingProgress>(`/cases/${caseId}/onboarding/complete-step/`, {
    method: "POST",
    body: JSON.stringify({
      step_id: stepId,
      ...(options?.skip ? { skip: true } : {}),
      ...(options?.onboardingData ? { onboarding_data: options.onboardingData } : {}),
    }),
  });
}

export function submitCase(caseId: number) {
  return apiRequest(`/cases/${caseId}/submit/`, { method: "POST" });
}

export function getCaseTypeSchema(
  schema: OnboardingSchema,
  caseType: string,
): CaseTypeSchema | undefined {
  return schema.case_types.find((t) => t.id === caseType);
}

/** Étapes affichées dans le stepper (type + identification + étapes API). */
export function buildWizardSteps(
  schema: OnboardingSchema,
  caseType: string | null,
): { id: string; label: string }[] {
  const base = [
    { id: "type", label: "Type de dossier" },
    { id: "identification", label: "Identification" },
  ];
  if (!caseType) return base;
  const def = getCaseTypeSchema(schema, caseType);
  if (!def) return base;
  const seen = new Set(base.map((s) => s.id));
  const apiSteps = def.steps
    .filter((s) => !seen.has(s.id))
    .map((s) => ({ id: s.id, label: s.label }));
  return [...base, ...apiSteps];
}

export const RELATION_TO_DONOR_LABELS: Record<string, string> = {
  CHILD: "Enfant",
  SPOUSE: "Conjoint(e)",
  PARENT: "Parent",
  SIBLING: "Frère / sœur",
  HEIR: "Héritier / héritière",
  WARD: "Protégé(e) / pupille",
  OTHER: "Autre",
};

/** Liens explicites donateur → bénéficiaire (sexe inclus dans le libellé). */
export const SMART_DONOR_RELATIONS: { value: string; label: string }[] = [
  { value: "DONOR:CHILD:M", label: "Fils du donateur" },
  { value: "DONOR:CHILD:F", label: "Fille du donateur" },
  { value: "DONOR:SPOUSE:F", label: "Épouse du donateur" },
  { value: "DONOR:SPOUSE:M", label: "Époux du donateur" },
  { value: "DONOR:PARENT:M", label: "Père du donateur" },
  { value: "DONOR:PARENT:F", label: "Mère du donateur" },
  { value: "DONOR:SIBLING:M", label: "Frère du donateur" },
  { value: "DONOR:SIBLING:F", label: "Sœur du donateur" },
  { value: "DONOR:HEIR:", label: "Héritier / héritière" },
  { value: "DONOR:WARD:", label: "Protégé(e) / pupille" },
  { value: "DONOR:OTHER:", label: "Autre lien" },
];

export function parseDonorSmartRelation(value: string): {
  relation_to_donor: string;
  gender?: "M" | "F";
} {
  if (!value.startsWith("DONOR:")) {
    return { relation_to_donor: value };
  }
  const parts = value.split(":");
  const relation = parts[1] ?? "";
  const genderRaw = parts[2] ?? "";
  const gender = genderRaw === "M" || genderRaw === "F" ? genderRaw : undefined;
  return { relation_to_donor: relation, gender };
}

export function getAvailableDonorRelations(
  existing: { relation_to_donor: string; gender?: string }[],
): { value: string; label: string }[] {
  const hasSpouse = existing.some((b) => b.relation_to_donor === "SPOUSE");
  return SMART_DONOR_RELATIONS.filter((opt) => {
    if (!opt.value.startsWith("DONOR:SPOUSE:")) return true;
    return !hasSpouse;
  });
}
