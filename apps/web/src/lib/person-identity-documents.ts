/** Pièces d'identité — types alignés sur l'API (PDF uniquement). */

export const PERSON_IDENTITY_KINDS = [
  { kind: "CNI", label: "Carte nationale d'identité", shortLabel: "CNI" },
  { kind: "EN", label: "Extrait de naissance", shortLabel: "Extrait naiss." },
  { kind: "PASSPORT", label: "Passeport", shortLabel: "Passeport" },
  { kind: "RESIDENCE", label: "Certificat de résidence", shortLabel: "Certif. résid." },
] as const;

export type PersonIdentityKind = (typeof PERSON_IDENTITY_KINDS)[number]["kind"];

export type IdentitySubject = "donor" | "beneficiary" | "guardian";

export function normalizeNamePart(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function nameParts(firstName: string, lastName: string, defaultFirst: string) {
  const first =
    normalizeNamePart(firstName)
      .split("_")
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join("_") || defaultFirst;
  const last = normalizeNamePart(lastName).toUpperCase() || "INCONNU";
  return { first, last };
}

/** Aperçu du nom de fichier PDF selon le rôle (donateur, héritier, tuteur). */
export function previewIdentityFilename(
  subject: IdentitySubject,
  kind: string,
  firstName: string,
  lastName: string,
): string {
  const k = normalizeNamePart(kind).toUpperCase() || "PIECE";
  const { first, last } = nameParts(
    firstName,
    lastName,
    subject === "guardian" ? "Tuteur" : subject === "beneficiary" ? "Beneficiaire" : "Donateur",
  );
  if (subject === "beneficiary") return `${k}_BEN_${first}_${last}.pdf`;
  if (subject === "guardian") return `${k}_TUT_${first}_${last}.pdf`;
  return `${k}_${first}_${last}.pdf`;
}
