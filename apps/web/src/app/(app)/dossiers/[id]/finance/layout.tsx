"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { FinanceSubNav } from "@/components/case/finance-sub-nav";
import { LoadingState } from "@/components/ui/loading";
import { caseSupportsFinance, caseSupportsInvestments } from "@/lib/investment-labels";
import { userCanViewCaseFinanceTab } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function CaseFinanceLayout({ children }: { children: React.ReactNode }) {
  const { caseId, data } = useCaseDetail();
  const { user, loading } = useAuth();
  const router = useRouter();
  const canView = userCanViewCaseFinanceTab(user);

  useEffect(() => {
    if (loading || !data) return;
    if (!canView) {
      router.replace(`/dossiers/${caseId}`);
    }
  }, [loading, data, canView, router, caseId]);

  if (loading || !user) {
    return <LoadingState label="Vérification des accès…" />;
  }

  if (!canView) {
    return (
      <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white px-5 py-10 text-center">
        <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
          Accès non autorisé
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--sf-green)]/60">
          La section Finance & investissements n&apos;est pas disponible pour votre
          rôle.
        </p>
        <Link
          href={`/dossiers/${caseId}`}
          className="mt-4 inline-block text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
        >
          ← Retour à la vue d&apos;ensemble
        </Link>
      </div>
    );
  }

  if (data && !caseSupportsFinance(data.case_type)) {
    return (
      <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white px-5 py-10 text-center">
        <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">
          Finance non applicable
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--sf-green)]/60">
          Le conseil successoral islamique ne comporte pas de volet fonds fiduciaires ni
          d&apos;investissements. Utilisez les onglets Famille, Patrimoine et Succession.
        </p>
        <Link
          href={`/dossiers/${caseId}`}
          className="mt-4 inline-block text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
        >
          ← Retour à la vue d&apos;ensemble
        </Link>
      </div>
    );
  }

  if (!data || !caseSupportsInvestments(data.case_type)) {
    return <>{children}</>;
  }

  return (
    <>
      <FinanceSubNav caseId={data.id} />
      {children}
    </>
  );
}
