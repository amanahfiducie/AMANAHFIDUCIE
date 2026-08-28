"use client";

import { use } from "react";

import { CaseAccessGuard } from "@/components/access/case-access-guard";
import { SuccessionEditBanner } from "@/components/succession/succession-edit-banner";
import { SuccessionWorkspace } from "@/components/succession/succession-workspace";
import { usePlatformPermissions } from "@/hooks/use-platform-permissions";

export default function CaseSuccessionModifierPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isComiteCharaique } = usePlatformPermissions();

  return (
    <CaseAccessGuard
      canAccess={isComiteCharaique}
      backHref={`/dossiers/${id}/succession/synthese`}
      backLabel="← Retour à la synthèse"
      message="La modification de la succession est réservée au comité charaïque."
    >
      <SuccessionEditBanner caseId={id} />
      <SuccessionWorkspace caseId={id} />
    </CaseAccessGuard>
  );
}
