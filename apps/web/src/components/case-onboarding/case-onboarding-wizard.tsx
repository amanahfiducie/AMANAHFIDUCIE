"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  beneficiaryFormValid,
  buildBeneficiaryRequestBody,
  emptyBeneficiaryForm,
  StepBeneficiary,
} from "@/components/case-onboarding/step-beneficiary";
import {
  buildMandateRequestBody,
  emptyMandateForm,
  mandateFormValid,
  StepMandate,
} from "@/components/case-onboarding/step-mandate";
import { StepDonor } from "@/components/case-onboarding/step-donor";
import {
  buildSuccessionFamilyBody,
  emptySuccessionFamilyForm,
  StepSuccessionFamily,
  successionFamilyFormValid,
} from "@/components/case-onboarding/step-succession-family";
import { StepCompletionHints } from "@/components/case-onboarding/step-completion-hints";
import { PatrimonyAssetListPanel } from "@/components/patrimony/patrimony-asset-list-panel";
import { PatrimonySmartAssetForm } from "@/components/patrimony/patrimony-smart-asset-form";
import { wizardFieldGrid, wizardSplitRow } from "@/components/case-onboarding/wizard-layout";
import { WizardStepper } from "@/components/case-onboarding/wizard-stepper";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { ApiError, apiRequest } from "@/lib/api";
import {
  canSkipOnboardingStep,
  getStepCompletionHints,
  isOnboardingStepRequired,
  type StepHintsContext,
} from "@/lib/onboarding-step-hints";
import {
  buildWizardSteps,
  completeOnboardingStep,
  fetchCaseDocuments,
  fetchOnboardingSchema,
  getCaseTypeSchema,
  RELATION_TO_DONOR_LABELS,
  submitCase,
  uploadCaseDocument,
  type CaseDocumentItem,
  type CaseTypeSchema,
  type OnboardingSchema,
} from "@/lib/case-onboarding";
import { computeCasePatrimonyFromAssets } from "@/lib/case-patrimony";
import {
  assetToPatrimonyForm,
  createCaseAsset,
  deleteCaseAsset,
  EMPTY_PATRIMONY_ASSET_FORM,
  updateCaseAsset,
  type PatrimonyAssetFormState,
} from "@/lib/patrimony/create-asset";
import type { AssetEstimationStatus } from "@/lib/faraid/asset-estimation-status";
import {
  CASE_ORIGIN_LABELS,
  CASE_TYPE_LABELS,
  DOCUMENT_CATEGORY_LABELS,
  formatMoney,
  formatSharePercent,
  MANDATE_TYPE_LABELS,
  WAQF_TYPE_LABELS,
} from "@/lib/labels";
import type {
  Asset,
  Beneficiary,
  CaseDonor,
  DonorTrustedPerson,
  FiduciaryCaseDetail,
  Mandate,
} from "@/types/api";

type Props = {
  initialCaseId?: number;
  resumeStep?: string;
  /** Masque les actions d'écriture (sauvegarde, ajout, suppression). */
  readOnly?: boolean;
};

export function CaseOnboardingWizard({ initialCaseId, resumeStep, readOnly = false }: Props) {
  const router = useRouter();
  const [schema, setSchema] = useState<OnboardingSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [caseId, setCaseId] = useState<number | null>(initialCaseId ?? null);
  const [caseDetail, setCaseDetail] = useState<FiduciaryCaseDetail | null>(null);
  const [caseType, setCaseType] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(resumeStep ?? "type");

  const [title, setTitle] = useState("");
  const [caseOrigin, setCaseOrigin] = useState("");
  const [description, setDescription] = useState("");

  const [mandateForm, setMandateForm] = useState({
    mandate_type: "FAMILY",
    title: "",
    reference_number: "",
    issuing_authority: "",
    signed_at: "",
    effective_from: "",
    effective_to: "",
    notes: "",
  });
  const [pendingMandatePdf, setPendingMandatePdf] = useState<File | null>(null);
  const [donorForm, setDonorForm] = useState({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    nationality: "SN",
    identification_number: "",
    email: "",
    phone: "",
    address: "",
  });
  const [trustedPersonForm, setTrustedPersonForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    relationship_label: "",
  });
  const [beneficiaryForm, setBeneficiaryForm] = useState(emptyBeneficiaryForm);
  const [successionFamilyForm, setSuccessionFamilyForm] = useState(
    emptySuccessionFamilyForm,
  );
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [assetForm, setAssetForm] = useState<PatrimonyAssetFormState>({
    ...EMPTY_PATRIMONY_ASSET_FORM,
  });
  const [waqfForm, setWaqfForm] = useState({
    waqf_type: "FAMILY",
    waqf_object: "",
    waqf_distribution_rules: "",
  });
  const [documentForm, setDocumentForm] = useState({
    title: "",
    category: "MANDATE",
    file: null as File | null,
  });
  const [caseDocuments, setCaseDocuments] = useState<CaseDocumentItem[]>([]);

  const loadCase = useCallback(async (id: number) => {
    const detail = await apiRequest<FiduciaryCaseDetail>(`/cases/${id}/`);
    setCaseDetail(detail);
    setCaseType(detail.case_type ?? "MANDAT_FIDUCIAIRE");
    setTitle(detail.title);
    setCaseOrigin(detail.case_origin ?? "");
    setDescription(detail.description ?? "");
    if (detail.onboarding && !resumeStep) {
      const pending = detail.onboarding.steps.find(
        (s) => s.required && s.status === "pending" && s.id !== "review",
      );
      if (pending) {
        const stepId =
          pending.id === "identification" ? "donor" : pending.id;
        setCurrentStep(stepId);
      } else {
        const apiStep = detail.onboarding.current_step;
        if (apiStep === "identification") {
          setCurrentStep("donor");
        } else if (apiStep) {
          setCurrentStep(apiStep);
        }
      }
    }
    const od = detail.onboarding?.onboarding_data;
    if (od && typeof od === "object") {
      if (typeof od.waqf_type === "string") {
        setWaqfForm((f) => ({ ...f, waqf_type: od.waqf_type as string }));
      }
      if (typeof od.waqf_object === "string") {
        setWaqfForm((f) => ({ ...f, waqf_object: od.waqf_object as string }));
      }
      if (typeof od.waqf_distribution_rules === "string") {
        setWaqfForm((f) => ({
          ...f,
          waqf_distribution_rules: od.waqf_distribution_rules as string,
        }));
      } else if (typeof od.waqf_intention === "string") {
        setWaqfForm((f) => ({ ...f, waqf_object: od.waqf_intention as string }));
      }
    }
    if (detail.documents?.length) {
      setCaseDocuments(
        detail.documents.map((d) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          donor: d.donor ?? null,
          beneficiary: d.beneficiary ?? null,
          guardian: d.guardian ?? null,
          mandate: d.mandate ?? null,
          identity_kind: d.identity_kind ?? "",
          original_filename: d.original_filename ?? null,
          created_at: d.created_at,
        })),
      );
    } else {
      try {
        const docs = await fetchCaseDocuments(id);
        setCaseDocuments(docs);
      } catch {
        setCaseDocuments([]);
      }
    }
  }, [resumeStep]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      setLoading(true);
      setError(null);
      try {
        const s = await fetchOnboardingSchema();
        if (cancelled) return;
        setSchema(s);
        if (initialCaseId) {
          await loadCase(initialCaseId);
          setCaseId(initialCaseId);
          if (resumeStep) setCurrentStep(resumeStep);
          else setCurrentStep("donor");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Impossible de charger la procédure d'enregistrement.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [initialCaseId, loadCase, resumeStep]);

  useEffect(() => {
    if (currentStep === "review" && caseId) {
      loadCase(caseId);
    }
  }, [currentStep, caseId, loadCase]);

  const typeDef: CaseTypeSchema | undefined = useMemo(() => {
    if (!schema || !caseType) return undefined;
    return getCaseTypeSchema(schema, caseType);
  }, [schema, caseType]);

  const wizardSteps = useMemo(() => {
    if (!schema) return [];
    return buildWizardSteps(schema, caseType);
  }, [schema, caseType]);

  const currentStepMeta = useMemo(() => {
    if (currentStep === "type" || currentStep === "identification") return null;
    return typeDef?.steps.find((s) => s.id === currentStep);
  }, [currentStep, typeDef]);

  const primaryDonor = caseDetail?.donors?.[0] ?? null;
  const isSuccessionCase = caseType === "SUCCESSION";
  const trustedPersons = primaryDonor?.trusted_persons ?? [];

  function stepAfterIdentification(): string {
    if (!schema || !caseType) return "donor";
    const steps = buildWizardSteps(schema, caseType);
    const idx = steps.findIndex((s) => s.id === "identification");
    return steps[idx + 1]?.id ?? "donor";
  }

  async function saveIdentification() {
    if (!caseType || !title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (caseId) {
        const updated = await apiRequest<FiduciaryCaseDetail>(`/cases/${caseId}/`, {
          method: "PATCH",
          body: JSON.stringify({
            title: title.trim(),
            case_origin: caseOrigin || "",
            description: description.trim(),
          }),
        });
        setCaseDetail(updated);
        setCurrentStep(stepAfterIdentification());
      } else {
        const created = await apiRequest<FiduciaryCaseDetail>("/cases/", {
          method: "POST",
          body: JSON.stringify({
            case_type: caseType,
            title: title.trim(),
            case_origin: caseOrigin || "",
            description: description.trim(),
          }),
        });
        setCaseId(created.id);
        setCaseDetail(created);
        setCurrentStep(stepAfterIdentification());
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible d'enregistrer le dossier.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function finishStep(
    stepId: string,
    options?: { onboardingData?: Record<string, unknown>; skip?: boolean },
  ) {
    if (!caseId) return;
    setSubmitting(true);
    setError(null);
    try {
      await completeOnboardingStep(caseId, stepId, options);
      await loadCase(caseId);
      const steps = buildWizardSteps(schema!, caseType);
      const idx = steps.findIndex((s) => s.id === stepId);
      const next = steps[idx + 1]?.id ?? "review";
      setCurrentStep(next);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible d'enregistrer cette étape.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function skipStep(stepId: string) {
    if (!canSkipOnboardingStep(stepId)) return;
    if (!caseId) {
      if (stepId === "identification" && caseType) {
        setSubmitting(true);
        setError(null);
        try {
          const created = await apiRequest<FiduciaryCaseDetail>("/cases/", {
            method: "POST",
            body: JSON.stringify({
              case_type: caseType,
              title: title.trim() || "Brouillon — à compléter",
              description: description.trim(),
            }),
          });
          setCaseId(created.id);
          setCaseDetail(created);
          await completeOnboardingStep(created.id, "identification", { skip: true });
          await loadCase(created.id);
          setCurrentStep(stepAfterIdentification());
        } catch (err) {
          setError(
            err instanceof ApiError ? err.message : "Impossible de reporter l'étape.",
          );
        } finally {
          setSubmitting(false);
        }
      }
      return;
    }
    await finishStep(stepId, { skip: true });
  }

  async function saveDonor() {
    if (!caseId) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...donorForm,
        date_of_birth: donorForm.date_of_birth || null,
      };
      let donorRecord: CaseDonor;
      if (primaryDonor) {
        donorRecord = await apiRequest<CaseDonor>(`/donors/${primaryDonor.id}/`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        donorRecord = await apiRequest<CaseDonor>(`/cases/${caseId}/donors/`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      await loadCase(caseId);
      await finishStep("donor");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur donateur.");
      setSubmitting(false);
    }
  }

  async function reloadDocuments() {
    if (!caseId) return;
    await loadCase(caseId);
  }

  async function addTrustedPerson() {
    if (!caseId || !primaryDonor) return;
    setSubmitting(true);
    setError(null);
    try {
      const person = await apiRequest<DonorTrustedPerson>(
        `/cases/${caseId}/donors/${primaryDonor.id}/trusted-persons/`,
        {
          method: "POST",
          body: JSON.stringify(trustedPersonForm),
        },
      );
      await loadCase(caseId);
      setInviteTarget({
        caseId,
        profileType: "trusted_person",
        profileId: person.id,
        displayName: `${person.first_name} ${person.last_name}`.trim(),
        defaultEmail: person.email,
        defaultPhone: person.phone,
      });
      setTrustedPersonForm({
        first_name: "",
        last_name: "",
        phone: "",
        email: "",
        relationship_label: "",
      });
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur personne de confiance.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function addMandate() {
    if (!caseId || !mandateFormValid(mandateForm)) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await apiRequest<Mandate>(`/cases/${caseId}/mandates/`, {
        method: "POST",
        body: JSON.stringify(buildMandateRequestBody(mandateForm)),
      });
      if (pendingMandatePdf) {
        await uploadCaseDocument(caseId, pendingMandatePdf, {
          category: "MANDATE",
          mandateId: created.id,
          mandateType: mandateForm.mandate_type,
          mandateTitle: mandateForm.title.trim(),
          mandateReferenceNumber: mandateForm.reference_number.trim(),
        });
      }
      await loadCase(caseId);
      await reloadDocuments();
      setMandateForm((f) => ({
        ...emptyMandateForm(f.mandate_type),
      }));
      setPendingMandatePdf(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur mandat.");
    } finally {
      setSubmitting(false);
    }
  }

  const requireBeneficiaryGuardian = beneficiaryForm.is_minor;

  const casePatrimony = useMemo(
    () => (caseDetail ? computeCasePatrimonyFromAssets(caseDetail.assets) : null),
    [caseDetail],
  );

  async function addBeneficiary() {
    if (!caseId) return;
    if (
      !beneficiaryFormValid(
        beneficiaryForm,
        requireBeneficiaryGuardian,
        caseDetail?.guardians ?? [],
      )
    ) {
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = buildBeneficiaryRequestBody(
        beneficiaryForm,
        primaryDonor?.id ?? null,
        requireBeneficiaryGuardian,
      );
      const createdBen = await apiRequest<Beneficiary>(`/cases/${caseId}/beneficiaries/`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await loadCase(caseId);
      setBeneficiaryForm(emptyBeneficiaryForm());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de l'ajout de l'héritier.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function addSuccessionFamilyMember() {
    if (!caseId || !successionFamilyFormValid(successionFamilyForm, caseDetail?.beneficiaries ?? [])) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest<Beneficiary>(`/cases/${caseId}/beneficiaries/`, {
        method: "POST",
        body: JSON.stringify(
          buildSuccessionFamilyBody(
            successionFamilyForm,
            primaryDonor?.id ?? null,
            caseDetail?.beneficiaries ?? [],
          ),
        ),
      });
      await loadCase(caseId);
      setSuccessionFamilyForm(emptySuccessionFamilyForm());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Erreur lors de l'ajout du membre de la famille.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function addAsset() {
    if (!caseId || !assetForm.label.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (editingAssetId != null) {
        await updateCaseAsset(editingAssetId, assetForm);
        setEditingAssetId(null);
      } else {
        await createCaseAsset(
          String(caseId),
          assetForm,
          "Estimation initiale — enregistrement dossier",
        );
      }
      await loadCase(caseId);
      setAssetForm({
        ...EMPTY_PATRIMONY_ASSET_FORM,
        asset_type: assetForm.asset_type,
        valuation_frequency: assetForm.valuation_frequency,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur patrimoine.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteAsset(assetId: number) {
    if (!caseId) return;
    const asset = (caseDetail?.assets ?? []).find((a) => a.id === assetId);
    if (
      asset &&
      !window.confirm(
        `Supprimer « ${asset.label} » du patrimoine ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    if (!asset && !window.confirm("Supprimer ce bien du patrimoine ?")) return;
    setSubmitting(true);
    setError(null);
    try {
      await deleteCaseAsset(assetId);
      if (editingAssetId === assetId) {
        setEditingAssetId(null);
        setAssetForm({ ...EMPTY_PATRIMONY_ASSET_FORM });
      }
      await loadCase(caseId);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Suppression impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  function startEditAsset(assetId: number) {
    const asset = (caseDetail?.assets ?? []).find((a) => a.id === assetId);
    if (!asset) return;
    setEditingAssetId(assetId);
    setAssetForm(assetToPatrimonyForm(asset));
  }

  function cancelEditAsset() {
    setEditingAssetId(null);
    setAssetForm({ ...EMPTY_PATRIMONY_ASSET_FORM });
  }

  async function saveWaqfIntention() {
    setSubmitting(true);
    setError(null);
    try {
      await finishStep("waqf_intention", {
        onboardingData: {
          waqf_type: waqfForm.waqf_type,
          waqf_object: waqfForm.waqf_object.trim(),
          waqf_distribution_rules: waqfForm.waqf_distribution_rules.trim(),
          waqf_intention: [
            waqfForm.waqf_object.trim(),
            waqfForm.waqf_distribution_rules.trim(),
          ]
            .filter(Boolean)
            .join("\n\n"),
        },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur intention waqf.");
      setSubmitting(false);
    }
  }

  async function uploadDocument() {
    if (!caseId || !documentForm.file || !documentForm.title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await uploadCaseDocument(
        caseId,
        documentForm.file,
        documentForm.title.trim(),
        documentForm.category,
      );
      await loadCase(caseId);
      setDocumentForm({ title: "", category: "MANDATE", file: null });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Erreur document.");
    } finally {
      setSubmitting(false);
    }
  }

  const hintsContext = useMemo((): StepHintsContext => ({
    title,
    caseDetail,
    caseDocuments,
    donorForm,
    trustedPersonForm,
    trustedPersons,
    primaryDonor,
    mandateForm,
    beneficiaryForm,
    requireBeneficiaryGuardian,
    assetForm,
    waqfForm,
  }), [
    title,
    caseDetail,
    caseDocuments,
    donorForm,
    trustedPersonForm,
    trustedPersons,
    primaryDonor,
    mandateForm,
    beneficiaryForm,
    requireBeneficiaryGuardian,
    assetForm,
    waqfForm,
  ]);

  const currentStepRequired = useMemo(
    () => isOnboardingStepRequired(currentStep, typeDef?.steps),
    [currentStep, typeDef?.steps],
  );

  const stepHints = useMemo(
    () =>
      getStepCompletionHints(currentStep, hintsContext, {
        stepRequired: currentStepRequired,
      }),
    [currentStep, hintsContext, currentStepRequired],
  );

  function canSkipCurrentStep(): boolean {
    return canSkipOnboardingStep(currentStep);
  }

  async function handleSubmitCase() {
    if (!caseId) return;
    setSubmitting(true);
    setError(null);
    try {
      await completeOnboardingStep(caseId, "review");
      await submitCase(caseId);
      router.push(`/dossiers/${caseId}`);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de soumettre le dossier.",
      );
      setSubmitting(false);
    }
  }

  function goBack() {
    const idx = wizardSteps.findIndex((s) => s.id === currentStep);
    if (idx > 0) setCurrentStep(wizardSteps[idx - 1].id);
  }

  if (loading) return <LoadingState label="Chargement de la procédure…" />;

  return (
    <>
      <PageHeader
        badge="Enregistrement"
        title={initialCaseId ? "Poursuivre l'enregistrement" : "Nouveau dossier fiduciaire"}
        description="Suivez la procédure étape par étape. Le dossier reste en brouillon jusqu'à la soumission finale."
        backHref={initialCaseId ? `/dossiers/${initialCaseId}` : "/dossiers"}
      />

      {error ? <div className="mb-6"><ErrorAlert message={error} /></div> : null}

      <WizardStepper
        steps={wizardSteps}
        currentId={currentStep}
        stepStatuses={caseDetail?.onboarding?.steps}
      />

      <Card
        elevated
        className="mx-auto max-w-6xl p-6 sm:p-8 lg:p-10"
      >
        {currentStep === "type" && schema ? (
          <StepType
            schema={schema}
            selected={caseType}
            onSelect={(id) => {
              setCaseType(id);
              const def = getCaseTypeSchema(schema, id);
              if (def) {
                setMandateForm((f) => ({
                  ...f,
                  mandate_type: def.default_mandate_type,
                }));
              }
            }}
          />
        ) : null}

        {currentStep === "identification" ? (
          <StepIdentification
            title={title}
            caseOrigin={caseOrigin}
            description={description}
            caseTypeLabel={caseType ? CASE_TYPE_LABELS[caseType] : ""}
            onTitle={setTitle}
            onCaseOrigin={setCaseOrigin}
            onDescription={setDescription}
          />
        ) : null}

        {currentStep === "donor" ? (
          <StepDonor
            form={donorForm}
            onChange={setDonorForm}
            existing={caseDetail?.donors ?? []}
            caseId={caseId}
            donorId={primaryDonor?.id}
            documents={caseDocuments}
            onDocumentsChange={reloadDocuments}
            submitting={submitting}
            stepIndex={
              wizardSteps.findIndex((s) => s.id === "donor") >= 0
                ? wizardSteps.findIndex((s) => s.id === "donor") + 1
                : undefined
            }
            totalSteps={wizardSteps.length > 0 ? wizardSteps.length : undefined}
          />
        ) : null}

        {currentStep === "donor_trusted" ? (
          <StepDonorTrusted
            donor={primaryDonor}
            form={trustedPersonForm}
            onChange={setTrustedPersonForm}
            existing={trustedPersons}
            onAdd={addTrustedPerson}
            adding={submitting}
            variant={isSuccessionCase ? "witness" : "trusted"}
          />
        ) : null}

        {currentStep === "mandate" ? (
          <StepMandate
            form={mandateForm}
            onChange={setMandateForm}
            existing={caseDetail?.mandates ?? []}
            caseId={caseId}
            documents={caseDocuments}
            onDocumentsChange={() => void reloadDocuments()}
            deferNewMandateUpload
            pendingMandateFile={pendingMandatePdf}
            onPendingMandateFileChange={setPendingMandatePdf}
            stepIndex={
              wizardSteps.findIndex((s) => s.id === "mandate") >= 0
                ? wizardSteps.findIndex((s) => s.id === "mandate") + 1
                : undefined
            }
            totalSteps={wizardSteps.length > 0 ? wizardSteps.length : undefined}
          />
        ) : null}

        {currentStep === "beneficiaries" && isSuccessionCase ? (
          <StepSuccessionFamily
            form={successionFamilyForm}
            onChange={setSuccessionFamilyForm}
            existing={caseDetail?.beneficiaries ?? []}
            donorId={primaryDonor?.id ?? null}
            caseId={caseId}
            onMembersChange={caseId ? () => void loadCase(caseId) : undefined}
            deceasedName={
              primaryDonor
                ? [primaryDonor.first_name, primaryDonor.last_name].filter(Boolean).join(" ")
                : "Le défunt"
            }
            stepIndex={
              wizardSteps.findIndex((s) => s.id === "beneficiaries") >= 0
                ? wizardSteps.findIndex((s) => s.id === "beneficiaries") + 1
                : undefined
            }
            totalSteps={wizardSteps.length > 0 ? wizardSteps.length : undefined}
          />
        ) : null}

        {currentStep === "beneficiaries" && !isSuccessionCase ? (
          <StepBeneficiary
            form={beneficiaryForm}
            onChange={setBeneficiaryForm}
            existing={caseDetail?.beneficiaries ?? []}
            existingGuardians={caseDetail?.guardians ?? []}
            donor={primaryDonor}
            optional={currentStepMeta?.required === false}
            requireGuardian={requireBeneficiaryGuardian}
            caseId={caseId}
            documents={caseDocuments}
            onDocumentsChange={() => void reloadDocuments()}
            stepIndex={
              wizardSteps.findIndex((s) => s.id === "beneficiaries") >= 0
                ? wizardSteps.findIndex((s) => s.id === "beneficiaries") + 1
                : undefined
            }
            totalSteps={wizardSteps.length > 0 ? wizardSteps.length : undefined}
            casePatrimonyTotal={casePatrimony?.total ?? null}
            casePatrimonyCurrency={casePatrimony?.currency ?? "XOF"}
          />
        ) : null}

        {currentStep === "patrimoine" ? (
          <StepPatrimoine
            form={assetForm}
            onChange={setAssetForm}
            existing={caseDetail?.assets ?? []}
            onAdd={readOnly ? undefined : addAsset}
            onEdit={readOnly ? undefined : startEditAsset}
            onDelete={readOnly ? undefined : (id) => void deleteAsset(id)}
            onCancelEdit={readOnly ? undefined : cancelEditAsset}
            editingAssetId={readOnly ? null : editingAssetId}
            adding={submitting}
            readOnly={readOnly}
          />
        ) : null}

        {currentStep === "waqf_intention" ? (
          <StepWaqf form={waqfForm} onChange={setWaqfForm} />
        ) : null}

        {currentStep === "documents" ? (
          <StepDocuments
            form={documentForm}
            onChange={setDocumentForm}
            existing={caseDocuments}
            onUpload={uploadDocument}
            uploading={submitting}
          />
        ) : null}

        {currentStep === "review" && caseDetail?.onboarding ? (
          <StepReview
            progress={caseDetail.onboarding}
            caseTypeLabel={CASE_TYPE_LABELS[caseDetail.case_type ?? ""] ?? ""}
            caseDetail={caseDetail}
            trustedPersons={trustedPersons}
          />
        ) : null}

        <StepCompletionHints
          hints={stepHints}
          canSkip={canSkipCurrentStep()}
          className="mt-8"
        />

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-[var(--sf-cream-dark)] pt-6">
          {wizardSteps.findIndex((s) => s.id === currentStep) > 0 ? (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="sf-btn-secondary"
            >
              ← Précédent
            </button>
          ) : null}

          {readOnly ? (
            <p className="ml-auto text-sm text-[var(--sf-green)]/55">
              Consultation seule — les actions d&apos;enregistrement sont masquées pour votre rôle.
            </p>
          ) : null}

          {!readOnly && currentStep === "type" ? (
            <button
              type="button"
              disabled={!caseType || submitting}
              onClick={() => setCurrentStep("identification")}
              className="sf-btn-primary ml-auto"
            >
              Continuer
            </button>
          ) : null}

          {!readOnly && currentStep === "identification" ? (
            <button
              type="button"
              disabled={!title.trim() || submitting}
              onClick={saveIdentification}
              className="sf-btn-primary ml-auto"
            >
              {submitting ? "Enregistrement…" : caseId ? "Continuer" : "Créer le brouillon"}
            </button>
          ) : null}

          {!readOnly && canSkipCurrentStep() && (currentStep !== "identification" || caseType) ? (
            <SkipStepButton
              disabled={submitting}
              onClick={() => skipStep(currentStep)}
            />
          ) : null}

          {!readOnly && currentStep === "donor" ? (
            <button
              type="button"
              disabled={
                submitting
                || (
                  !(caseDetail?.donors?.length)
                  && (!donorForm.first_name.trim() || !donorForm.last_name.trim())
                )
              }
              onClick={() =>
                (caseDetail?.donors?.length ?? 0) > 0 ? finishStep("donor") : saveDonor()
              }
              className="sf-btn-primary ml-auto"
            >
              {submitting ? "Enregistrement…" : "Valider le donateur"}
            </button>
          ) : null}

          {!readOnly && currentStep === "donor_trusted" ? (
            <button
              type="button"
              disabled={submitting || trustedPersons.length === 0}
              onClick={() => finishStep("donor_trusted")}
              className="sf-btn-primary ml-auto"
            >
              {submitting ? "Enregistrement…" : "Continuer"}
            </button>
          ) : null}

          {!readOnly && currentStep === "mandate" ? (
            <>
              <button
                type="button"
                disabled={submitting || !mandateFormValid(mandateForm)}
                onClick={() => void addMandate()}
                className="sf-btn-secondary"
              >
                {submitting ? "Ajout…" : "+ Ajouter ce mandat"}
              </button>
              <button
                type="button"
                disabled={submitting || !(caseDetail?.mandates.length ?? 0)}
                onClick={() => finishStep("mandate")}
                className="sf-btn-primary ml-auto"
              >
                {submitting ? "Enregistrement…" : "Continuer"}
              </button>
            </>
          ) : null}

          {!readOnly && currentStep === "beneficiaries" && isSuccessionCase ? (
            <>
              <button
                type="button"
                disabled={
                  submitting ||
                  !successionFamilyFormValid(
                    successionFamilyForm,
                    caseDetail?.beneficiaries ?? [],
                  )
                }
                onClick={() => void addSuccessionFamilyMember()}
                className="sf-btn-secondary"
              >
                {submitting ? "Ajout…" : "+ Ajouter ce membre de la famille"}
              </button>
              <button
                type="button"
                disabled={submitting || !(caseDetail?.beneficiaries.length ?? 0)}
                onClick={() => finishStep("beneficiaries")}
                className="sf-btn-primary ml-auto"
              >
                {submitting ? "Enregistrement…" : "Continuer"}
              </button>
            </>
          ) : null}

          {!readOnly && currentStep === "beneficiaries" && !isSuccessionCase ? (
            <>
              <button
                type="button"
                disabled={
                  submitting
                  || !beneficiaryFormValid(
                    beneficiaryForm,
                    requireBeneficiaryGuardian,
                    caseDetail?.guardians ?? [],
                  )
                }
                onClick={() => void addBeneficiary()}
                className="sf-btn-secondary"
              >
                {submitting ? "Ajout…" : "+ Ajouter cet héritier"}
              </button>
              <button
                type="button"
                disabled={submitting || !(caseDetail?.beneficiaries.length ?? 0)}
                onClick={() => finishStep("beneficiaries")}
                className="sf-btn-primary ml-auto"
              >
                {submitting ? "Enregistrement…" : "Continuer"}
              </button>
            </>
          ) : null}

          {!readOnly && currentStep === "patrimoine" ? (
            <button
              type="button"
              disabled={submitting || !(caseDetail?.assets.length ?? 0)}
              onClick={() => finishStep("patrimoine")}
              className="sf-btn-primary ml-auto"
            >
              {submitting ? "Enregistrement…" : "Terminer le patrimoine"}
            </button>
          ) : null}

          {!readOnly && currentStep === "waqf_intention" ? (
            <button
              type="button"
              disabled={
                submitting
                || waqfForm.waqf_object.trim().length < 10
                || waqfForm.waqf_distribution_rules.trim().length < 10
              }
              onClick={saveWaqfIntention}
              className="sf-btn-primary ml-auto"
            >
              {submitting ? "Enregistrement…" : "Enregistrer l'intention"}
            </button>
          ) : null}

          {!readOnly && currentStep === "documents" ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() =>
                caseDocuments.length > 0 ? finishStep("documents") : skipStep("documents")
              }
              className="sf-btn-primary ml-auto"
            >
              {submitting
                ? "Enregistrement…"
                : caseDocuments.length > 0
                  ? "Continuer"
                  : "Passer sans document"}
            </button>
          ) : null}

          {!readOnly && currentStep === "review" ? (
            <button
              type="button"
              disabled={submitting || !caseDetail?.onboarding?.can_submit}
              onClick={handleSubmitCase}
              className="sf-btn-gold ml-auto"
            >
              {submitting ? "Soumission…" : "Soumettre pour revue"}
            </button>
          ) : null}
        </div>
      </Card>

      {caseId && currentStep !== "review" ? (
        <p className="mt-4 text-center text-xs text-[var(--sf-green)]/50">
          <Link href={`/dossiers/${caseId}`} className="underline hover:text-[var(--sf-green)]">
            Reprendre plus tard
          </Link>
          {" "}— le brouillon est enregistré automatiquement.
        </p>
      ) : null}
    </>
  );
}

function StepType({
  schema,
  selected,
  onSelect,
}: {
  schema: OnboardingSchema;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
        Choisir le type de dossier
      </h2>
      <p className="mt-1 text-sm text-[var(--sf-green)]/60">
        La procédure d&apos;enregistrement s&apos;adapte au type sélectionné.
      </p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {schema.case_types.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              className={`w-full rounded-xl border p-4 text-left transition ${
                selected === t.id
                  ? "border-[var(--sf-green-mid)] bg-[var(--sf-cream)] ring-2 ring-[var(--sf-green)]/20"
                  : "border-[var(--sf-cream-dark)] hover:border-[var(--sf-green)]/25"
              }`}
            >
              <p className="font-medium text-[var(--sf-green-deep)]">{t.label}</p>
              <p className="mt-1 text-xs text-[var(--sf-green)]/55">{t.description}</p>
              <p className="mt-2 text-[10px] font-medium tracking-wide text-[var(--sf-gold)] uppercase">
                {t.steps.length} étapes
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepIdentification({
  title,
  caseOrigin,
  description,
  caseTypeLabel,
  onTitle,
  onCaseOrigin,
  onDescription,
}: {
  title: string;
  caseOrigin: string;
  description: string;
  caseTypeLabel: string;
  onTitle: (v: string) => void;
  onCaseOrigin: (v: string) => void;
  onDescription: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">Identification</h2>
      {caseTypeLabel ? (
        <p className="mt-1 text-sm text-[var(--sf-gold)]">Type : {caseTypeLabel}</p>
      ) : null}
      <div className={`mt-6 ${wizardSplitRow}`}>
        <div className="lg:col-span-5">
          <label htmlFor="ob-origin" className="block text-sm font-medium">
            Origine du dossier
          </label>
          <select
            id="ob-origin"
            value={caseOrigin}
            onChange={(e) => onCaseOrigin(e.target.value)}
            className="sf-input mt-1.5 w-full"
          >
            <option value="">Choisir…</option>
            {Object.entries(CASE_ORIGIN_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="lg:col-span-5">
          <label htmlFor="ob-title" className="block text-sm font-medium">
            Titre du dossier *
          </label>
          <input
            id="ob-title"
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            className="sf-input mt-1.5"
            placeholder="Ex. Tutelle — famille Diallo"
          />
        </div>
        <div className="lg:col-span-7">
          <label htmlFor="ob-desc" className="block text-sm font-medium">
            Description / contexte
          </label>
          <textarea
            id="ob-desc"
            rows={3}
            value={description}
            onChange={(e) => onDescription(e.target.value)}
            className="sf-input mt-1.5 resize-y"
          />
        </div>
      </div>
    </div>
  );
}

function StepDonorTrusted({
  donor,
  form,
  onChange,
  existing,
  onAdd,
  adding,
  variant = "trusted",
}: {
  donor: CaseDonor | null;
  form: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
    relationship_label: string;
  };
  onChange: (v: typeof form) => void;
  existing: DonorTrustedPerson[];
  onAdd: () => void;
  adding: boolean;
  variant?: "trusted" | "witness";
}) {
  const isWitness = variant === "witness";
  const canAdd =
    Boolean(donor)
    && form.first_name.trim()
    && form.last_name.trim()
    && form.phone.trim()
    && form.email.trim();

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
        {isWitness ? "Témoins" : "Personnes de confiance"}
      </h2>
      <p className="mt-1 text-sm text-[var(--sf-green)]/60">
        {isWitness
          ? "Témoins de la succession (prénom, nom, téléphone et e-mail obligatoires). Au moins un témoin."
          : "Proches ou mandataires de confiance du donateur. Au moins une personne (prénom, nom, téléphone, e-mail obligatoires)."}
      </p>
      {donor ? (
        <p className="mt-3 rounded-lg border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/50 px-3 py-2 text-sm">
          {isWitness ? "Dossier du défunt" : "Donateur"} :{" "}
          <strong>{donor.first_name} {donor.last_name}</strong>
        </p>
      ) : (
        <p className="mt-3 text-sm text-amber-800">
          Complétez d&apos;abord l&apos;étape {isWitness ? "Le défunt" : "Donateur"}.
        </p>
      )}
      {existing.length > 0 ? (
        <ul className="mt-4 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {existing.map((p) => (
            <li key={p.id} className="rounded-lg bg-[var(--sf-cream)]/60 px-3 py-2">
              <span className="font-medium">
                {p.first_name} {p.last_name}
              </span>
              <span className="block text-[var(--sf-green)]/60">
                {p.phone} · {p.email}
                {p.relationship_label ? ` · ${p.relationship_label}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={`mt-6 ${wizardFieldGrid}`}>
        <div>
          <label className="block text-sm font-medium">Prénom *</label>
          <input
            value={form.first_name}
            onChange={(e) => onChange({ ...form, first_name: e.target.value })}
            className="sf-input mt-1.5"
            disabled={!donor}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Nom *</label>
          <input
            value={form.last_name}
            onChange={(e) => onChange({ ...form, last_name: e.target.value })}
            className="sf-input mt-1.5"
            disabled={!donor}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Téléphone *</label>
          <input
            value={form.phone}
            onChange={(e) => onChange({ ...form, phone: e.target.value })}
            className="sf-input mt-1.5"
            disabled={!donor}
          />
        </div>
        <div>
          <label className="block text-sm font-medium">E-mail *</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => onChange({ ...form, email: e.target.value })}
            className="sf-input mt-1.5"
            disabled={!donor}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-1">
          <label className="block text-sm font-medium">
            {isWitness ? "Qualité du témoin (optionnel)" : "Lien avec le donateur"}
          </label>
          <input
            value={form.relationship_label}
            onChange={(e) => onChange({ ...form, relationship_label: e.target.value })}
            className="sf-input mt-1.5"
            placeholder="Ex. frère, notaire de famille"
            disabled={!donor}
          />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-3">
          <button
            type="button"
            disabled={!canAdd || adding}
            onClick={onAdd}
            className="sf-btn-secondary w-full sm:w-auto"
      >
            {adding ? "Ajout…" : "+ Ajouter cette personne"}
          </button>
        </div>
      </div>
    </div>
  );
}

type AssetFormState = PatrimonyAssetFormState;

function StepPatrimoine({
  form,
  onChange,
  existing,
  onAdd,
  onEdit,
  onDelete,
  onCancelEdit,
  editingAssetId,
  adding,
  readOnly = false,
}: {
  form: AssetFormState;
  onChange: (v: AssetFormState) => void;
  existing: Asset[];
  onAdd?: () => void;
  onEdit?: (assetId: number) => void;
  onDelete?: (assetId: number) => void;
  onCancelEdit?: () => void;
  editingAssetId: number | null;
  adding: boolean;
  readOnly?: boolean;
}) {
  const statusMap = useMemo(() => {
    const map: Record<number, AssetEstimationStatus> = {};
    for (const asset of existing) {
      map[asset.id] = {
        assetId: asset.id,
        estimated: Boolean(asset.latest_value),
        amount: asset.latest_value ?? null,
        eventDate: null,
        justificationFilename: null,
        eventId: null,
      };
    }
    return map;
  }, [existing]);

  const total = useMemo(() => {
    let sum = 0;
    let currency = "XOF";
    for (const a of existing) {
      if (a.latest_value) {
        const n = Number(a.latest_value);
        if (!Number.isNaN(n)) sum += n;
        currency = a.latest_currency ?? a.currency ?? currency;
      }
    }
    return { sum, currency };
  }, [existing]);

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">Patrimoine initial</h2>
      <p className="mt-1 text-sm text-[var(--sf-green)]/60">
        Ajoutez autant de biens que nécessaire. Le formulaire s&apos;adapte au type sélectionné ;
        la liste à droite se met à jour à chaque ajout.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-12 lg:items-start">
        {!readOnly && onAdd ? (
          <div className="lg:col-span-7">
            <PatrimonySmartAssetForm
              form={form}
              onChange={onChange}
              onSubmit={onAdd}
              submitting={adding}
              mode={editingAssetId != null ? "edit" : "create"}
              title={editingAssetId != null ? "Modifier le bien" : "Nouveau bien"}
              submitLabel={
                editingAssetId != null ? "Enregistrer les modifications" : "+ Ajouter ce bien"
              }
              onCancel={editingAssetId != null ? onCancelEdit : undefined}
              compact
            />
          </div>
        ) : null}
        <aside className={readOnly ? "lg:col-span-12" : "lg:col-span-5 lg:sticky lg:top-4"}>
          <PatrimonyAssetListPanel
            assets={existing}
            statusMap={statusMap}
            totalEstimated={total}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </aside>
      </div>
    </div>
  );
}

type WaqfFormState = {
  waqf_type: string;
  waqf_object: string;
  waqf_distribution_rules: string;
};

function StepWaqf({
  form,
  onChange,
}: {
  form: WaqfFormState;
  onChange: (v: WaqfFormState) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">Intention du waqf</h2>
      <p className="mt-1 text-sm text-[var(--sf-green)]/60">
        Type de waqf, objet dédié et règles de distribution (min. 10 caractères chacun).
      </p>
      <div className={`mt-6 ${wizardFieldGrid}`}>
        <div>
          <label className="block text-sm font-medium">Type de waqf *</label>
          <select
            value={form.waqf_type}
            onChange={(e) => onChange({ ...form, waqf_type: e.target.value })}
            className="sf-input mt-1.5"
          >
            {Object.entries(WAQF_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium">Objet du waqf *</label>
          <textarea
            rows={3}
            value={form.waqf_object}
            onChange={(e) => onChange({ ...form, waqf_object: e.target.value })}
            className="sf-input mt-1.5 resize-y"
            placeholder="Biens ou finalité dédiés (famille, œuvre sociale, mosquée…)"
          />
          <p className="mt-1 text-xs text-[var(--sf-green)]/50">
            {form.waqf_object.trim().length}/10 caractères minimum
          </p>
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block text-sm font-medium">Règles de distribution *</label>
          <textarea
            rows={3}
            value={form.waqf_distribution_rules}
            onChange={(e) => onChange({ ...form, waqf_distribution_rules: e.target.value })}
            className="sf-input mt-1.5 resize-y"
            placeholder="Bénéficiaires, parts, conditions de répartition…"
          />
          <p className="mt-1 text-xs text-[var(--sf-green)]/50">
            {form.waqf_distribution_rules.trim().length}/10 caractères minimum
          </p>
        </div>
      </div>
    </div>
  );
}

type DocumentFormState = {
  title: string;
  category: string;
  file: File | null;
};

function StepDocuments({
  form,
  onChange,
  existing,
  onUpload,
  uploading,
}: {
  form: DocumentFormState;
  onChange: (v: DocumentFormState) => void;
  existing: CaseDocumentItem[];
  onUpload: () => void;
  uploading: boolean;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">Pièces justificatives</h2>
      <p className="mt-1 text-sm text-[var(--sf-green)]/60">
        Mandats, actes notariés, pièces d&apos;identité ou relevés (étape optionnelle).
      </p>
      {existing.length > 0 ? (
        <ul className="mt-4 space-y-2 text-sm">
          {existing.map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap justify-between gap-2 rounded-lg bg-[var(--sf-cream)]/60 px-3 py-2"
            >
              <span className="font-medium">{d.title}</span>
              <span className="text-[var(--sf-green)]/55">
                {DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-6 rounded-xl border border-dashed border-[var(--sf-cream-dark)] p-4">
        <p className="mb-4 text-sm font-medium text-[var(--sf-green-deep)]">Ajouter un document</p>
        <div className={wizardFieldGrid}>
          <div>
            <label className="block text-sm font-medium">Titre *</label>
            <input
              value={form.title}
              onChange={(e) => onChange({ ...form, title: e.target.value })}
              className="sf-input mt-1.5"
              placeholder="Ex. Mandat notarié 2024"
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Catégorie</label>
            <select
              value={form.category}
              onChange={(e) => onChange({ ...form, category: e.target.value })}
              className="sf-input mt-1.5"
            >
              {Object.entries(DOCUMENT_CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-sm font-medium">Fichier *</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={(e) =>
                onChange({ ...form, file: e.target.files?.[0] ?? null })
              }
              className="mt-1.5 block w-full text-sm text-[var(--sf-green)]/70 file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--sf-cream)] file:px-3 file:py-2 file:text-sm file:font-medium"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              disabled={uploading || !form.file || !form.title.trim()}
              onClick={onUpload}
              className="sf-btn-secondary w-full sm:w-auto"
            >
              {uploading ? "Envoi…" : "Téléverser le document"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SkipStepButton({
  disabled,
  onClick,
}: {
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-4 py-2 text-sm font-medium text-[var(--sf-green-deep)] transition hover:bg-[var(--sf-cream)] disabled:opacity-50"
    >
      Passer cette étape
    </button>
  );
}

function StepReview({
  progress,
  caseTypeLabel,
  caseDetail,
  trustedPersons,
}: {
  progress: import("@/types/api").OnboardingProgress;
  caseTypeLabel: string;
  caseDetail: FiduciaryCaseDetail;
  trustedPersons: DonorTrustedPerson[];
}) {
  const deferred = progress.pending_tasks ?? [];
  const donor = caseDetail.donors?.[0];
  const summarySections = [
    {
      title: "Donateur",
      items: donor
        ? [`${donor.first_name} ${donor.last_name}${donor.phone ? ` · ${donor.phone}` : ""}`]
        : ["Non renseigné"],
    },
    {
      title: "Personnes de confiance",
      items:
        trustedPersons.length > 0
          ? trustedPersons.map(
              (p) =>
                `${p.first_name} ${p.last_name} · ${p.phone} · ${p.email}`,
            )
          : ["Aucune"],
    },
    {
      title: "Mandats",
      items:
        (caseDetail.mandates?.length ?? 0) > 0
          ? caseDetail.mandates!.map((m) => `${m.title} (${MANDATE_TYPE_LABELS[m.mandate_type] ?? m.mandate_type})`)
          : ["Aucun"],
    },
    {
      title: "Bénéficiaires",
      items:
        (caseDetail.beneficiaries?.length ?? 0) > 0
          ? caseDetail.beneficiaries!.map((b) => {
              const share = formatSharePercent(b.patrimony_share_percent);
              const part =
                share && b.patrimony_share_value
                  ? ` · ${share} (${formatMoney(b.patrimony_share_value)})`
                  : share
                    ? ` · ${share}`
                    : "";
              return `${b.first_name} ${b.last_name}${b.relation_to_donor_label ? ` — ${b.relation_to_donor_label}` : ""}${part}`;
            })
          : ["Aucun"],
    },
    {
      title: "Patrimoine",
      items:
        (caseDetail.assets?.length ?? 0) > 0
          ? caseDetail.assets!.map((a) => {
              const val = a.latest_value
                ? ` · ${formatMoney(a.latest_value)}`
                : "";
              return `${a.label}${val}`;
            })
          : ["Aucun actif"],
    },
    {
      title: "Documents",
      items:
        (caseDetail.documents?.length ?? 0) > 0
          ? caseDetail.documents!.map(
              (d) =>
                `${d.title} (${DOCUMENT_CATEGORY_LABELS[d.category] ?? d.category})`,
            )
          : ["Aucun document"],
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">Synthèse</h2>
      <p className="mt-1 text-sm text-[var(--sf-green)]/60">
        <strong>{caseDetail.title}</strong> — {caseTypeLabel}. Vous pouvez soumettre même si des
        étapes sont reportées (à compléter ensuite).
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {summarySections.map((section) => (
          <div
            key={section.title}
            className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 p-3"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/50">
              {section.title}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-[var(--sf-green-deep)]">
              {section.items.map((line, i) => (
                <li key={`${section.title}-${i}`}>{line}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <ul className="mt-6 space-y-2">
        {progress.steps
          .filter((s) => s.id !== "review")
          .map((s) => (
            <li
              key={s.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${
                s.status === "completed"
                  ? "border-[var(--sf-green)]/20 bg-[var(--sf-cream)]/50"
                  : s.status === "skipped"
                    ? "border-red-200 bg-red-50"
                    : "border-amber-200 bg-amber-50"
              }`}
            >
              <span className="font-medium">{s.label}</span>
              <span
                className={
                  s.status === "completed"
                    ? "text-[var(--sf-green-mid)]"
                    : s.status === "skipped"
                      ? "font-medium text-red-700"
                      : "text-amber-800"
                }
              >
                {s.status === "completed"
                  ? "✓ Terminé"
                  : s.status === "skipped"
                    ? "Reportée"
                    : s.required
                      ? "À compléter"
                      : "Optionnel"}
              </span>
            </li>
          ))}
      </ul>
      {deferred.length > 0 ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50/80 p-4">
          <p className="text-sm font-semibold text-red-950">Tâches restantes après soumission</p>
          <ul className="mt-2 space-y-1 text-sm text-red-900">
            {deferred.map((t) => (
              <li key={t.id}>• {t.label}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {!progress.can_submit ? (
        <p className="mt-4 text-sm text-amber-800">
          Traitez ou reportez chaque étape obligatoire encore en attente (orange).
        </p>
      ) : null}
    </div>
  );
}
