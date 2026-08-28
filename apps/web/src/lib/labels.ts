export const CASE_ORIGIN_LABELS: Record<string, string> = {
  FAMILY_REQUEST: "Demande familiale",
  NOTARY: "Notaire",
  COURT: "Juridiction / tribunal",
  PARTNER: "Partenaire institutionnel",
  INTERNAL: "Initiative interne SOFIGEPAM",
  DIRECT_CONTACT: "Prise de contact directe",
  OTHER: "Autre",
};

export const CASE_TYPE_LABELS: Record<string, string> = {
  TUTELLE_CANTONNEMENT: "Tutelle / cantonnement",
  MANDAT_FIDUCIAIRE: "Mandat fiduciaire",
  WAQF: "Waqf familial ou productif",
  SUCCESSION: "Conseil successoral islamique",
  ZAKAT_FARAID: "Zakat & farāʾiḍ",
};

export const MANDATE_VALIDATION_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
  REQUEST_CHANGES: "Modifications demandées",
};

export const MANDATE_TYPE_LABELS: Record<string, string> = {
  JUDICIAL: "Judiciaire",
  NOTARIAL: "Notarial",
  FAMILY: "Familial",
  CONTRACTUAL: "Contractuel",
  WAQF: "Waqf",
  OTHER: "Autre",
};

export const WAQF_TYPE_LABELS: Record<string, string> = {
  FAMILY: "Waqf familial",
  PRODUCTIVE: "Waqf productif",
  MIXED: "Mixte (familial + productif)",
};

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  IDENTITY: "Pièce d'identité",
  MANDATE: "Mandat / procuration",
  COURT_DECISION: "Décision de justice",
  NOTARIAL_ACT: "Acte notarié",
  PROPERTY_TITLE: "Titre de propriété",
  BANK_STATEMENT: "Relevé bancaire",
  CONTRACT: "Contrat",
  OTHER: "Autre",
};

/** Indication UML selon le type d'actif sélectionné. */
export const ASSET_TYPE_HINTS: Record<string, string> = {
  REAL_ESTATE: "Adresse, usage (résidence, location…), revenu locatif éventuel.",
  LAND: "Localisation, surface, usage du foncier.",
  BANK_ACCOUNT: "Institution, n° de compte (si connu), solde estimé.",
  CASH: "Liquidités détenues (caisse, mobile money…).",
  BUSINESS: "Nom du commerce, secteur, revenu mensuel estimé.",
  AGRICULTURE: "Type d'exploitation, surface, revenu estimé.",
  LIVESTOCK: "Cheptel, valeur estimée.",
  SHARES: "Société, parts détenues.",
  GOLD: "Quantité, lieu de conservation.",
  OTHER: "Description libre de l'actif.",
};

export const VALUATION_FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "Mensuelle",
  QUARTERLY: "Trimestrielle",
  SEMIANNUAL: "Semestrielle",
  ANNUAL: "Annuelle",
  BIENNIAL: "Tous les 2 ans",
};

export const ASSET_EVENT_TYPE_LABELS: Record<string, string> = {
  GAIN: "Gain",
  EXPENSE: "Dépense",
  ESTIMATION: "Estimation",
  OTHER: "Autre",
};

export const GAIN_REFERENCE_LABELS: Record<string, string> = {
  RENT: "Loyer / revenu locatif",
  DIVIDEND: "Dividende / distribution",
  SALE: "Vente / cession",
  INTEREST: "Intérêts / rendement financier",
  SUBSIDY: "Subvention / aide",
  PRODUCTION: "Production / récolte",
  OTHER: "Autre référence",
};

export const EXPENSE_KIND_LABELS: Record<string, string> = {
  FIXED: "Dépense fixe",
  VARIABLE: "Dépense variable",
};

export const ASSET_TYPE_LABELS: Record<string, string> = {
  REAL_ESTATE: "Immobilier",
  LAND: "Foncier",
  BANK_ACCOUNT: "Compte bancaire",
  CASH: "Liquidités",
  GOLD: "Or",
  BUSINESS: "Commerce",
  SHARES: "Parts sociales",
  AGRICULTURE: "Agriculture",
  LIVESTOCK: "Élevage",
  WAQF_ASSET: "Actif waqf",
  OTHER: "Autre",
};

export const STAKEHOLDER_ROLE_LABELS: Record<string, string> = {
  FIDUCIARY_AGENT: "Agent fiduciaire",
  DIRECTION: "Direction",
  LEGAL: "Juridique",
  ACCOUNTING: "Comptabilité",
  CHARIA: "Comité charaïque",
  FAMILY: "Famille",
  GUARDIAN: "Tuteur",
  NOTARY: "Notaire",
  JUDGE: "Juge",
  AUDITOR: "Auditeur",
  OTHER: "Autre",
};

export const CASE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  UNDER_REVIEW: "En revue",
  LEGAL_REVIEW: "Revue juridique",
  COMPLIANCE_REVIEW: "Revue conformité",
  ACTIVE: "Actif",
  SUSPENDED: "Suspendu",
  CLOSING: "En clôture",
  CLOSED: "Clôturé",
  REJECTED: "Rejeté",
};

export const REPORT_TYPE_LABELS: Record<string, string> = {
  MONTHLY_MANAGEMENT_REPORT: "Rapport mensuel de gestion",
  QUARTERLY_FAMILY_REPORT: "Rapport trimestriel famille",
  SEMI_ANNUAL_NOTARY_JUDGE_REPORT: "Rapport semestriel notaire / juge",
  ANNUAL_MANAGEMENT_REPORT: "Rapport annuel de gestion",
  CHARIA_COMPLIANCE_REPORT: "Rapport charaïque",
  IMPACT_REPORT: "Rapport d'impact",
  FINAL_CLOSING_REPORT: "Rapport final de clôture",
};

export const REPORT_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_APPROVAL: "En revue",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
  ARCHIVED: "Archivé",
};

export const PROFILE_TYPE_LABELS: Record<string, string> = {
  beneficiary: "Héritier / bénéficiaire",
  guardian: "Tuteur",
  trusted_person: "Personne de confiance",
  donor: "Donateur",
};

export const PROFILE_TYPE_FILTER_OPTIONS = [
  { value: "", label: "Tous les types de profil" },
  ...Object.entries(PROFILE_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super administrateur",
  DIRECTION: "Direction",
  AGENT_FIDUCIAIRE: "Agent fiduciaire",
  JURIDIQUE_CONFORMITE: "Juridique",
  COMPTABLE_FIDUCIAIRE: "Comptable",
  COMITE_CHARAIQUE: "Comité charaïque",
  AUDITEUR: "Auditeur",
  FAMILLE_TUTEUR: "Famille / tuteur",
  NOTAIRE: "Notaire",
  JUGE: "Juge",
};

/** Rôles proposés à la création d'un compte (ordre d'affichage). */
/** Préfixe de l'identifiant auto (1 lettre + 6 chiffres). */
export const IDENTIFIER_PREFIX_LEGEND: { letter: string; label: string }[] = [
  { letter: "A", label: "Administration" },
  { letter: "D", label: "Direction" },
  { letter: "F", label: "Fiduciaire (agent)" },
  { letter: "J", label: "Juridique" },
  { letter: "C", label: "Comptable" },
  { letter: "K", label: "Comité charaïque" },
  { letter: "U", label: "Auditeur" },
  { letter: "H", label: "Héritier / famille" },
  { letter: "T", label: "Tuteur" },
  { letter: "N", label: "Notaire" },
  { letter: "G", label: "Juge" },
];

export const PARTY_TYPE_OPTIONS = [
  { value: "FAMILLE", label: "Famille / héritier (H…)" },
  { value: "TUTEUR", label: "Tuteur (T…)" },
] as const;

export const ASSIGNABLE_ROLES = [
  "SUPER_ADMIN",
  "DIRECTION",
  "AGENT_FIDUCIAIRE",
  "JURIDIQUE_CONFORMITE",
  "COMPTABLE_FIDUCIAIRE",
  "COMITE_CHARAIQUE",
  "AUDITEUR",
  "FAMILLE_TUTEUR",
  "NOTAIRE",
  "JUGE",
] as const;

export const INTERNAL_ASSIGNABLE_ROLES = [
  "SUPER_ADMIN",
  "DIRECTION",
  "AGENT_FIDUCIAIRE",
  "JURIDIQUE_CONFORMITE",
  "COMPTABLE_FIDUCIAIRE",
  "COMITE_CHARAIQUE",
  "AUDITEUR",
] as const;

export const EXTERNAL_ASSIGNABLE_ROLES = [
  "FAMILLE_TUTEUR",
  "NOTAIRE",
  "JUGE",
] as const;

export const USER_ROLE_FILTER_OPTIONS = [
  { value: "", label: "Tous les rôles" },
  ...ASSIGNABLE_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role] ?? role,
  })),
];

export const USER_INTERNAL_ROLE_FILTER_OPTIONS = [
  { value: "", label: "Tous les rôles internes" },
  ...INTERNAL_ASSIGNABLE_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role] ?? role,
  })),
];

export const USER_EXTERNAL_ROLE_FILTER_OPTIONS = [
  { value: "", label: "Tous les rôles externes" },
  ...EXTERNAL_ASSIGNABLE_ROLES.map((role) => ({
    value: role,
    label: ROLE_LABELS[role] ?? role,
  })),
];

export const USER_STATUS_FILTER_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "active", label: "Comptes actifs" },
  { value: "blocked", label: "Comptes bloqués" },
] as const;

export function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}

/** Âge à partir d'une date de naissance ISO (AAAA-MM-JJ). */
export function computePersonAge(dateOfBirth: string | null | undefined): string | null {
  if (!dateOfBirth?.trim()) return null;
  const birth = new Date(`${dateOfBirth.trim()}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    years -= 1;
  }
  if (years < 0) return null;
  return years === 1 ? "1 an" : `${years} ans`;
}

export function formatSharePercent(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(n)) return null;
  return `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}

export function formatDate(value: string): string {
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(d);
}

/** Date relative courte (ex. « il y a 2 j »). */
export function formatRelativeDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const rtf = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });
  if (Math.abs(diffSec) < 60) return rtf.format(-diffSec, "second");
  const diffMin = Math.round(diffSec / 60);
  if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, "minute");
  const diffHour = Math.round(diffMin / 60);
  if (Math.abs(diffHour) < 24) return rtf.format(-diffHour, "hour");
  const diffDay = Math.round(diffHour / 24);
  if (Math.abs(diffDay) < 30) return rtf.format(-diffDay, "day");
  const diffMonth = Math.round(diffDay / 30);
  if (Math.abs(diffMonth) < 12) return rtf.format(-diffMonth, "month");
  const diffYear = Math.round(diffMonth / 12);
  return rtf.format(-diffYear, "year");
}

/** Devise unique de la plateforme — Franc CFA (UEMOA). */
export const DEFAULT_CURRENCY = "XOF";
export const CURRENCY_LABEL = "Franc CFA (FCFA)";

export function formatMoney(amount: string, _currency?: string): string {
  const num = Number(amount);
  if (Number.isNaN(num)) return `${amount} FCFA`;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: DEFAULT_CURRENCY,
    maximumFractionDigits: 0,
  }).format(num);
}

/** Partie numérique seule (sans devise), pour affichage personnalisé. */
export function formatMoneyNumber(amount: string): string {
  const num = Number(amount);
  if (Number.isNaN(num)) return amount;
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(num);
}

/** Affichage saisie montant : 200 000 000 (espaces tous les 3 chiffres). */
export function formatAmountInput(value: string): string {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const [intPart, fracPart] = normalized.split(".");
  const digits = intPart.replace(/\D/g, "");
  if (!digits && !fracPart) return "";
  const spaced = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  if (fracPart !== undefined && normalized.includes(".")) {
    const decimals = fracPart.replace(/\D/g, "").slice(0, 2);
    return decimals ? `${spaced},${decimals}` : `${spaced},`;
  }
  return spaced;
}

/** Valeur brute pour l'API à partir d'un montant formaté. */
export function parseAmountInput(value: string): string {
  return value.replace(/\s/g, "").replace(",", ".");
}
