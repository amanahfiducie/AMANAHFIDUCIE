"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

import { useCaseDetail } from "@/providers/case-detail-provider";
import { useAuth } from "@/providers/auth-provider";
import { caseSupportsFinance } from "@/lib/investment-labels";
import {
  userCanViewCaseFinanceTab,
  userIsComiteCharaique,
} from "@/lib/role-access";

type CaseTab = { slug: string; label: string };

/**
 * Ordre métier :
 * 1. Orientation → 2. Cadre & personnes → 3. Spécifique type
 * → 4. Patrimoine & finance → 5. Contrôles → 6. Sorties & traçabilité
 */
export function CaseTabs({ caseId }: { caseId: string }) {
  const pathname = usePathname();
  const { data } = useCaseDetail();
  const { user } = useAuth();
  const base = `/dossiers/${caseId}`;
  const caseType = data?.case_type;
  const showSuccessionTab =
    caseType === "SUCCESSION" && userIsComiteCharaique(user);
  const showFinanceTab =
    userCanViewCaseFinanceTab(user) && caseSupportsFinance(caseType);

  const tabs = useMemo(() => {
    const list: CaseTab[] = [
      { slug: "", label: "Vue d'ensemble" },
      { slug: "mandat", label: "Mandat" },
      {
        slug: "beneficiaires",
        label: caseType === "SUCCESSION" ? "Famille" : "Bénéficiaires",
      },
    ];

    // Onglets spécifiques au type, juste après les personnes
    if (showSuccessionTab) {
      list.push({ slug: "succession", label: "Succession" });
    }
    if (caseType === "WAQF") {
      list.push({ slug: "waqf", label: "Waqf" });
    }
    if (caseType === "ZAKAT_FARAID") {
      list.push({ slug: "zakat", label: "Zakat" });
      list.push({ slug: "faraid", label: "Farāʾiḍ" });
    }

    list.push({ slug: "patrimoine", label: "Patrimoine" });

    if (showFinanceTab) {
      list.push({ slug: "finance", label: "Finance & investissements" });
    }

    list.push(
      { slug: "validations", label: "Validations" },
      { slug: "observations", label: "Observations" },
      { slug: "rapports", label: "Rapports" },
      { slug: "timeline", label: "Timeline" },
      { slug: "audit", label: "Audit" },
    );

    return list;
  }, [caseType, showSuccessionTab, showFinanceTab, user]);

  return (
    <nav
      className="mb-6 border-b-2 border-[var(--sf-green)]"
      aria-label="Onglets du dossier"
    >
      <div className="flex flex-wrap justify-center gap-0 overflow-x-auto">
        {tabs.map((tab) => {
          const href =
            tab.slug === "beneficiaires" && caseType === "SUCCESSION"
              ? `${base}/beneficiaires/informations`
              : tab.slug === "succession" && caseType === "SUCCESSION"
                ? `${base}/succession/synthese`
                : tab.slug === "observations"
                  ? `${base}/observations/partagees`
                  : tab.slug
                    ? `${base}/${tab.slug}`
                    : base;
          const active =
            tab.slug === ""
              ? pathname === base
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={tab.slug || "overview"}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`relative shrink-0 border-b-2 -mb-[2px] px-4 py-2.5 text-sm font-medium transition ${
                active
                  ? "rounded-t-lg border-[var(--sf-green)] bg-[var(--sf-green)] text-[var(--sf-gold)] font-semibold"
                  : "rounded-t-md border-transparent text-[var(--sf-green)]/55 hover:border-[var(--sf-green)]/25 hover:bg-[var(--sf-cream)]/25 hover:text-[var(--sf-green-deep)]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
