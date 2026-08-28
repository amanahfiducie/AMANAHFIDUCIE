import { RoleGuard } from "@/components/role-guard";
import { LaneSubnav } from "@/components/lane-subnav";

export default function DirectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard lane="direction">
      <div>
        <h1 className="sf-display text-2xl font-semibold text-[var(--sf-green-deep)]">
          Direction
        </h1>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Approbations sensibles et rapports de gestion.
        </p>
        <LaneSubnav
          basePath="/direction"
          items={[
            { href: "/direction/approvals", label: "Approbations" },
            { href: "/direction/reports", label: "Rapports" },
          ]}
        />
        {children}
      </div>
    </RoleGuard>
  );
}
