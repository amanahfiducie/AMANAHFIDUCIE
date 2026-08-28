"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { ApiError, listServiceOffers } from "@/lib/api";
import type { ServiceOfferListItem } from "@/types/api";

export function ServicesCatalogPage() {
  const [items, setItems] = useState<ServiceOfferListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await listServiceOffers();
        if (!cancelled) setItems(data);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Impossible de charger le catalogue des services.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <LoadingState label="Chargement des services…" />;
  if (error) return <ErrorAlert message={error} />;

  return (
    <>
      <PageHeader
        badge="Catalogue"
        title="Services"
        description="Paramétrez chaque offre métier et ses règles de facturation (business plan §5.2)."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Aucun service"
          description="Le catalogue n'a pas encore été initialisé."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((service) => (
            <Link
              key={service.case_type}
              href={`/services/${service.case_type}`}
              className="group block"
            >
              <Card className="h-full p-5 transition group-hover:border-[var(--sf-green)]/30 group-hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/45">
                      {service.case_type_label}
                    </p>
                    <h2 className="mt-1 sf-display text-lg font-semibold text-[var(--sf-green-deep)]">
                      {service.name}
                    </h2>
                  </div>
                  {service.is_active ? (
                    <span className="shrink-0 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                      Actif
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      Inactif
                    </span>
                  )}
                </div>
                <p className="mt-3 line-clamp-3 text-sm text-[var(--sf-green)]/65">
                  {service.description || "Aucune description."}
                </p>
                <p className="mt-4 text-xs font-medium text-[var(--sf-green-mid)]">
                  {service.active_rules_count} règle
                  {service.active_rules_count > 1 ? "s" : ""} tarifaire
                  {service.active_rules_count > 1 ? "s" : ""} active
                  {service.active_rules_count > 1 ? "s" : ""} →
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
