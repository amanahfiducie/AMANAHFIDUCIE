import { RoleGuard } from "@/components/role-guard";
import { LaneSubnav } from "@/components/lane-subnav";

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard lane="audit">
      <div>
        <h1 className="sf-display text-2xl font-semibold text-[var(--sf-green-deep)]">
          Audit & traçabilité
        </h1>
        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
          Journal des actions, conformité et exports.
        </p>
        <LaneSubnav
          basePath="/audit"
          items={[
            { href: "/audit", label: "Vue d'ensemble" },
            { href: "/audit/logs", label: "Journal" },
          ]}
        />
        {children}
      </div>
    </RoleGuard>
  );
}
