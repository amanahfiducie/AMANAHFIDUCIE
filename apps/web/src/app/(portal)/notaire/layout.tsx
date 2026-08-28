import { ExternalAuthGuard } from "@/components/external-auth-guard";
import { PortalShell } from "@/components/portal-shell";

export default function NotaryPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExternalAuthGuard kind="notaire">
      <PortalShell kind="notaire">{children}</PortalShell>
    </ExternalAuthGuard>
  );
}
