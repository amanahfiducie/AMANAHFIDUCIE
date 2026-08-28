"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/loading";
import {
  portalKindForPath,
  resolveHomePath,
  userCanAccessPortal,
  type PortalKind,
} from "@/lib/auth-routing";
import { useAuth } from "@/providers/auth-provider";

export function ExternalAuthGuard({
  kind,
  children,
}: {
  kind: PortalKind;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!userCanAccessPortal(user, kind)) {
      router.replace(resolveHomePath(user));
    }
  }, [loading, user, kind, router, pathname]);

  if (loading || !user) {
    return <LoadingState label="Vérification d'accès…" fullScreen />;
  }

  if (!userCanAccessPortal(user, kind)) {
    return <LoadingState label="Redirection…" fullScreen />;
  }

  return <>{children}</>;
}

export function useExternalPortalKind(): PortalKind | null {
  const pathname = usePathname();
  return portalKindForPath(pathname);
}
