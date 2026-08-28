"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/loading";
import { resolveHomePath } from "@/lib/auth-routing";
import { userCanAccessLane, type InternalLane } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";

export function RoleGuard({
  lane,
  children,
}: {
  lane: InternalLane;
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !userCanAccessLane(user, lane)) {
      router.replace(user ? resolveHomePath(user) : "/login");
    }
  }, [loading, user, lane, router]);

  if (loading || !user || !userCanAccessLane(user, lane)) {
    return <LoadingState label="Vérification des accès…" />;
  }

  return <>{children}</>;
}
