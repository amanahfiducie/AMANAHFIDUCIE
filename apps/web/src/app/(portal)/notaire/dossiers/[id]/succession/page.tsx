"use client";

import Link from "next/link";

import { PortalCaseTypePlaceholder } from "@/components/portal-case-pages";
import { useCaseDetail } from "@/providers/case-detail-provider";

export default function Page() {
  const { navBase } = useCaseDetail();
  return (
    <div className="space-y-4">
      <PortalCaseTypePlaceholder
        title="Succession"
        description="Consultez la famille, l’arbre et le patrimoine. Les actions de partage farāʾiḍ restent réservées à l’équipe interne."
      />
      <Link
        href={`${navBase}/beneficiaires/informations`}
        className="sf-btn-secondary inline-flex text-sm"
      >
        Voir la famille →
      </Link>
    </div>
  );
}
