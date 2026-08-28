"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/loading";
import { resolveHomePath, userCanAccessPortal } from "@/lib/auth-routing";
import { useAuth } from "@/providers/auth-provider";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    if (!userCanAccessPortal(user, "internal")) {
      router.replace(resolveHomePath(user));
    }
  }, [loading, user, router, pathname]);

  if (loading) {
    return <LoadingState label="Chargement de la session…" fullScreen />;
  }

  if (!user || !userCanAccessPortal(user, "internal")) {
    return <LoadingState label="Redirection…" fullScreen />;
  }

  return <>{children}</>;
}
