import { RoleGuard } from "@/components/role-guard";
import { LaneSubnav } from "@/components/lane-subnav";

export default function ChariaLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard lane="charia">
      <div>
        <h1 className="sf-display text-2xl font-semibold text-[var(--sf-green-deep)]">
          Comité charaïque
        </h1>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Circuits dossier, avis charaïques, observations et partages farāʾiḍ.
        </p>
        <LaneSubnav
          basePath="/charia"
          items={[
            { href: "/charia", label: "Tableau de bord" },
            { href: "/charia/circuits", label: "Circuits" },
            { href: "/charia/demandes", label: "Demandes" },
            { href: "/charia/observations", label: "Observations" },
            { href: "/charia/partages", label: "Partages farāʾiḍ" },
          ]}
        />
        {children}
      </div>
    </RoleGuard>
  );
}
