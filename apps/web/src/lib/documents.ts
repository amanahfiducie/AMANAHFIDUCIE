import { apiRequest } from "@/lib/api";

type DownloadUrlResponse = {
  url: string;
  expires_in: number;
  version_id: number;
  original_filename: string;
};

export async function getDocumentDownloadUrl(
  documentId: number,
): Promise<DownloadUrlResponse> {
  return apiRequest<DownloadUrlResponse>(`/documents/${documentId}/download-url/`);
}

/** URL pour aperçu inline (PDF dans une modale, sans téléchargement forcé). */
export async function getDocumentPreviewUrl(
  documentId: number,
): Promise<DownloadUrlResponse> {
  return apiRequest<DownloadUrlResponse>(`/documents/${documentId}/preview-url/`);
}

/** @deprecated Utiliser DocumentPreviewModal pour un aperçu sans téléchargement. */
export async function viewDocument(documentId: number): Promise<void> {
  const { url } = await getDocumentDownloadUrl(documentId);
  window.open(url, "_blank", "noopener,noreferrer");
}
