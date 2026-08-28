/** Types de pièces d'identité du donateur — alignés sur l'API (PDF uniquement). */

export const DONOR_IDENTITY_KINDS = [
  { kind: "CNI", label: "Carte nationale d'identité" },
  { kind: "EN", label: "Extrait de naissance" },
  { kind: "PASSPORT", label: "Passeport" },
  { kind: "RESIDENCE", label: "Certificat de résidence" },
] as const;

export type DonorIdentityKind = (typeof DONOR_IDENTITY_KINDS)[number]["kind"];

export function normalizeNamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

/** Aperçu du nom de fichier PDF (ex. CNI_Amadou_DIOP.pdf). */
export function previewDonorIdentityFilename(
  kind: string,
  firstName: string,
  lastName: string,
): string {
  const k = normalizeNamePart(kind).toUpperCase() || "PIECE";
  const first =
    normalizeNamePart(firstName)
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("_") || "Donateur";
  const last = normalizeNamePart(lastName).toUpperCase() || "INCONNU";
  return `${k}_${first}_${last}.pdf`;
}
