"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { LoadingState } from "@/components/ui/loading";
import { resolveHomePath } from "@/lib/auth-routing";
import { userCanAccessInvestments } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";

export function InvestmentsGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !userCanAccessInvestments(user)) {
      router.replace(user ? resolveHomePath(user) : "/login");
    }
  }, [loading, user, router]);

  if (loading || !user || !userCanAccessInvestments(user)) {
    return <LoadingState label="Vérification des accès…" />;
  }

  return <>{children}</>;
}
