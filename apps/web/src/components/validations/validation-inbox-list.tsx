"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ValidationsListFilters } from "@/components/validations/validations-list-filters";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import {
  DOSSIER_WORKFLOW_STEPS,
  VALIDATION_STATUS_LABELS,
  VALIDATION_TYPE_LABELS,
} from "@/lib/validation-labels";
import type { ValidationRequest } from "@/types/api";

const STATUS_OPTIONS = [
  { value: "", label: "Tous les statuts" },
  { value: "PENDING", label: "En attente" },
  { value: "IN_PROGRESS", label: "En cours" },
  { value: "APPROVED", label: "Approuvé" },
  { value: "REJECTED", label: "Rejeté" },
  { value: "REQUEST_CHANGES", label: "Modifications demandées" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Tous les types" },
  { value: "MANAGEMENT", label: "Direction" },
  { value: "LEGAL", label: "Juridique" },
  { value: "CHARIA", label: "Charaïque" },
  { value: "ACCOUNTING", label: "Comptable" },
  { value: "AUDIT", label: "Audit" },
];

function polesProgress(item: ValidationRequest) {
  if (item.validation_type !== "CASE_REVIEW") return null;
  return DOSSIER_WORKFLOW_STEPS.map((pole) => {
    const step = item.steps.find((s) => s.assigned_role === pole.role);
    return {
      ...pole,
      status: step?.status ?? "PENDING",
      comment: step?.decisions?.[0]?.comment?.trim() || "",
    };
  });
}

function statusTone(status: string) {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (status === "REJECTED") return "bg-red-50 text-red-900 ring-red-200";
  if (status === "REQUEST_CHANGES") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-amber-50 text-amber-900 ring-amber-200";
}

export function ValidationInboxList({
  scope,
  title,
  description,
  showTypeFilter = false,
}: {
  scope: "DOSSIERS" | "DEMANDES";
  title: string;
  description: string;
  showTypeFilter?: boolean;
}) {
  const [items, setItems] = useState<ValidationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [actionableOnly, setActionableOnly] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [commentById, setCommentById] = useState<Record<number, string>>({});
  const [returnToById, setReturnToById] = useState<Record<number, string>>({});

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ scope });
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (status) params.set("status", status);
      if (showTypeFilter && typeFilter) params.set("validation_type", typeFilter);
      if (actionableOnly) params.set("actionable", "1");
      const data = await apiRequest<ValidationRequest[]>(
        `/validations/inbox/?${params.toString()}`,
      );
      setItems(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger les validations.",
      );
    } finally {
      setLoading(false);
    }
  }, [scope, debouncedSearch, status, typeFilter, actionableOnly, showTypeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const actionable = items.filter((i) => i.can_decide).length;
    const rejected = items.filter((i) => i.status === "REJECTED").length;
    return { total: items.length, actionable, rejected };
  }, [items]);

  async function decide(id: number, action: "approve" | "reject") {
    const item = items.find((i) => i.id === id);
    const comment = (commentById[id] ?? "").trim();
    const targets = item?.return_targets ?? [];
    const returnToRole = (returnToById[id] ?? "").trim();
    const needsComment = action === "reject";
    if (needsComment && !comment) {
      setError("Le motif du rejet est obligatoire.");
      return;
    }
    if (action === "reject" && targets.length > 0 && !returnToRole) {
      setError(
        "Sélectionnez la personne / le pôle concerné pour apporter les corrections.",
      );
      return;
    }
    setActingId(id);
    setError(null);
    try {
      const body: { comment: string; return_to_role?: string } = { comment };
      if (action === "reject" && returnToRole) {
        body.return_to_role = returnToRole;
      }
      await apiRequest(`/validations/${id}/${action}/`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setCommentById((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setReturnToById((prev) => {
        const next = { ...prev };
        delete next[id];
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
        <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">{title}</h2>
        <p className="mt-1 text-sm text-[var(--sf-green)]/55">{description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-[var(--sf-green-deep)]">{counts.total}</p>
          <p className="text-xs text-[var(--sf-green)]/55">Éléments visibles</p>
        </div>
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-[var(--sf-green-deep)]">
            {counts.actionable}
          </p>
          <p className="text-xs text-[var(--sf-green)]/55">À traiter par vous</p>
        </div>
        <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm">
          <p className="text-2xl font-semibold text-[var(--sf-green-deep)]">
            {counts.rejected}
          </p>
          <p className="text-xs text-[var(--sf-green)]/55">Rejetés (motif visible)</p>
        </div>
      </div>

      <ValidationsListFilters
        search={search}
        onSearchChange={setSearch}
        status={status}
        onStatusChange={setStatus}
        statusOptions={STATUS_OPTIONS}
        secondary={showTypeFilter ? typeFilter : undefined}
        onSecondaryChange={showTypeFilter ? setTypeFilter : undefined}
        secondaryLabel="Type de demande"
        secondaryOptions={showTypeFilter ? TYPE_OPTIONS : undefined}
        actionableOnly={actionableOnly}
        onActionableOnlyChange={setActionableOnly}
      />

      {loading ? <LoadingState /> : null}
      {error ? <ErrorAlert message={error} /> : null}

      {!loading && items.length === 0 ? (
        <EmptyState
          title="Aucun élément"
          description="Aucune validation ne correspond à vos filtres pour les dossiers qui vous concernent."
        />
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="space-y-4">
          {items.map((item) => {
            const poles = polesProgress(item);
            const canDecide = Boolean(item.can_decide);
            const stepLabel =
              item.current_step?.step_label
              ?? item.current_step?.assigned_role
              ?? "—";
            return (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--sf-green-deep)]">{item.title}</p>
                    <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                      <Link
                        href={`/dossiers/${item.case}`}
                        className="font-medium text-[var(--sf-green-mid)] hover:underline"
                      >
                        {item.case_reference}
                      </Link>
                      {item.case_title ? ` · ${item.case_title}` : null}
                      {" · "}
                      {VALIDATION_TYPE_LABELS[item.validation_type] ?? item.validation_type}
                      {" · "}
                      {formatDate(item.updated_at || item.created_at)}
                    </p>
                    {item.summary ? (
                      <p className="mt-2 line-clamp-2 text-sm text-[var(--sf-green)]/65">
                        {item.summary}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ring-1 ${statusTone(item.status)}`}
                  >
                    {VALIDATION_STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </div>

                {poles ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {poles.map((pole) => (
                      <span
                        key={pole.role}
                        title={pole.comment || undefined}
                        className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ring-1 ${
                          pole.status === "APPROVED"
                            ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
                            : pole.status === "REJECTED"
                              ? "bg-red-50 text-red-900 ring-red-200"
                              : pole.status === "PENDING" && canDecide && item.current_step?.assigned_role === pole.role
                                ? "bg-[var(--sf-green)]/10 text-[var(--sf-green-deep)] ring-[var(--sf-green)]/25"
                                : "bg-[var(--sf-cream)] text-[var(--sf-green)]/60 ring-[var(--sf-cream-dark)]"
                        }`}
                      >
                        {pole.label}
                        <span className="opacity-70">
                          · {VALIDATION_STATUS_LABELS[pole.status] ?? pole.status}
                        </span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 inline-flex rounded-md bg-[var(--sf-green)]/10 px-2 py-0.5 text-xs font-medium text-[var(--sf-green-deep)]">
                    Étape : {stepLabel}
                  </p>
                )}

                {item.latest_decision_comment ? (
                  <div className="mt-3 rounded-lg border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 px-3 py-2 text-sm text-[var(--sf-green)]/80">
                    <span className="font-medium text-[var(--sf-green-deep)]">
                      Motif / observation :{" "}
                    </span>
                    {item.latest_decision_comment}
                  </div>
                ) : null}

                {canDecide ? (
                  <div className="mt-4 border-t border-[var(--sf-cream-dark)] pt-4">
                    <label className="block text-xs font-medium text-[var(--sf-green)]/55">
                      Observation / motif du rejet
                    </label>
                    <textarea
                      rows={2}
                      value={commentById[item.id] ?? ""}
                      onChange={(e) =>
                        setCommentById((prev) => ({
                          ...prev,
                          [item.id]: e.target.value,
                        }))
                      }
                      placeholder="Optionnel pour valider — obligatoire en cas de rejet…"
                      className="sf-input mt-1 w-full resize-y text-sm"
                    />
                    {(item.return_targets?.length ?? 0) > 0 ? (
                      <label className="mt-3 block text-xs font-medium text-[var(--sf-green)]/55">
                        Renvoyer à (pour correction et revalidation) *
                        <select
                          value={returnToById[item.id] ?? ""}
                          onChange={(e) =>
                            setReturnToById((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          className="sf-input mt-1 block w-full text-sm"
                        >
                          <option value="">Choisir la personne / le pôle…</option>
                          {item.return_targets?.map((t) => (
                            <option key={`${t.role}-${t.step_order}`} value={t.role}>
                              {t.label}
                              {t.user_name ? ` — ${t.user_name}` : ""}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link
                        href={`/dossiers/${item.case}/validations`}
                        className="sf-btn-secondary text-sm"
                      >
                        Voir le dossier
                      </Link>
                      <button
                        type="button"
                        disabled={actingId === item.id}
                        onClick={() => void decide(item.id, "approve")}
                        className="sf-btn-primary text-sm disabled:opacity-60"
                      >
                        Valider
                      </button>
                      <button
                        type="button"
                        disabled={actingId === item.id}
                        onClick={() => void decide(item.id, "reject")}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-60"
                      >
                        {(item.return_targets?.length ?? 0) > 0
                          ? "Rejeter et renvoyer"
                          : "Rejeter"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <Link
                      href={`/dossiers/${item.case}/validations`}
                      className="text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
                    >
                      Ouvrir le dossier →
                    </Link>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
