export const VALIDATION_TYPE_LABELS: Record<string, string> = {
  CASE_REVIEW: "Circuit dossier",
  LEGAL: "Juridique",
  ACCOUNTING: "Comptable",
  MANAGEMENT: "Direction",
  CHARIA: "Charaïque",
  AUDIT: "Audit",
};

export const VALIDATION_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  IN_PROGRESS: "En cours",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
  REQUEST_CHANGES: "Modifications demandées",
  CANCELLED: "Annulé",
};

export const VALIDATION_STEP_STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Validé",
  REJECTED: "Rejeté",
  REQUEST_CHANGES: "À modifier",
  SKIPPED: "Non concerné",
};

export const VALIDATION_SUBJECT_LABELS: Record<string, string> = {
  CASE: "Dossier fiduciaire",
  MANDATE: "Mandat",
  FINANCIAL_MOVEMENT: "Mouvement financier",
  OTHER: "Autre",
};

export const DOSSIER_WORKFLOW_STEPS = [
  { order: 1, role: "AGENT_FIDUCIAIRE", label: "Chargé du dossier" },
  { order: 2, role: "DIRECTION", label: "Direction" },
  { order: 3, role: "COMITE_CHARAIQUE", label: "Comité charaïque" },
  { order: 4, role: "JURIDIQUE_CONFORMITE", label: "Juridique & conformité" },
] as const;

const STEP_LABEL_BY_ROLE: Record<string, string> = Object.fromEntries(
  DOSSIER_WORKFLOW_STEPS.map((s) => [s.role, s.label]),
);

/** Libellé unique d'une étape (rôle → label canonique). */
export function validationStepLabel(
  role: string | undefined | null,
  fallback?: string | null,
): string {
  if (role && STEP_LABEL_BY_ROLE[role]) return STEP_LABEL_BY_ROLE[role];
  const fb = (fallback || "").trim();
  if (fb) return fb;
  if (role) return role.replace(/_/g, " ");
  return "—";
}
