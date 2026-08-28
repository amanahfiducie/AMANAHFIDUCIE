import { ExternalAuthGuard } from "@/components/external-auth-guard";
import { PortalShell } from "@/components/portal-shell";

export default function JudgePortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ExternalAuthGuard kind="juge">
      <PortalShell kind="juge">{children}</PortalShell>
    </ExternalAuthGuard>
  );
}
