/** Profils d'affichage rapport selon le type de service (aligné API). */

export type ReportServiceSections = {
  finance?: boolean;
  patrimony?: boolean;
  investments?: boolean;
  people?: boolean;
  mandates?: boolean;
  waqf?: boolean;
  zakat?: boolean;
  faraid?: boolean;
  genealogy?: boolean;
  minors_focus?: boolean;
};

export type ReportServiceProfile = {
  code: string;
  report_name: string;
  subtitle: string;
  people_label: string;
  donor_label: string;
  mandate_label: string;
  sections: ReportServiceSections;
  kpis: string[];
};

const PROFILES: Record<string, ReportServiceProfile> = {
  MANDAT_FIDUCIAIRE: {
    code: "MANDAT_FIDUCIAIRE",
    report_name: "Rapport de gestion du mandat fiduciaire",
    subtitle:
      "Reddition de comptes : patrimoine confié, liquidités, investissements et bénéficiaires.",
    people_label: "Bénéficiaires",
    donor_label: "Donateurs / constituants",
    mandate_label: "Mandats",
    sections: {
      finance: true,
      patrimony: true,
      investments: true,
      people: true,
      mandates: true,
    },
    kpis: [
      "patrimony_total",
      "liquidities",
      "invested_amount",
      "annual_yield_percent",
    ],
  },
  TUTELLE_CANTONNEMENT: {
    code: "TUTELLE_CANTONNEMENT",
    report_name: "Rapport de tutelle / cantonnement",
    subtitle:
      "Suivi des biens cantonnés, protection des mineurs, placements et reddition.",
    people_label: "Protégés / bénéficiaires",
    donor_label: "Constituants",
    mandate_label: "Mandats de tutelle",
    sections: {
      finance: true,
      patrimony: true,
      investments: true,
      people: true,
      mandates: true,
      minors_focus: true,
    },
    kpis: ["patrimony_total", "liquidities", "invested_amount", "minors_count"],
  },
  SUCCESSION: {
    code: "SUCCESSION",
    report_name: "Rapport de conseil successoral",
    subtitle:
      "Évaluation du patrimoine successoral, arbres généalogiques, famille / héritiers et partage farāʾiḍ.",
    people_label: "Famille / héritiers",
    donor_label: "Défunt / de cujus",
    mandate_label: "Actes & mandats",
    sections: {
      finance: false,
      patrimony: true,
      investments: false,
      people: true,
      mandates: true,
      faraid: true,
      genealogy: true,
    },
    kpis: [
      "patrimony_total",
      "heirs_count",
      "faraid_share_total",
      "period_patrimony_net",
    ],
  },
  WAQF: {
    code: "WAQF",
    report_name: "Rapport de gestion du waqf",
    subtitle:
      "Objet du waqf, règles de répartition, patrimoine immobilisé et flux de la période.",
    people_label: "Bénéficiaires du waqf",
    donor_label: "Waqif / constituants",
    mandate_label: "Actes de waqf",
    sections: {
      finance: true,
      patrimony: true,
      investments: false,
      people: true,
      mandates: true,
      waqf: true,
    },
    kpis: [
      "patrimony_total",
      "liquidities",
      "period_net_flow",
      "beneficiaries_count",
    ],
  },
  ZAKAT_FARAID: {
    code: "ZAKAT_FARAID",
    report_name: "Rapport zakat & farāʾiḍ",
    subtitle:
      "Assiette zakatable, zakat due, et répartition farāʾiḍ des ayants droit.",
    people_label: "Ayants droit",
    donor_label: "Assujettis / constituants",
    mandate_label: "Mandats",
    sections: {
      finance: false,
      patrimony: true,
      investments: false,
      people: true,
      mandates: false,
      zakat: true,
      faraid: true,
    },
    kpis: ["zakatable_wealth", "zakat_due", "heirs_count", "patrimony_total"],
  },
};

const FALLBACK: ReportServiceProfile = {
  code: "",
  report_name: "Rapport de gestion",
  subtitle: "Synthèse du dossier pour la période.",
  people_label: "Bénéficiaires",
  donor_label: "Donateurs",
  mandate_label: "Mandats",
  sections: {
    finance: true,
    patrimony: true,
    people: true,
    mandates: true,
  },
  kpis: ["patrimony_total", "liquidities", "period_net_flow", "beneficiaries_count"],
};

export function getReportServiceProfile(
  caseType: string | undefined | null,
  fromSnapshot?: Partial<ReportServiceProfile> | null,
): ReportServiceProfile {
  if (fromSnapshot?.report_name && fromSnapshot?.sections) {
    return {
      ...FALLBACK,
      ...fromSnapshot,
      sections: { ...FALLBACK.sections, ...fromSnapshot.sections },
      kpis: fromSnapshot.kpis ?? FALLBACK.kpis,
    } as ReportServiceProfile;
  }
  if (caseType && PROFILES[caseType]) return PROFILES[caseType];
  return { ...FALLBACK, code: caseType || "" };
}

export const KPI_LABELS: Record<string, string> = {
  patrimony_total: "Patrimoine estimé",
  liquidities: "Liquidités",
  invested_amount: "Investi",
  annual_yield_percent: "Rendement annuel",
  period_net_flow: "Flux net période",
  period_patrimony_net: "Résultat patrimonial",
  minors_count: "Mineurs protégés",
  heirs_count: "Héritiers",
  beneficiaries_count: "Bénéficiaires",
  zakatable_wealth: "Assiette zakatable",
  zakat_due: "Zakat due",
  faraid_share_total: "Parts farāʾiḍ",
};
