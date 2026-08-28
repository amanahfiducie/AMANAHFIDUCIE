"use client";

import Link from "next/link";

import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { CASE_TYPE_LABELS, formatDate } from "@/lib/labels";
import type { PortalKind } from "@/lib/portal-api";
import { usePortalCases } from "@/providers/portal-cases-provider";

export function ExternalCaseList({
  kind,
  basePath,
}: {
  kind: PortalKind;
  basePath: string;
}) {
  const { cases, loading, error, selectCase } = usePortalCases();

  if (loading) return <LoadingState label="Chargement…" />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <>
      <PageHeader
        title="Dossiers accessibles"
        description={
          cases.length > 1
            ? "Sélectionnez un dossier pour ouvrir son tableau de bord. Vous pouvez aussi changer via le sélecteur en haut de page."
            : "Seuls les dossiers auxquels vous êtes rattaché(e) sont visibles."
        }
      />
      {cases.length === 0 ? (
        <EmptyState
          title="Aucun dossier"
          description="Contactez votre interlocuteur AMANAH FIDUCIE si vous pensez qu'il s'agit d'une erreur."
        />
      ) : (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => selectCase(c.id)}
                className="group block w-full text-left"
              >
                <Card className="p-5 transition group-hover:border-[var(--sf-green)]/25 group-hover:shadow-md">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-sm text-[var(--sf-green)]/50">
                        {c.reference}
                      </p>
                      <p className="mt-1 font-medium text-[var(--sf-green-deep)] group-hover:text-[var(--sf-green-mid)]">
                        {c.title}
                      </p>
                      {c.case_type ? (
                        <p className="mt-1 text-xs font-medium text-[var(--sf-gold)]">
                          {CASE_TYPE_LABELS[c.case_type] || c.case_type}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="mt-3 text-xs text-[var(--sf-green)]/50">
                    Mis à jour {formatDate(c.updated_at)}
                  </p>
                  <p className="mt-2 text-sm font-medium text-[var(--sf-green-mid)]">
                    Ouvrir le tableau de bord →
                  </p>
                </Card>
              </button>
            </li>
          ))}
        </ul>
      )}
      {cases.length > 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--sf-green)]/45">
          Astuce : le sélecteur en haut permet de basculer rapidement entre vos
          dossiers.{" "}
          <Link href={basePath} className="underline-offset-2 hover:underline">
            Retour au tableau de bord
          </Link>
        </p>
      ) : null}
    </>
  );
}
