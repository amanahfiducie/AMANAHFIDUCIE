import { normalizeNamePart } from "@/lib/person-identity-documents";

/** Aperçu du nom de fichier PDF pour un acte de mandat. */
export function previewMandateFilename(
  mandateType: string,
  title: string,
  referenceNumber: string,
): string {
  const typeSlug = normalizeNamePart(mandateType).toUpperCase() || "MANDAT";
  const titleSlug =
    normalizeNamePart(title)
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("_") || "Sans_Titre";
  const refSlug = normalizeNamePart(referenceNumber).toUpperCase() || "SANS_REF";
  return `MANDAT_${typeSlug}_${titleSlug}_${refSlug}.pdf`;
}
