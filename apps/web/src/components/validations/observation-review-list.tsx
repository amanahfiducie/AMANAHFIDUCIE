"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ValidationsListFilters } from "@/components/validations/validations-list-filters";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import type { CaseObservation } from "@/types/api";

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "PENDING", label: "En attente" },
  { value: "APPROVED", label: "Approuvé" },
  { value: "REJECTED", label: "Rejeté" },
];

const KIND_OPTIONS = [
  { value: "", label: "Observations & remarques" },
  { value: "SUBMISSION", label: "Observations" },
  { value: "REMARK", label: "Remarques" },
];

function statusTone(status: string) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (status === "REJECTED") return "bg-red-50 text-red-900 ring-red-200";
  return "bg-amber-50 text-amber-900 ring-amber-200";
}

export function ObservationReviewList() {
  const [items, setItems] = useState<CaseObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [actionableOnly, setActionableOnly] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [reasonById, setReasonById] = useState<Record<number, string>>({});

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (status) params.set("status", status);
      if (kind) params.set("kind", kind);
      if (actionableOnly) params.set("actionable", "1");
      const qs = params.toString();
      const data = await apiRequest<CaseObservation[]>(
        `/observations/review-queue/${qs ? `?${qs}` : ""}`,
      );
      setItems(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger les observations.",
      );
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, status, kind, actionableOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const pending = items.filter(
      (i) => i.kind === "SUBMISSION" && i.status === "PENDING",
    ).length;
    const remarks = items.filter((i) => i.kind === "REMARK").length;
    return { total: items.length, pending, remarks };
  }, [items]);

  async function decide(item: CaseObservation, approved: boolean) {
    if (!item.case) return;
    const reason = (reasonById[item.id] ?? "").trim();
    if (!approved && !reason) {
      setError("Le motif du refus est obligatoire.");
      return;
    }
    setActingId(item.id);
    setError(null);
    try {
      const path = approved
        ? `/cases/${item.case}/observations/${item.id}/approve/`
        : `/cases/${item.case}/observations/${item.id}/reject/`;
      await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(approved ? {} : { review_reason: reason }),
      });
      setReasonById((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
          Observations & remarques
        </h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/55">
          Validez ou refusez les observations partagées. Les remarques internes restent
          visibles ; le motif de refus est toujours conservé.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-[var(--sf-green-deep)]">{counts.total}</p>
          <p className="text-xs text-[var(--sf-green)]/55">Éléments visibles</p>
        </div>
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-[var(--sf-green-deep)]">
            {counts.pending}
          </p>
          <p className="text-xs text-[var(--sf-green)]/55">Observations à valider</p>
        </div>
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-[var(--sf-green-deep)]">
            {counts.remarks}
          </p>
          <p className="text-xs text-[var(--sf-green)]/55">Remarques</p>
        </div>
      </div>

      <ValidationsListFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        secondary={kind}
        onSecondaryChange={setKind}
        secondaryLabel="Nature"
        secondaryOptions={KIND_OPTIONS}
        actionableOnly={actionableOnly}
        onActionableOnlyChange={setActionableOnly}
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorAlert message={error} /> : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="Aucune observation"
          description="Aucune observation ou remarque ne correspond à vos filtres."
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="space-y-4">
          {items.map((item) => {
            const canDecide =
              item.kind === "SUBMISSION" && item.status === "PENDING";
            return (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/50">
                      {item.kind_label}
                    </p>
                    <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                      {item.case ? (
                        <Link
                          href={`/dossiers/${item.case}`}
                          className="font-medium text-[var(--sf-green-mid)] hover:underline"
                        >
                          {item.case_reference}
                        </Link>
                      ) : (
                        item.case_reference
                      )}
                      {item.case_title ? ` · ${item.case_title}` : null}
                      {" · "}
                      {item.author_display || item.author_username}
                      {" · "}
                      {formatDate(item.updated_at || item.created_at)}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--sf-green-deep)]">
                      {item.body}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ${statusTone(item.status)}`}
                  >
                    {item.status_label}
                  </span>
                </div>

                {item.review_reason ? (
                  <div className="mt-3 rounded-lg border border-red-100 bg-red-50/60 px-3 py-2 text-sm text-red-900">
                    <span className="font-medium">Motif du refus : </span>
                    {item.review_reason}
                  </div>
                ) : null}

                {canDecide ? (
                  <div className="mt-4 border-t border-[var(--sf-cream-dark)] pt-4">
                    <label className="block text-xs font-medium text-[var(--sf-green)]/55">
                      Motif du refus (obligatoire si rejet)
                    </label>
                    <textarea
                      rows={2}
                      value={reasonById[item.id] ?? ""}
                      onChange={(e) =>
                        setReasonById((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="Expliquer le refus…"
                      className="sf-input mt-1 w-full resize-y text-sm"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.case ? (
                        <Link
                          href={`/dossiers/${item.case}/observations/partagees`}
                          className="sf-btn-secondary text-sm"
                        >
                          Voir sur le dossier
                        </Link>
                      ) : null}
                      <button
                        type="button"
                        disabled={actingId === item.id}
                        onClick={() => void decide(item, true)}
                        className="sf-btn-primary text-sm disabled:opacity-60"
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        disabled={actingId === item.id}
                        onClick={() => void decide(item, false)}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-60"
                      >
                        Rejeter
                      </button>
                    </div>
                  </div>
                ) : item.case ? (
                  <div className="mt-4">
                    <Link
                      href={
                        item.kind === "REMARK"
                          ? `/dossiers/${item.case}/observations/remarques`
                          : `/dossiers/${item.case}/observations/partagees`
                      }
                      className="text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
                    >
                      Ouvrir sur le dossier →
                    </Link>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
