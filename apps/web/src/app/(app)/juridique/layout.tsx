import { RoleGuard } from "@/components/role-guard";
import { LaneSubnav } from "@/components/lane-subnav";

export default function JuridiqueLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard lane="juridique">
      <div>
        <h1 className="sf-display text-2xl font-semibold text-[var(--sf-green-deep)]">
          Juridique & conformité
        </h1>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Circuits dossier, demandes juridiques et dossiers en revue.
        </p>
        <LaneSubnav
          basePath="/juridique"
          items={[
            { href: "/juridique", label: "Tableau de bord" },
            { href: "/juridique/circuits", label: "Circuits" },
            { href: "/juridique/demandes", label: "Demandes" },
            { href: "/juridique/dossiers", label: "Dossiers en revue" },
          ]}
        />
        {children}
      </div>
    </RoleGuard>
  );
}
