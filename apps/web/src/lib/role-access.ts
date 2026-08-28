import type { NavIconId } from "@/components/nav-icon";
import type { MeResponse } from "@/types/api";

export type InternalLane =
  | "juridique"
  | "charia"
  | "direction"
  | "comptable"
  | "audit";

export type PrimaryInternalRole =
  | "SUPER_ADMIN"
  | "DIRECTION"
  | "COMITE_CHARAIQUE"
  | "JURIDIQUE_CONFORMITE"
  | "COMPTABLE_FIDUCIAIRE"
  | "AUDITEUR"
  | "AGENT_FIDUCIAIRE";

const INTERNAL_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "AGENT_FIDUCIAIRE",
  "JURIDIQUE_CONFORMITE",
  "COMPTABLE_FIDUCIAIRE",
  "COMITE_CHARAIQUE",
  "AUDITEUR",
]);

const JURIDIQUE_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "JURIDIQUE_CONFORMITE",
]);

const CHARIA_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "COMITE_CHARAIQUE",
]);

const COMITE_CHARAIQUE_ROLES = new Set(["SUPER_ADMIN", "COMITE_CHARAIQUE"]);

const DIRECTION_ROLES = new Set(["SUPER_ADMIN", "DIRECTION"]);

const COMPTABLE_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "COMPTABLE_FIDUCIAIRE",
]);

const SERVICES_VIEW_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "COMPTABLE_FIDUCIAIRE",
]);

const SERVICES_MANAGE_ROLES = new Set(["SUPER_ADMIN", "DIRECTION"]);

const AUDIT_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "AUDITEUR",
]);

const INVESTMENT_NAV_ITEM: NavItem = {
  href: "/investissements",
  label: "Finance & investissements",
  icon: "investissements",
};

const INVESTMENT_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "AGENT_FIDUCIAIRE",
  "COMITE_CHARAIQUE",
  "COMPTABLE_FIDUCIAIRE",
]);

const USER_MANAGER_ROLES = new Set(["SUPER_ADMIN"]);

const CASE_CREATE_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "AGENT_FIDUCIAIRE",
]);

const CASE_WRITE_ROLES = new Set([
  ...CASE_CREATE_ROLES,
]);

const VALIDATION_CREATE_ROLES = new Set([
  ...CASE_WRITE_ROLES,
  "COMPTABLE_FIDUCIAIRE",
]);

const REPORT_GENERATE_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "AGENT_FIDUCIAIRE",
  "COMPTABLE_FIDUCIAIRE",
]);

const REPORT_APPROVE_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "JURIDIQUE_CONFORMITE",
]);

const MANDATE_VALIDATE_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "JURIDIQUE_CONFORMITE",
]);

/** Rôles autorisés à trancher une validation selon son type (aligné backend). */
const VALIDATION_DECIDE_ROLES: Record<string, Set<string>> = {
  LEGAL: new Set(["JURIDIQUE_CONFORMITE"]),
  ACCOUNTING: new Set(["COMPTABLE_FIDUCIAIRE"]),
  MANAGEMENT: new Set(["DIRECTION"]),
  CHARIA: new Set(["COMITE_CHARAIQUE"]),
  AUDIT: new Set(["AUDITEUR"]),
  CASE_REVIEW: new Set([
    "AGENT_FIDUCIAIRE",
    "DIRECTION",
    "COMITE_CHARAIQUE",
    "JURIDIQUE_CONFORMITE",
  ]),
};

const PRIMARY_ROLE_PRIORITY: PrimaryInternalRole[] = [
  "SUPER_ADMIN",
  "DIRECTION",
  "COMITE_CHARAIQUE",
  "JURIDIQUE_CONFORMITE",
  "COMPTABLE_FIDUCIAIRE",
  "AUDITEUR",
  "AGENT_FIDUCIAIRE",
];

const ROLE_HOME: Record<PrimaryInternalRole, string> = {
  SUPER_ADMIN: "/dashboard",
  DIRECTION: "/dashboard",
  COMITE_CHARAIQUE: "/charia",
  JURIDIQUE_CONFORMITE: "/juridique",
  COMPTABLE_FIDUCIAIRE: "/comptable",
  AUDITEUR: "/audit",
  AGENT_FIDUCIAIRE: "/dashboard",
};

const ROLE_SHELL_SUBTITLE: Record<PrimaryInternalRole, string> = {
  SUPER_ADMIN: "Administration plateforme",
  DIRECTION: "Pilotage & approbations",
  COMITE_CHARAIQUE: "Conformité charaïque",
  JURIDIQUE_CONFORMITE: "Juridique & conformité",
  COMPTABLE_FIDUCIAIRE: "Comptabilité SOFIGEPAM",
  AUDITEUR: "Audit & traçabilité",
  AGENT_FIDUCIAIRE: "Gestion fiduciaire",
};

export function resolvePrimaryInternalRole(
  user: MeResponse | null,
): PrimaryInternalRole | null {
  if (!user) return null;
  if (user.is_superuser || user.roles.includes("SUPER_ADMIN")) {
    return "SUPER_ADMIN";
  }
  const roles = new Set(user.roles.filter((r) => INTERNAL_ROLES.has(r)));
  for (const role of PRIMARY_ROLE_PRIORITY) {
    if (roles.has(role)) return role;
  }
  return null;
}

export function homePathForInternalUser(user: MeResponse | null): string {
  const primary = resolvePrimaryInternalRole(user);
  if (!primary) return "/login";
  return ROLE_HOME[primary];
}

export function shellSubtitleForUser(user: MeResponse | null): string {
  const primary = resolvePrimaryInternalRole(user);
  if (!primary) return "Plateforme interne";
  return ROLE_SHELL_SUBTITLE[primary];
}

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconId;
};

export type UserNavConfig = {
  homeHref: string;
  items: NavItem[];
  groupNav: boolean;
};

function compteItem(): NavItem {
  return { href: "/compte", label: "Mon compte", icon: "compte" };
}

function poleItemsForUser(user: MeResponse): NavItem[] {
  const poles: NavItem[] = [];
  if (userCanAccessLane(user, "comptable")) {
    poles.push({ href: "/comptable", label: "Comptabilité", icon: "comptable" });
  }
  if (userCanAccessLane(user, "audit")) {
    poles.push({ href: "/audit", label: "Audit", icon: "audit" });
  }
  return poles;
}

function navForSuperAdmin(user: MeResponse): UserNavConfig {
  const items: NavItem[] = [
    { href: "/dashboard", label: "Tableau de bord", icon: "dashboard" },
    { href: "/dossiers", label: "Dossiers", icon: "dossiers" },
    INVESTMENT_NAV_ITEM,
    { href: "/validations", label: "Validations", icon: "validations" },
    { href: "/factures", label: "Factures", icon: "factures" },
    { href: "/services", label: "Services", icon: "services" },
    ...poleItemsForUser(user),
  ];
  if (userCanManageUsers(user)) {
    items.push({ href: "/admin/utilisateurs", label: "Utilisateurs", icon: "utilisateurs" });
  }
  items.push(compteItem());
  return { homeHref: "/dashboard", items, groupNav: true };
}

function navForDirection(user: MeResponse): UserNavConfig {
  return {
    homeHref: "/dashboard",
    items: [
      { href: "/dashboard", label: "Tableau de bord", icon: "dashboard" },
      { href: "/dossiers", label: "Dossiers", icon: "dossiers" },
      INVESTMENT_NAV_ITEM,
      { href: "/validations", label: "Validations", icon: "validations" },
      { href: "/factures", label: "Factures", icon: "factures" },
      { href: "/services", label: "Services", icon: "services" },
      ...poleItemsForUser(user),
      compteItem(),
    ],
    groupNav: true,
  };
}

function navForCharia(): UserNavConfig {
  return {
    homeHref: "/charia",
    items: [
      { href: "/charia", label: "Tableau de bord", icon: "dashboard" },
      { href: "/charia/circuits", label: "Circuits dossiers", icon: "charia" },
      { href: "/charia/demandes", label: "Demandes CHARIA", icon: "charia" },
      { href: "/charia/observations", label: "Observations", icon: "charia" },
      { href: "/charia/partages", label: "Partages farāʾiḍ", icon: "charia" },
      { href: "/dossiers", label: "Dossiers", icon: "dossiers" },
      INVESTMENT_NAV_ITEM,
      compteItem(),
    ],
    groupNav: false,
  };
}

function navForJuridique(): UserNavConfig {
  return {
    homeHref: "/juridique",
    items: [
      { href: "/juridique", label: "Tableau de bord", icon: "dashboard" },
      { href: "/juridique/circuits", label: "Circuits dossiers", icon: "juridique" },
      { href: "/juridique/demandes", label: "Demandes LEGAL", icon: "juridique" },
      { href: "/juridique/dossiers", label: "Dossiers en revue", icon: "dossiers" },
      { href: "/dossiers", label: "Tous les dossiers", icon: "dossiers" },
      compteItem(),
    ],
    groupNav: false,
  };
}

function navForComptable(): UserNavConfig {
  return {
    homeHref: "/comptable",
    items: [
      { href: "/comptable", label: "Vue d'ensemble", icon: "dashboard" },
      { href: "/comptable/recettes", label: "Recettes", icon: "comptable" },
      { href: "/comptable/depenses", label: "Dépenses", icon: "comptable" },
      { href: "/comptable/mouvements", label: "Journal", icon: "comptable" },
      { href: "/comptable/fiduciaire", label: "Fonds fiduciaires", icon: "dossiers" },
      { href: "/services", label: "Services", icon: "services" },
      INVESTMENT_NAV_ITEM,
      compteItem(),
    ],
    groupNav: false,
  };
}

function navForAudit(): UserNavConfig {
  return {
    homeHref: "/audit",
    items: [
      { href: "/audit", label: "Vue d'ensemble", icon: "dashboard" },
      { href: "/audit/logs", label: "Journal d'audit", icon: "audit" },
      { href: "/dossiers", label: "Dossiers", icon: "dossiers" },
      INVESTMENT_NAV_ITEM,
      compteItem(),
    ],
    groupNav: false,
  };
}

function navForAgent(): UserNavConfig {
  return {
    homeHref: "/dashboard",
    items: [
      { href: "/dashboard", label: "Tableau de bord", icon: "dashboard" },
      { href: "/dossiers", label: "Dossiers", icon: "dossiers" },
      INVESTMENT_NAV_ITEM,
      compteItem(),
    ],
    groupNav: false,
  };
}

export function navConfigForUser(user: MeResponse | null): UserNavConfig {
  if (!user) {
    return { homeHref: "/login", items: [], groupNav: false };
  }
  const primary = resolvePrimaryInternalRole(user);
  switch (primary) {
    case "SUPER_ADMIN":
      return navForSuperAdmin(user);
    case "DIRECTION":
      return navForDirection(user);
    case "COMITE_CHARAIQUE":
      return navForCharia();
    case "JURIDIQUE_CONFORMITE":
      return navForJuridique();
    case "COMPTABLE_FIDUCIAIRE":
      return navForComptable();
    case "AUDITEUR":
      return navForAudit();
    case "AGENT_FIDUCIAIRE":
    default:
      return navForAgent();
  }
}

export function navItemsForUser(user: MeResponse | null): NavItem[] {
  return navConfigForUser(user).items;
}

export function userCanManageUsers(user: MeResponse | null): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  return user.roles.some((r) => USER_MANAGER_ROLES.has(r));
}

/** Création de dossiers fiduciaires. */
export function userCanCreateCase(user: MeResponse | null): boolean {
  return userHasAnyRole(user, CASE_CREATE_ROLES);
}

/** Modification du contenu dossier (patrimoine, mandats, bénéficiaires…).
 *  Hors JURIDIQUE_CONFORMITE (lecture + validations / avis qui le concernent). */
export function userCanWriteCase(user: MeResponse | null): boolean {
  return userHasAnyRole(user, CASE_WRITE_ROLES);
}

/** Validation / approbation de mandats. */
export function userCanValidateMandate(user: MeResponse | null): boolean {
  return userHasAnyRole(user, MANDATE_VALIDATE_ROLES);
}

/** Création d'une demande de validation sur un dossier. */
export function userCanCreateValidation(user: MeResponse | null): boolean {
  return userHasAnyRole(user, VALIDATION_CREATE_ROLES);
}

/** Génération de rapports PDF (brouillon). */
export function userCanGenerateReports(user: MeResponse | null): boolean {
  return userHasAnyRole(user, REPORT_GENERATE_ROLES);
}

/** Approbation / publication de rapports. */
export function userCanApproveReports(user: MeResponse | null): boolean {
  return userHasAnyRole(user, REPORT_APPROVE_ROLES);
}

/**
 * Peut agir sur l'étape courante d'une validation
 * (rôle assigné + type de validation, aligné backend).
 */
export function userCanActOnValidationStep(
  user: MeResponse | null,
  validationType: string | undefined,
  assignedRole: string | undefined,
  options?: { caseAssignedTo?: number | null },
): boolean {
  if (!user || !assignedRole) return false;
  if (!userCanDecideValidationType(user, validationType)) return false;
  if (user.is_superuser) return true;
  if (user.roles.includes(assignedRole)) return true;
  if (
    assignedRole === "AGENT_FIDUCIAIRE"
    && options?.caseAssignedTo != null
    && options.caseAssignedTo === user.id
  ) {
    return true;
  }
  return false;
}

/**
 * Peut approuver / rejeter une validation du type donné
 * (boutons masqués si le rôle n'est pas concerné).
 */
export function userCanDecideValidationType(
  user: MeResponse | null,
  validationType: string | undefined,
): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (!validationType) {
    return Object.values(VALIDATION_DECIDE_ROLES).some((roles) =>
      user.roles.some((r) => roles.has(r)),
    );
  }
  const allowed = VALIDATION_DECIDE_ROLES[validationType];
  if (!allowed) return false;
  return user.roles.some((r) => allowed.has(r));
}

/** Statuts pour lesquels le dossier est verrouillé (aucune modification). */
export const CASE_LOCKED_STATUSES = new Set(["CLOSED", "REJECTED"]);

export function caseIsLocked(status: string | null | undefined): boolean {
  return !!status && CASE_LOCKED_STATUSES.has(status);
}

/** Lecture seule sur le contenu dossier (hors périmètres charaïque / compta dédiés). */
export function userIsCaseReadOnly(
  user: MeResponse | null,
  caseStatus?: string | null,
): boolean {
  if (caseIsLocked(caseStatus)) return true;
  if (!user || user.is_superuser) return false;
  return !userCanWriteCase(user);
}

/** Peut écrire le contenu d'un dossier (rôle + statut). */
export function userCanWriteCaseContent(
  user: MeResponse | null,
  caseStatus?: string | null,
): boolean {
  return !userIsCaseReadOnly(user, caseStatus);
}

export function userHasAnyRole(user: MeResponse | null, roles: Set<string>): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  return user.roles.some((r) => roles.has(r));
}

export function userCanReviewFaraid(user: MeResponse | null): boolean {
  return userHasAnyRole(user, CHARIA_ROLES);
}

/** Accès à l'onglet Succession (évaluation héritiers) — réservé au comité charaïque. */
export function userIsComiteCharaique(user: MeResponse | null): boolean {
  return userHasAnyRole(user, COMITE_CHARAIQUE_ROLES);
}

const OBSERVATION_SUBMIT_ROLES = new Set([
  "SUPER_ADMIN",
  "JURIDIQUE_CONFORMITE",
  "JUGE",
  "NOTAIRE",
  "FAMILLE_TUTEUR",
]);

const OBSERVATION_REVIEW_ROLES = new Set(["SUPER_ADMIN", "DIRECTION", "COMITE_CHARAIQUE"]);

/** Comptabilité entreprise SOFIGEPAM (hors dossiers). */
export function userCanAccessEnterpriseFinance(user: MeResponse | null): boolean {
  return userHasAnyRole(user, COMPTABLE_ROLES);
}

export function userCanManageEnterpriseFinance(user: MeResponse | null): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  return user.roles.includes("COMPTABLE_FIDUCIAIRE");
}

const CASE_FINANCE_TAB_ROLES = new Set([
  "SUPER_ADMIN",
  "DIRECTION",
  "AGENT_FIDUCIAIRE",
]);

/** Gestion du catalogue PIGFI (types A–D, classes d'actifs). */
export function userCanManageInvestmentCatalog(user: MeResponse | null): boolean {
  return userCanWriteCase(user);
}

/** Section investissements PIGFI (mandat S1 / tutelle S2). */
export function userCanAccessInvestments(user: MeResponse | null): boolean {
  return userHasAnyRole(user, INVESTMENT_ROLES);
}

/** Onglet Fonds fiduciaires dans un dossier — pas pour le pôle comptable pur. */
export function userCanViewCaseFinanceTab(user: MeResponse | null): boolean {
  return userHasAnyRole(user, CASE_FINANCE_TAB_ROLES);
}

export function userIsComptableOnly(user: MeResponse | null): boolean {
  if (!user || user.is_superuser) return false;
  const roles = user.roles.filter((r) => r !== "SUPER_ADMIN");
  return roles.length > 0 && roles.every((r) => r === "COMPTABLE_FIDUCIAIRE");
}

/** Sous-menu Remarques : réservé à la direction et au comité charaïque. */
export function userCanViewCaseRemarksSubmenu(user: MeResponse | null): boolean {
  return userHasAnyRole(user, OBSERVATION_REVIEW_ROLES);
}

/** Direction ou comité : valider / refuser une observation partagée. */
export function userCanReviewCaseObservation(user: MeResponse | null): boolean {
  return userHasAnyRole(user, OBSERVATION_REVIEW_ROLES);
}

/** Avocat, juge, notaire, famille, parties prenantes : déposer une observation. */
export function userCanSubmitCaseObservation(user: MeResponse | null): boolean {
  if (!user) return false;
  if (user.is_superuser) return true;
  if (user.roles.some((r) => OBSERVATION_SUBMIT_ROLES.has(r))) return true;
  const internal = new Set([
    "DIRECTION",
    "AGENT_FIDUCIAIRE",
    "JURIDIQUE_CONFORMITE",
    "COMPTABLE_FIDUCIAIRE",
    "COMITE_CHARAIQUE",
    "AUDITEUR",
  ]);
  return !user.roles.some((r) => internal.has(r));
}

/** Remarques internes : direction et comité charaïque. */
export function userCanAddCaseRemark(user: MeResponse | null): boolean {
  return userCanViewCaseRemarksSubmenu(user);
}

export function userCanAccessLane(
  user: MeResponse | null,
  lane: InternalLane,
): boolean {
  if (lane === "juridique") return userHasAnyRole(user, JURIDIQUE_ROLES);
  if (lane === "charia") return userHasAnyRole(user, CHARIA_ROLES);
  if (lane === "comptable") return userHasAnyRole(user, COMPTABLE_ROLES);
  if (lane === "audit") return userHasAnyRole(user, AUDIT_ROLES);
  return userHasAnyRole(user, DIRECTION_ROLES);
}

/** Affectation du chargé de dossier : direction et super-admin uniquement. */
export function userCanManageCaseAssignment(user: MeResponse | null): boolean {
  return userHasAnyRole(user, DIRECTION_ROLES);
}

/** Catalogue Services — lecture (Direction, Admin, Comptable). */
export function userCanViewServices(user: MeResponse | null): boolean {
  return userHasAnyRole(user, SERVICES_VIEW_ROLES);
}

/** Catalogue Services — édition des tarifs (Direction, Admin). */
export function userCanManageServices(user: MeResponse | null): boolean {
  return userHasAnyRole(user, SERVICES_MANAGE_ROLES);
}
