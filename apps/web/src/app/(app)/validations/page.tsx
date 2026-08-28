"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { PendingReportsPanel } from "@/components/pending-reports-panel";
import { ApiError, apiRequest } from "@/lib/api";
import { userCanApproveReports } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { CaseObservation, ValidationRequest } from "@/types/api";

type DashCounts = {
  dossiersPending: number;
  demandesPending: number;
  observationsPending: number;
  loading: boolean;
  error: string | null;
};

export default function ValidationsDashboardPage() {
  const { user } = useAuth();
  const showReports = userCanApproveReports(user);
  const [counts, setCounts] = useState<DashCounts>({
    dossiersPending: 0,
    demandesPending: 0,
    observationsPending: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dossiers, demandes, observations] = await Promise.all([
          apiRequest<ValidationRequest[]>(
            "/validations/inbox/?scope=DOSSIERS&actionable=1",
          ),
          apiRequest<ValidationRequest[]>(
            "/validations/inbox/?scope=DEMANDES&actionable=1",
          ),
          apiRequest<CaseObservation[]>(
            "/observations/review-queue/?actionable=1",
          ),
        ]);
        if (cancelled) return;
        setCounts({
          dossiersPending: dossiers.length,
          demandesPending: demandes.length,
          observationsPending: observations.length,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setCounts((prev) => ({
          ...prev,
          loading: false,
          error:
            err instanceof ApiError
              ? err.message
              : "Impossible de charger le tableau de bord.",
        }));
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    {
      href: "/validations/dossiers",
      label: "Dossiers",
      hint: "Circuits à valider / rejeter",
      value: counts.dossiersPending,
    },
    {
      href: "/validations/demandes",
      label: "Demandes",
      hint: "Validations métier en attente",
      value: counts.demandesPending,
    },
    {
      href: "/validations/observations",
      label: "Observations",
      hint: "Observations & remarques",
      value: counts.observationsPending,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
          Tableau de bord
        </h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/55">
          Vue d&apos;ensemble de ce qui attend votre décision.
        </p>
      </div>

      {counts.loading ? <LoadingState /> : null}
      {counts.error ? <ErrorAlert message={counts.error} /> : null}

      {!counts.loading ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm transition hover:border-[var(--sf-green-mid)]/30 hover:shadow-md"
            >
              <p className="text-3xl font-semibold tabular-nums text-[var(--sf-green-deep)]">
                {card.value}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--sf-green-deep)]">
                {card.label}
              </p>
              <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">{card.hint}</p>
            </Link>
          ))}
        </div>
      ) : null}

      {showReports ? (
        <section>
          <h3 className="mb-4 text-base font-semibold text-[var(--sf-green-deep)]">
            Rapports à approuver
          </h3>
          <PendingReportsPanel />
        </section>
      ) : null}
    </div>
  );
}
