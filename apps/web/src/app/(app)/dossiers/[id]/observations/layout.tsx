"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { ObservationsSubNav } from "@/components/case/observations-sub-nav";
import { userCanViewCaseRemarksSubmenu } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function ObservationsLayout({ children }: { children: React.ReactNode }) {
  const { data } = useCaseDetail();
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isRemarksRoute = pathname.includes("/observations/remarques");
  const canViewRemarks = userCanViewCaseRemarksSubmenu(user);

  useEffect(() => {
    if (!data?.id || !isRemarksRoute || canViewRemarks) return;
    router.replace(`/dossiers/${data.id}/observations/partagees`);
  }, [data?.id, isRemarksRoute, canViewRemarks, router]);

  if (!data) return <>{children}</>;

  if (isRemarksRoute && !canViewRemarks) {
    return (
      <>
        <ObservationsSubNav caseId={data.id} />
      </>
    );
  }

  return (
    <>
      <ObservationsSubNav caseId={data.id} />
      {children}
    </>
  );
}
