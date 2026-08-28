import { apiRequest } from "@/lib/api";
import type {
  FinancialSummary,
  FiduciaryCaseListItem,
  PatrimonySummary,
  ReportSnapshot,
} from "@/types/api";

export type PortalKind = "portal" | "notaire" | "juge";

export type PortalCaseDetail = {
  id: number;
  reference: string;
  title: string;
  status: string;
  case_type?: string;
  case_type_label?: string;
  description: string;
  updated_at: string;
  patrimony_summary: {
    asset_count: number;
    total_estimated_value: string;
    currency: string;
  };
  patrimony_evolution?: { date: string; value: string; currency?: string }[];
  mandates?: {
    id: number;
    mandate_type: string;
    title: string;
    reference_number: string;
  }[];
  beneficiaries?: {
    id: number;
    first_name: string;
    last_name: string;
    is_minor: boolean;
  }[];
};

export type PortalDocument = {
  id: number;
  title: string;
  category: string;
  created_at: string;
  is_shared: boolean;
};

export type PortalReport = {
  id: number;
  title: string;
  report_type: string;
  report_type_label: string;
  status: string;
  approved_at: string | null;
  created_at: string;
  metadata_json?: ReportSnapshot | Record<string, unknown> | null;
};

function prefix(kind: PortalKind): string {
  if (kind === "portal") return "/portal";
  if (kind === "notaire") return "/notaire";
  return "/juge";
}

export function fetchPortalCases(kind: PortalKind) {
  return apiRequest<FiduciaryCaseListItem[]>(`${prefix(kind)}/cases/`);
}

export function fetchPortalCase(kind: PortalKind, caseId: string) {
  return apiRequest<PortalCaseDetail>(`${prefix(kind)}/cases/${caseId}/`);
}

export function fetchPortalDocuments(kind: PortalKind, caseId: string) {
  return apiRequest<PortalDocument[]>(
    `${prefix(kind)}/cases/${caseId}/documents/`,
  );
}

export function fetchPortalDocumentDownloadUrl(
  kind: PortalKind,
  documentId: number,
) {
  return apiRequest<{ url: string; expires_in: number; original_filename: string }>(
    `${prefix(kind)}/documents/${documentId}/download-url/`,
  );
}

export function fetchPortalReports(kind: PortalKind, caseId: string) {
  return apiRequest<PortalReport[]>(`${prefix(kind)}/cases/${caseId}/reports/`);
}

export function fetchPortalReportDownloadUrl(kind: PortalKind, reportId: number) {
  return apiRequest<{ url: string; expires_in: number; original_filename: string }>(
    `${prefix(kind)}/reports/${reportId}/download-url/`,
  );
}

export async function uploadPortalDocument(
  caseId: number,
  file: File,
  title: string,
  category: string,
) {
  const form = new FormData();
  form.append("case_id", String(caseId));
  form.append("title", title);
  form.append("category", category);
  form.append("file", file);
  return apiRequest<{ id: number; title: string }>("/portal/documents/upload/", {
    method: "POST",
    body: form,
  });
}

// Re-export for typing convenience (not used on external portals)
export type { PatrimonySummary, FinancialSummary };
