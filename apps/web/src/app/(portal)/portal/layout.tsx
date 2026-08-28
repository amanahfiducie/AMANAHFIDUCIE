import { ExternalAuthGuard } from "@/components/external-auth-guard";
import { PortalShell } from "@/components/portal-shell";

export default function FamilyPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExternalAuthGuard kind="portal">
      <PortalShell kind="portal">{children}</PortalShell>
    </ExternalAuthGuard>
  );
}
