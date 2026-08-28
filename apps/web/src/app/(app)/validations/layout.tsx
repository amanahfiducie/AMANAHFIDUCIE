"use client";

import { RoleGuard } from "@/components/role-guard";
import { LaneSubnav } from "@/components/lane-subnav";

export default function ValidationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RoleGuard lane="direction">
      <div>
        <h1 className="sf-display text-2xl font-semibold text-[var(--sf-green-deep)]">
          Validations
        </h1>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Circuits dossier, demandes métier, observations et remarques à trancher.
        </p>
        <LaneSubnav
          basePath="/validations"
          items={[
            { href: "/validations", label: "Tableau de bord" },
            { href: "/validations/dossiers", label: "Dossiers" },
            { href: "/validations/demandes", label: "Demandes" },
            { href: "/validations/observations", label: "Observations" },
          ]}
        />
        {children}
      </div>
    </RoleGuard>
  );
}
