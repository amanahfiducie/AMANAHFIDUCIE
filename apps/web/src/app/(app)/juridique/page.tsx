"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import { VALIDATION_TYPE_LABELS } from "@/lib/validation-labels";
import { useAuth } from "@/providers/auth-provider";
import type { FiduciaryCaseListItem, ValidationRequest } from "@/types/api";

type DashState = {
  circuits: ValidationRequest[];
  demandes: ValidationRequest[];
  dossiersReview: number;
  loading: boolean;
  error: string | null;
};

const REVIEW_STATUSES = new Set([
  "UNDER_REVIEW",
  "LEGAL_REVIEW",
  "COMPLIANCE_REVIEW",
]);

export default function JuridiqueHomePage() {
  const { user } = useAuth();
  const displayName = useMemo(() => {
    const first = user?.first_name?.trim();
    const last = user?.last_name?.trim();
    if (first || last) return [first, last].filter(Boolean).join(" ");
    return user?.username ?? "Juridique";
  }, [user]);

  const [state, setState] = useState<DashState>({
    circuits: [],
    demandes: [],
    dossiersReview: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dossiers, queue, cases] = await Promise.all([
          apiRequest<ValidationRequest[]>(
            "/validations/inbox/?scope=DOSSIERS&actionable=1",
          ),
          apiRequest<ValidationRequest[]>("/validations/my-queue/"),
          apiRequest<FiduciaryCaseListItem[]>(
            "/cases/?status=UNDER_REVIEW,LEGAL_REVIEW,COMPLIANCE_REVIEW",
          ),
        ]);
        if (cancelled) return;
        const demandes = queue.filter((v) => v.validation_type === "LEGAL");
        const circuits = dossiers.filter(
          (v) =>
            v.can_decide
            || v.current_step?.assigned_role === "JURIDIQUE_CONFORMITE",
        );
        setState({
          circuits,
          demandes,
          dossiersReview: cases.filter((c) => REVIEW_STATUSES.has(c.status)).length,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setState((prev) => ({
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

  const pendingTotal = state.circuits.length + state.demandes.length;

  const cards = [
    {
      href: "/juridique/circuits",
      label: "Circuits dossiers",
      hint: "Votre étape juridique",
      value: state.circuits.length,
    },
    {
      href: "/juridique/demandes",
      label: "Demandes LEGAL",
      hint: "Avis juridiques à émettre",
      value: state.demandes.length,
    },
    {
      href: "/juridique/dossiers",
      label: "Dossiers en revue",
      hint: "UNDER_REVIEW / LEGAL / COMPLIANCE",
      value: state.dossiersReview,
    },
    {
      href: "/dossiers",
      label: "Tous les dossiers",
      hint: "Parcourir le portefeuille",
      value: "→",
    },
  ];

  const previewCircuits = state.circuits.slice(0, 4);
  const previewDemandes = state.demandes.slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
          Bonjour{displayName ? `, ${displayName}` : ""}
        </h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/55">
          Espace juridique & conformité — uniquement les dossiers et décisions qui
          vous concernent.
          {!state.loading ? (
            <>
              {" "}
              <span className="font-medium text-[var(--sf-green-deep)]">
                {pendingTotal} élément{pendingTotal > 1 ? "s" : ""} en attente
              </span>
              .
            </>
          ) : null}
        </p>
      </div>

      {state.loading ? <LoadingState label="Chargement…" /> : null}
      {state.error ? <ErrorAlert message={state.error} /> : null}

      {!state.loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      {!state.loading && !state.error ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                À traiter — circuits
              </h3>
              <Link
                href="/juridique/circuits"
                className="text-xs font-medium text-[var(--sf-green)] hover:underline"
              >
                Tout voir →
              </Link>
            </div>
            {previewCircuits.length === 0 ? (
              <p className="text-sm text-[var(--sf-green)]/45">
                Aucun circuit en attente de votre avis.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--sf-cream-dark)]">
                {previewCircuits.map((item) => (
                  <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`/dossiers/${item.case}/validations`}
                      className="block hover:opacity-80"
                    >
                      <p className="truncate text-sm font-medium text-[var(--sf-green-deep)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                        {item.case_reference}
                        {item.current_step?.step_label
                          ? ` · ${item.current_step.step_label}`
                          : ""}
                        {" · "}
                        {formatDate(item.created_at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                À traiter — demandes LEGAL
              </h3>
              <Link
                href="/juridique/demandes"
                className="text-xs font-medium text-[var(--sf-green)] hover:underline"
              >
                Tout voir →
              </Link>
            </div>
            {previewDemandes.length === 0 ? (
              <p className="text-sm text-[var(--sf-green)]/45">
                Aucune demande juridique en attente.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--sf-cream-dark)]">
                {previewDemandes.map((item) => (
                  <li key={item.id} className="py-2.5 first:pt-0 last:pb-0">
                    <Link
                      href={`/dossiers/${item.case}/validations`}
                      className="block hover:opacity-80"
                    >
                      <p className="truncate text-sm font-medium text-[var(--sf-green-deep)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                        {item.case_reference} ·{" "}
                        {VALIDATION_TYPE_LABELS[item.validation_type] ??
                          item.validation_type}{" "}
                        · {formatDate(item.created_at)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
