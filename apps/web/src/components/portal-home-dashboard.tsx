"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { formatDate } from "@/lib/labels";
import type { PortalKind } from "@/lib/portal-api";
import {
  resolvePreferredCaseId,
  usePortalCases,
} from "@/providers/portal-cases-provider";

const COPY: Record<
  PortalKind,
  { badge: string; title: string; description: string }
> = {
  portal: {
    badge: "Espace famille / tuteur",
    title: "Tableau de bord",
    description:
      "Suivez vos dossiers fiduciaires, le patrimoine et les pièces partagées.",
  },
  notaire: {
    badge: "Espace notaire",
    title: "Tableau de bord",
    description:
      "Accédez aux dossiers rattachés, mandats et pièces notariales.",
  },
  juge: {
    badge: "Espace juridiction",
    title: "Tableau de bord",
    description: "Suivez les dossiers de votre périmètre.",
  },
};

/**
 * Accueil portail : ouvre le dossier préféré si unique / mémorisé,
 * sinon propose la sélection multi-dossiers.
 */
export function PortalHomeDashboard({ kind }: { kind: PortalKind }) {
  const router = useRouter();
  const { cases, loading, error, basePath, selectCase } = usePortalCases();
  const copy = COPY[kind];

  useEffect(() => {
    if (loading || error || cases.length === 0) return;
    if (cases.length === 1) {
      router.replace(`${basePath}/dossiers/${cases[0].id}`);
      return;
    }
    const preferred = resolvePreferredCaseId(kind, cases);
    if (preferred != null) {
      router.replace(`${basePath}/dossiers/${preferred}`);
    }
  }, [loading, error, cases, kind, basePath, router]);

  if (loading) return <LoadingState label="Chargement de vos dossiers…" />;
  if (error) return <ErrorAlert message={error} />;

  if (cases.length === 0) {
    return (
      <>
        <PageHeader
          badge={copy.badge}
          title={copy.title}
          description={copy.description}
        />
        <EmptyState
          title="Aucun dossier rattaché"
          description="Contactez AMANAH FIDUCIE si vous pensez qu'il s'agit d'une erreur."
        />
      </>
    );
  }

  const preferred =
    typeof window !== "undefined"
      ? resolvePreferredCaseId(kind, cases)
      : null;

  // Redirection en cours (1 dossier ou dernier mémorisé)
  if (cases.length === 1 || preferred != null) {
    return <LoadingState label="Ouverture de votre dossier…" />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        badge={copy.badge}
        title={copy.title}
        description="Vous êtes rattaché(e) à plusieurs dossiers. Choisissez celui à consulter — vous pourrez changer à tout moment via le sélecteur en haut."
      />

      <ul className="grid gap-3 sm:grid-cols-2">
        {cases.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => selectCase(c.id)}
              className="group block w-full text-left"
            >
              <Card className="h-full p-5 transition group-hover:border-[var(--sf-green)]/30 group-hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-[var(--sf-green)]/50">
                      {c.reference}
                    </p>
                    <p className="mt-1 font-medium text-[var(--sf-green-deep)] group-hover:text-[var(--sf-green-mid)]">
                      {c.title}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <p className="mt-3 text-xs text-[var(--sf-green)]/50">
                  Mis à jour {formatDate(c.updated_at)}
                </p>
                <p className="mt-3 text-sm font-medium text-[var(--sf-green-mid)]">
                  Ouvrir le tableau de bord →
                </p>
              </Card>
            </button>
          </li>
        ))}
      </ul>

      <p className="text-center text-sm text-[var(--sf-green)]/50">
        Ou consultez la{" "}
        <Link
          href={`${basePath}/dossiers`}
          className="font-medium text-[var(--sf-green-mid)] underline-offset-2 hover:underline"
        >
          liste complète
        </Link>
        .
      </p>
    </div>
  );
}
