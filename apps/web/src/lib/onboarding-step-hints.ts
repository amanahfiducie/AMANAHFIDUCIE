/**
 * Manques affichés pour compléter une étape — uniquement champs / données
 * réellement obligatoires (schéma onboarding, API, boutons du wizard).
 *
 * Référence backend : apps/api/cases/onboarding.py (OnboardingStepDef.required,
 * _step_data_satisfied) et serializers beneficiaries / mandates / assets.
 */
import type { CaseDocumentItem } from "@/lib/case-onboarding";
import type { CaseDonor, DonorTrustedPerson, FiduciaryCaseDetail } from "@/types/api";

export type StepHintsContext = {
  title: string;
  caseDetail: FiduciaryCaseDetail | null;
  caseDocuments: CaseDocumentItem[];
  donorForm: {
    first_name: string;
    last_name: string;
  };
  trustedPersonForm: {
    first_name: string;
    last_name: string;
    phone: string;
    email: string;
  };
  trustedPersons: DonorTrustedPerson[];
  primaryDonor: CaseDonor | null;
  mandateForm: { title: string };
  beneficiaryForm: {
    first_name: string;
    last_name: string;
    relation_to_donor: string;
    is_minor: boolean;
    guardian_mode: "existing" | "new";
    guardian_id: string;
    guardian_first_name: string;
    guardian_last_name: string;
  };
  requireBeneficiaryGuardian: boolean;
  assetForm: { label: string };
  waqfForm: { waqf_object: string; waqf_distribution_rules: string };
};

export type StepHintsOptions = {
  /** false si l'étape est optionnelle pour ce type de dossier (ex. bénéficiaires en mandat fiduciaire). */
  stepRequired: boolean;
};

function personName(first: string, last: string, fallback = "cette personne"): string {
  const f = first.trim();
  const l = last.trim();
  if (f && l) return `${f} ${l}`;
  if (f) return f;
  return fallback;
}

function hasDonor(ctx: StepHintsContext): boolean {
  if (ctx.primaryDonor) return true;
  return Boolean(ctx.donorForm.first_name.trim() && ctx.donorForm.last_name.trim());
}

export function getStepCompletionHints(
  stepId: string,
  ctx: StepHintsContext,
  options: StepHintsOptions,
): string[] {
  if (!options.stepRequired) {
    return [];
  }

  const hints: string[] = [];

  if (stepId === "identification") {
    if (!ctx.title.trim()) {
      hints.push("Intitulé du dossier (obligatoire)");
    }
    return hints;
  }

  if (stepId === "donor") {
    if (!hasDonor(ctx)) {
      if (!ctx.donorForm.first_name.trim() && !ctx.donorForm.last_name.trim()) {
        hints.push("Prénom et nom du donateur");
      } else if (!ctx.donorForm.first_name.trim()) {
        hints.push("Prénom du donateur");
      } else {
        hints.push("Nom du donateur");
      }
    }
    return hints;
  }

  if (stepId === "donor_trusted") {
    if (!ctx.primaryDonor && !hasDonor(ctx)) {
      hints.push("Donateur enregistré (étape précédente)");
      return hints;
    }
    if (ctx.trustedPersons.length === 0) {
      hints.push(
        "Au moins une personne de confiance (prénom, nom, téléphone et e-mail obligatoires à l'ajout)",
      );
    }
    const f = ctx.trustedPersonForm;
    const started = f.first_name.trim() || f.last_name.trim();
    if (started) {
      const label = personName(f.first_name, f.last_name, "la personne en cours de saisie");
      if (!f.first_name.trim() || !f.last_name.trim()) {
        hints.push(`Prénom et nom pour ${label}`);
      }
      if (!f.phone.trim()) {
        hints.push(`Téléphone pour ${label} (obligatoire)`);
      }
      if (!f.email.trim()) {
        hints.push(`E-mail pour ${label} (obligatoire)`);
      }
    }
    return hints;
  }

  if (stepId === "mandate") {
    const mandates = ctx.caseDetail?.mandates ?? [];
    if (mandates.length === 0) {
      if (!ctx.mandateForm.title.trim()) {
        hints.push("Intitulé du mandat (obligatoire pour enregistrer un mandat)");
      } else {
        hints.push("Au moins un mandat enregistré");
      }
    }
    return hints;
  }

  if (stepId === "beneficiaries") {
    const list = ctx.caseDetail?.beneficiaries ?? [];
    if (list.length === 0) {
      if (!ctx.beneficiaryForm.first_name.trim() || !ctx.beneficiaryForm.last_name.trim()) {
        hints.push("Au moins un héritier (prénom et nom)");
      }
      if (!ctx.beneficiaryForm.relation_to_donor) {
        hints.push("Lien avec le donateur (obligatoire à l'ajout)");
      }
      if (ctx.requireBeneficiaryGuardian) {
        const g = ctx.beneficiaryForm;
        const guardians = ctx.caseDetail?.guardians ?? [];
        if (g.guardian_mode === "existing" && guardians.length > 0 && !g.guardian_id) {
          hints.push("Tuteur à sélectionner (obligatoire pour un mineur)");
        }
        if (
          g.guardian_mode === "new"
          && (!g.guardian_first_name.trim() || !g.guardian_last_name.trim())
        ) {
          hints.push("Prénom et nom du tuteur (obligatoires pour un mineur)");
        }
        if (guardians.length === 0 && !g.guardian_first_name.trim()) {
          hints.push("Tuteur à créer (obligatoire pour un mineur)");
        }
      }
    }
    return hints;
  }

  if (stepId === "patrimoine") {
    const assets = ctx.caseDetail?.assets ?? [];
    if (assets.length === 0) {
      if (!ctx.assetForm.label.trim()) {
        hints.push("Au moins un actif (libellé obligatoire)");
      }
    }
    return hints;
  }

  if (stepId === "waqf_intention") {
    if (ctx.waqfForm.waqf_object.trim().length < 10) {
      hints.push("Objet du waqf (10 caractères minimum, obligatoire)");
    }
    if (ctx.waqfForm.waqf_distribution_rules.trim().length < 10) {
      hints.push("Règles de distribution du waqf (10 caractères minimum, obligatoires)");
    }
    return hints;
  }

  // Étape « documents » : required=False dans le schéma — pas d'alerte de complétion.
  if (stepId === "documents") {
    return [];
  }

  return hints;
}

/** Étapes où l'utilisateur peut reporter (hors type et synthèse). */
export const SKIPPABLE_ONBOARDING_STEPS = new Set([
  "identification",
  "donor",
  "donor_trusted",
  "mandate",
  "beneficiaries",
  "patrimoine",
  "waqf_intention",
  "documents",
]);

export function canSkipOnboardingStep(stepId: string): boolean {
  return SKIPPABLE_ONBOARDING_STEPS.has(stepId);
}

/** Étape obligatoire pour le type de dossier courant (d'après le schéma API). */
export function isOnboardingStepRequired(
  stepId: string,
  steps: { id: string; required: boolean }[] | undefined,
): boolean {
  if (stepId === "type" || stepId === "review") return false;
  if (stepId === "identification") return true;
  const def = steps?.find((s) => s.id === stepId);
  if (!def) return true;
  return def.required;
}
