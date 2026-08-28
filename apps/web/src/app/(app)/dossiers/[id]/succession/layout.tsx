"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SuccessionSubNav } from "@/components/succession/succession-sub-nav";
import { ErrorAlert } from "@/components/ui/error-alert";
import { userIsComiteCharaique } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function SuccessionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useCaseDetail();
  const { user } = useAuth();
  const isEditMode = pathname.includes("/succession/modifier");

  if (!data || data.case_type !== "SUCCESSION") {
    return <>{children}</>;
  }

  if (!userIsComiteCharaique(user)) {
    return (
      <div className="space-y-3">
        <ErrorAlert message="L'onglet Succession est réservé aux membres du comité charaïque." />
        <Link
          href={`/dossiers/${data.id}`}
          className="inline-block text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
        >
          ← Retour au dossier
        </Link>
      </div>
    );
  }

  if (isEditMode) {
    return <>{children}</>;
  }

  return (
    <>
      <SuccessionSubNav caseId={data.id} />
      {children}
    </>
  );
}
