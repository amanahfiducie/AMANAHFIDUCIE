"use client";

import {
  userCanActOnValidationStep,
  userCanAddCaseRemark,
  userCanApproveReports,
  userCanCreateCase,
  userCanCreateValidation,
  userCanDecideValidationType,
  userCanGenerateReports,
  userCanManageEnterpriseFinance,
  userCanManageUsers,
  userCanReviewCaseObservation,
  userCanReviewFaraid,
  userCanSubmitCaseObservation,
  userCanValidateMandate,
  userCanWriteCase,
  userIsCaseReadOnly,
  userIsComiteCharaique,
} from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";

/** Permissions plateforme dérivées du profil connecté. */
export function usePlatformPermissions() {
  const { user } = useAuth();

  return {
    user,
    canManageUsers: userCanManageUsers(user),
    canCreateCase: userCanCreateCase(user),
    canWriteCase: userCanWriteCase(user),
    isCaseReadOnly: userIsCaseReadOnly(user),
    canValidateMandate: userCanValidateMandate(user),
    canCreateValidation: userCanCreateValidation(user),
    canDecideValidationType: (validationType: string | undefined) =>
      userCanDecideValidationType(user, validationType),
    canActOnValidationStep: (
      validationType: string | undefined,
      assignedRole: string | undefined,
      options?: { caseAssignedTo?: number | null },
    ) => userCanActOnValidationStep(user, validationType, assignedRole, options),
    canReviewFaraid: userCanReviewFaraid(user),
    isComiteCharaique: userIsComiteCharaique(user),
    canGenerateReports: userCanGenerateReports(user),
    canApproveReports: userCanApproveReports(user),
    canManageEnterpriseFinance: userCanManageEnterpriseFinance(user),
    canSubmitCaseObservation: userCanSubmitCaseObservation(user),
    canReviewCaseObservation: userCanReviewCaseObservation(user),
    canAddCaseRemark: userCanAddCaseRemark(user),
  };
}
