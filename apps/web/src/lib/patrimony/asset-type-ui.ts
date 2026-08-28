import { ASSET_TYPE_HINTS, ASSET_TYPE_LABELS } from "@/lib/labels";

export type AssetTypeKey = keyof typeof ASSET_TYPE_LABELS | string;

export type AssetTypeUi = {
  label: string;
  hint: string;
  labelPlaceholder: string;
  locationLabel: string;
  locationPlaceholder: string;
  descriptionPlaceholder: string;
  /** Classes Tailwind pour l’icône et son fond */
  accent: string;
  iconBg: string;
};

const DEFAULT_UI: AssetTypeUi = {
  label: "Autre",
  hint: ASSET_TYPE_HINTS.OTHER ?? "",
  labelPlaceholder: "Désignation du bien",
  locationLabel: "Localisation",
  locationPlaceholder: "Ville ou lieu de conservation",
  descriptionPlaceholder: "Précisions utiles pour l'évaluation",
  accent: "text-slate-700",
  iconBg: "bg-slate-100 border-slate-200",
};

export const ASSET_TYPE_UI: Record<string, AssetTypeUi> = {
  REAL_ESTATE: {
    label: ASSET_TYPE_LABELS.REAL_ESTATE,
    hint: ASSET_TYPE_HINTS.REAL_ESTATE,
    labelPlaceholder: "Ex. Immeuble résidentiel Almadies",
    locationLabel: "Adresse / quartier",
    locationPlaceholder: "Dakar, Almadies — rue…",
    descriptionPlaceholder: "Usage (résidence, location), surface, loyer mensuel…",
    accent: "text-sky-800",
    iconBg: "bg-sky-50 border-sky-200",
  },
  LAND: {
    label: ASSET_TYPE_LABELS.LAND,
    hint: ASSET_TYPE_HINTS.LAND,
    labelPlaceholder: "Ex. Parcelle agricole Thiès",
    locationLabel: "Localisation du foncier",
    locationPlaceholder: "Région, commune, repères…",
    descriptionPlaceholder: "Surface (ha), titre foncier, usage prévu…",
    accent: "text-emerald-800",
    iconBg: "bg-emerald-50 border-emerald-200",
  },
  BANK_ACCOUNT: {
    label: ASSET_TYPE_LABELS.BANK_ACCOUNT,
    hint: ASSET_TYPE_HINTS.BANK_ACCOUNT,
    labelPlaceholder: "Ex. Compte courant BIS",
    locationLabel: "Institution",
    locationPlaceholder: "Banque Islamique du Sénégal, agence…",
    descriptionPlaceholder: "Type de compte, devise, solde de référence…",
    accent: "text-indigo-800",
    iconBg: "bg-indigo-50 border-indigo-200",
  },
  CASH: {
    label: ASSET_TYPE_LABELS.CASH,
    hint: ASSET_TYPE_HINTS.CASH,
    labelPlaceholder: "Ex. Liquidités coffre / Orange Money",
    locationLabel: "Lieu de détention",
    locationPlaceholder: "Domicile, coffre, portefeuille mobile…",
    descriptionPlaceholder: "Montant approximatif, devise, contexte…",
    accent: "text-teal-800",
    iconBg: "bg-teal-50 border-teal-200",
  },
  BUSINESS: {
    label: ASSET_TYPE_LABELS.BUSINESS,
    hint: ASSET_TYPE_HINTS.BUSINESS,
    labelPlaceholder: "Ex. Boutique textile Sandaga",
    locationLabel: "Adresse du commerce",
    locationPlaceholder: "Marché, ville, point de vente…",
    descriptionPlaceholder: "Secteur, chiffre d'affaires mensuel, associés…",
    accent: "text-amber-900",
    iconBg: "bg-amber-50 border-amber-200",
  },
  AGRICULTURE: {
    label: ASSET_TYPE_LABELS.AGRICULTURE,
    hint: ASSET_TYPE_HINTS.AGRICULTURE,
    labelPlaceholder: "Ex. Exploitation arachide Kaolack",
    locationLabel: "Zone d'exploitation",
    locationPlaceholder: "Commune, superficie cultivée…",
    descriptionPlaceholder: "Cultures, matériel, revenus saisonniers…",
    accent: "text-lime-800",
    iconBg: "bg-lime-50 border-lime-200",
  },
  LIVESTOCK: {
    label: ASSET_TYPE_LABELS.LIVESTOCK,
    hint: ASSET_TYPE_HINTS.LIVESTOCK,
    labelPlaceholder: "Ex. Troupeau bovins Ferlo",
    locationLabel: "Lieu du cheptel",
    locationPlaceholder: "Zone de pâture, étable…",
    descriptionPlaceholder: "Nombre de têtes, races, valeur unitaire…",
    accent: "text-orange-800",
    iconBg: "bg-orange-50 border-orange-200",
  },
  SHARES: {
    label: ASSET_TYPE_LABELS.SHARES,
    hint: ASSET_TYPE_HINTS.SHARES,
    labelPlaceholder: "Ex. Parts SARL familiale",
    locationLabel: "Siège / registre",
    locationPlaceholder: "Société, pays d'immatriculation…",
    descriptionPlaceholder: "% détenu, valeur nominale, dernière valorisation…",
    accent: "text-violet-800",
    iconBg: "bg-violet-50 border-violet-200",
  },
  GOLD: {
    label: ASSET_TYPE_LABELS.GOLD,
    hint: ASSET_TYPE_HINTS.GOLD,
    labelPlaceholder: "Ex. Or en lingots — coffre",
    locationLabel: "Lieu de conservation",
    locationPlaceholder: "Banque, coffre-fort, domicile…",
    descriptionPlaceholder: "Poids, pureté, certificat d'authenticité…",
    accent: "text-yellow-800",
    iconBg: "bg-yellow-50 border-yellow-200",
  },
  WAQF_ASSET: {
    label: ASSET_TYPE_LABELS.WAQF_ASSET,
    hint: "Bien dédié au waqf — précisez la finalité.",
    labelPlaceholder: "Ex. Local waqf mosquée",
    locationLabel: "Localisation",
    locationPlaceholder: "Adresse ou commune…",
    descriptionPlaceholder: "Objet du waqf, bénéficiaires, restrictions…",
    accent: "text-[var(--sf-green-deep)]",
    iconBg: "bg-[var(--sf-cream)] border-[var(--sf-gold)]/40",
  },
  OTHER: {
    ...DEFAULT_UI,
    label: ASSET_TYPE_LABELS.OTHER,
    hint: ASSET_TYPE_HINTS.OTHER,
  },
};

export const ASSET_TYPE_ORDER = [
  "REAL_ESTATE",
  "LAND",
  "BANK_ACCOUNT",
  "CASH",
  "BUSINESS",
  "AGRICULTURE",
  "LIVESTOCK",
  "SHARES",
  "GOLD",
  "WAQF_ASSET",
  "OTHER",
] as const;

export function assetTypeUi(assetType: string): AssetTypeUi {
  return ASSET_TYPE_UI[assetType] ?? DEFAULT_UI;
}
