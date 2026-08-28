import { LaneSubnav } from "@/components/lane-subnav";
import { RoleGuard } from "@/components/role-guard";

export default function ComptableLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard lane="comptable">
      <div>
        <h1 className="sf-display text-2xl font-semibold text-[var(--sf-green-deep)]">
          Comptabilité SOFIGEPAM
        </h1>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Recettes et dépenses par catégorie. Les fonds fiduciaires par dossier restent dans
          l&apos;onglet dédié.
        </p>
        <LaneSubnav
          basePath="/comptable"
          items={[
            { href: "/comptable", label: "Vue d'ensemble" },
            { href: "/comptable/recettes", label: "Recettes" },
            { href: "/comptable/depenses", label: "Dépenses" },
            { href: "/comptable/mouvements", label: "Journal" },
            { href: "/comptable/fiduciaire", label: "Fonds fiduciaires" },
          ]}
        />
        {children}
      </div>
    </RoleGuard>
  );
}
