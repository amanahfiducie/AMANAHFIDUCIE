"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { resolveHomePath } from "@/lib/auth-routing";
import { useAuth } from "@/providers/auth-provider";

type Props = {
  /** Retourne true si l'utilisateur peut accéder à la page. */
  canAccess: boolean;
  /** Redirection automatique si accès refusé (défaut : true). */
  redirect?: boolean;
  backHref?: string;
  backLabel?: string;
  message?: string;
  children: React.ReactNode;
};

export function CaseAccessGuard({
  canAccess,
  redirect = true,
  backHref,
  backLabel = "← Retour",
  message = "Vous n'avez pas les droits d'écriture pour cette action.",
  children,
}: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !redirect || canAccess) return;
    const target = backHref ?? (user ? resolveHomePath(user) : "/login");
    router.replace(target);
  }, [loading, redirect, canAccess, backHref, user, router]);

  if (loading) {
    return <LoadingState label="Vérification des accès…" />;
  }

  if (!canAccess) {
    if (redirect) {
      return <LoadingState label="Redirection…" />;
    }
    return (
      <div className="space-y-3">
        <ErrorAlert message={message} />
        {backHref ? (
          <Link
            href={backHref}
            className="inline-block text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            {backLabel}
          </Link>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
