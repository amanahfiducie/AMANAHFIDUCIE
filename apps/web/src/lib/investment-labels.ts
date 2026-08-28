export const INVESTMENT_STATUS_LABELS: Record<string, string> = {
  PENDING_VALIDATION: "En attente de validation",
  ACTIVE: "Actif",
  MATURED: "Arrivé à échéance",
  CLOSED: "Clôturé",
};

export const ASSET_CLASS_SLUG_LABELS: Record<string, string> = {
  immobilier: "Immobilier",
  sukuk: "Sukuk",
  "actions-halal": "Actions halal",
  or: "Or",
  liquidites: "Liquidités",
  "activites-revenus": "Activités revenus",
};

/** Couleurs distinctes par classe d'actif (barres, légendes, donuts — toujours les mêmes). */
export const ASSET_CLASS_COLORS: Record<string, string> = {
  immobilier: "#B45309",
  "actions-halal": "#7C3AED",
  sukuk: "#2563EB",
  or: "#C9A227",
  liquidites: "#0891B2",
  "activites-revenus": "#059669",
};

/** Couleur unique pour la part non investie (tous graphiques). */
export const NON_INVESTED_COLOR = "#94A3B8";

/** Ordre canonique d'affichage des classes (légendes cohérentes). */
export const ASSET_CLASS_DISPLAY_ORDER = [
  "immobilier",
  "actions-halal",
  "sukuk",
  "or",
  "liquidites",
  "activites-revenus",
] as const;

const ALLOCATION_FALLBACK_COLORS = [
  "#B45309",
  "#7C3AED",
  "#2563EB",
  "#C9A227",
  "#0891B2",
  "#059669",
  "#DC2626",
  "#DB2777",
];

export function assetClassColor(slug: string, index = 0): string {
  if (slug === "non-investi") return NON_INVESTED_COLOR;
  return (
    ASSET_CLASS_COLORS[slug]
    ?? ALLOCATION_FALLBACK_COLORS[index % ALLOCATION_FALLBACK_COLORS.length]
  );
}

/** Variante claire de la couleur de classe (reste à investir). */
export function assetClassColorMuted(slug: string, index = 0): string {
  const base = assetClassColor(slug, index);
  return `${base}40`; // ~25 % opacités en hex 8 chiffres
}

export function sortAssetClassSlugs(slugs: string[]): string[] {
  return [...slugs].sort((a, b) => {
    const ia = ASSET_CLASS_DISPLAY_ORDER.indexOf(
      a as (typeof ASSET_CLASS_DISPLAY_ORDER)[number],
    );
    const ib = ASSET_CLASS_DISPLAY_ORDER.indexOf(
      b as (typeof ASSET_CLASS_DISPLAY_ORDER)[number],
    );
    const ra = ia === -1 ? 999 : ia;
    const rb = ib === -1 ? 999 : ib;
    if (ra !== rb) return ra - rb;
    return a.localeCompare(b);
  });
}

export const INDIVISION_RISK_LABELS: Record<string, string> = {
  LOW: "Faible",
  MEDIUM: "Modéré",
  HIGH: "Élevé",
};

export const PIGFI_ELIGIBLE_CASE_TYPES = new Set([
  "MANDAT_FIDUCIAIRE",
  "TUTELLE_CANTONNEMENT",
]);

export function caseSupportsInvestments(caseType: string | undefined): boolean {
  return !!caseType && PIGFI_ELIGIBLE_CASE_TYPES.has(caseType);
}

/** Le conseil successoral n'a pas de volet fonds fiduciaires / investissements. */
export function caseSupportsFinance(caseType: string | undefined): boolean {
  return !!caseType && caseType !== "SUCCESSION";
}
