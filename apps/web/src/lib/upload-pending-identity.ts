import { uploadCaseDocument } from "@/lib/case-onboarding";
import type { IdentitySubject, PersonIdentityKind } from "@/lib/person-identity-documents";

export type PendingIdentityFiles = Partial<Record<PersonIdentityKind, File>>;

export async function uploadPendingIdentityDocuments(
  caseId: number,
  subject: IdentitySubject,
  entityId: number,
  firstName: string,
  lastName: string,
  pending: PendingIdentityFiles,
): Promise<void> {
  const entries = Object.entries(pending) as [PersonIdentityKind, File][];
  for (const [kind, file] of entries) {
    if (!file) continue;
    const base = { identityKind: kind, category: "IDENTITY" as const };
    if (subject === "beneficiary") {
      await uploadCaseDocument(caseId, file, {
        ...base,
        beneficiaryId: entityId,
        beneficiaryFirstName: firstName.trim(),
        beneficiaryLastName: lastName.trim(),
      });
    } else if (subject === "guardian") {
      await uploadCaseDocument(caseId, file, {
        ...base,
        guardianId: entityId,
        guardianFirstName: firstName.trim(),
        guardianLastName: lastName.trim(),
      });
    }
  }
}
