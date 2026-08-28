/** Présentation portail client selon le type de service du dossier. */

import { getReportServiceProfile } from "@/lib/report-service-profiles";
import { CASE_TYPE_LABELS } from "@/lib/labels";

export type PortalServiceProfile = {
  code: string;
  serviceLabel: string;
  /** Accroche courte sous le titre */
  claim: string;
  /** Ce que le client suit dans cet espace */
  focusPoints: string[];
  peopleLabel: string;
  mandateLabel: string;
  patrimonyLabel: string;
  patrimonyHint: string;
  reportsLabel: string;
  documentsLabel: string;
  showPatrimonyChart: boolean;
  showPeople: boolean;
  showMandates: boolean;
  highlightMinors: boolean;
};

const PORTAL_COPY: Record<
  string,
  Omit<PortalServiceProfile, "code" | "serviceLabel" | "peopleLabel" | "mandateLabel">
> = {
  MANDAT_FIDUCIAIRE: {
    claim:
      "Suivez en toute transparence la gestion fiduciaire de votre patrimoine confié.",
    focusPoints: [
      "Valorisation et évolution du patrimoine confié",
      "Rapports de reddition de comptes publiés",
      "Pièces et échanges partagés avec vous",
    ],
    patrimonyLabel: "Patrimoine confié",
    patrimonyHint: "Estimation consolidée des actifs du mandat",
    reportsLabel: "Rapports de gestion",
    documentsLabel: "Documents du mandat",
    showPatrimonyChart: true,
    showPeople: true,
    showMandates: true,
    highlightMinors: false,
  },
  TUTELLE_CANTONNEMENT: {
    claim:
      "Protection des personnes vulnérables et suivi rigoureux des biens cantonnés.",
    focusPoints: [
      "Biens cantonnés et leur évolution",
      "Protection des mineurs et protégés",
      "Rapports de tutelle et pièces officielles",
    ],
    patrimonyLabel: "Biens cantonnés",
    patrimonyHint: "Valeur estimée des actifs sous cantonnement",
    reportsLabel: "Rapports de tutelle",
    documentsLabel: "Pièces de tutelle",
    showPatrimonyChart: true,
    showPeople: true,
    showMandates: true,
    highlightMinors: true,
  },
  SUCCESSION: {
    claim:
      "Vue claire du patrimoine successoral, de la famille et des étapes du conseil.",
    focusPoints: [
      "Estimation du patrimoine successoral",
      "Famille et héritiers concernés",
      "Rapports et documents de conseil",
    ],
    patrimonyLabel: "Patrimoine successoral",
    patrimonyHint: "Évaluation des biens de la succession",
    reportsLabel: "Rapports successoraux",
    documentsLabel: "Documents successoraux",
    showPatrimonyChart: true,
    showPeople: true,
    showMandates: true,
    highlightMinors: false,
  },
  WAQF: {
    claim:
      "Suivi du waqf : patrimoine immobilisé, objet et transparence des flux.",
    focusPoints: [
      "Patrimoine du waqf et son évolution",
      "Bénéficiaires et règles de répartition",
      "Rapports de gestion du waqf",
    ],
    patrimonyLabel: "Patrimoine du waqf",
    patrimonyHint: "Actifs immobilisés au profit du waqf",
    reportsLabel: "Rapports de waqf",
    documentsLabel: "Actes & pièces du waqf",
    showPatrimonyChart: true,
    showPeople: true,
    showMandates: true,
    highlightMinors: false,
  },
  ZAKAT_FARAID: {
    claim:
      "Assiette zakatable, obligations et répartition farāʾiḍ en un seul espace.",
    focusPoints: [
      "Patrimoine pris en compte pour la zakat",
      "Ayants droit et parts farāʾiḍ",
      "Rapports et justificatifs partagés",
    ],
    patrimonyLabel: "Assiette patrimoniale",
    patrimonyHint: "Base retenue pour l’évaluation zakat / farāʾiḍ",
    reportsLabel: "Rapports zakat & farāʾiḍ",
    documentsLabel: "Documents partagés",
    showPatrimonyChart: true,
    showPeople: true,
    showMandates: false,
    highlightMinors: false,
  },
};

const FALLBACK_COPY = {
  claim: "Consultez le suivi de votre dossier fiduciaire en toute confiance.",
  focusPoints: [
    "Indicateurs de votre dossier",
    "Rapports publiés à votre attention",
    "Documents partagés de façon sécurisée",
  ],
  patrimonyLabel: "Patrimoine estimé",
  patrimonyHint: "Estimation consolidée des actifs",
  reportsLabel: "Rapports publiés",
  documentsLabel: "Documents accessibles",
  showPatrimonyChart: true,
  showPeople: true,
  showMandates: true,
  highlightMinors: false,
};

export function getPortalServiceProfile(
  caseType: string | undefined | null,
): PortalServiceProfile {
  const report = getReportServiceProfile(caseType);
  const code = (caseType || report.code || "").toUpperCase();
  const copy = PORTAL_COPY[code] ?? FALLBACK_COPY;
  return {
    code,
    serviceLabel: CASE_TYPE_LABELS[code] || report.report_name.replace(/^Rapport (de |du )?/, "") || "Dossier fiduciaire",
    peopleLabel: report.people_label,
    mandateLabel: report.mandate_label,
    ...copy,
    showPeople: copy.showPeople && Boolean(report.sections.people),
    showMandates: copy.showMandates && Boolean(report.sections.mandates),
    showPatrimonyChart:
      copy.showPatrimonyChart && report.sections.patrimony !== false,
    highlightMinors: copy.highlightMinors && Boolean(report.sections.minors_focus),
  };
}
