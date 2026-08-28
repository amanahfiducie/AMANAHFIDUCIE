"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import {
  VALIDATION_STATUS_LABELS,
  VALIDATION_TYPE_LABELS,
} from "@/lib/validation-labels";
import type { ValidationRequest } from "@/types/api";

export function ValidationQueuePanel({
  validationTypeFilter,
  title = "Validations en attente",
  description,
  showActions = true,
}: {
  validationTypeFilter?: string;
  title?: string;
  description?: string;
  showActions?: boolean;
}) {
  const [items, setItems] = useState<ValidationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);
  const [commentById, setCommentById] = useState<Record<number, string>>({});
  const [returnToById, setReturnToById] = useState<Record<number, string>>({});

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const queue = await apiRequest<ValidationRequest[]>("/validations/my-queue/");
      const filtered = validationTypeFilter
        ? queue.filter((v) => v.validation_type === validationTypeFilter)
        : queue;
      setItems(filtered);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de charger les validations.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [validationTypeFilter]);

  async function decide(
    id: number,
    action: "approve" | "reject" | "request-changes",
  ) {
    const item = items.find((i) => i.id === id);
    const comment = (commentById[id] ?? "").trim();
    const targets = item?.return_targets ?? [];
    const returnToRole = (returnToById[id] ?? "").trim();
    if (action === "reject" && !comment) {
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
      const path =
        action === "request-changes"
          ? `/validations/${id}/request-changes/`
          : `/validations/${id}/${action}/`;
      const body: { comment: string; return_to_role?: string } = { comment };
      if (action === "reject" && returnToRole) {
        body.return_to_role = returnToRole;
      }
      await apiRequest(path, {
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

  if (loading) return <LoadingState />;
  if (error && items.length === 0) return <ErrorAlert message={error} />;

  if (items.length === 0) {
    return (
      <EmptyState
        title="Aucune validation en attente"
        description={
          description
            ?? "Les demandes dont l'étape courante vous est assignée apparaîtront ici."
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      {title ? (
        <div>
          <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-[var(--sf-green)]/55">{description}</p>
          ) : null}
        </div>
      ) : null}
      {error ? <ErrorAlert message={error} /> : null}

      <ul className="space-y-4">
        {items.map((item) => {
          const stepLabel =
            item.current_step?.step_label ?? item.current_step?.assigned_role ?? "—";
          const canDecide = showActions && Boolean(item.can_decide);
          return (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[var(--sf-green-deep)]">{item.title}</p>
                  <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                    {item.case_reference} · {VALIDATION_TYPE_LABELS[item.validation_type] ?? item.validation_type}
                    {" · "}
                    {formatDate(item.created_at)}
                  </p>
                  {item.summary ? (
                    <p className="mt-2 line-clamp-2 text-sm text-[var(--sf-green)]/65">
                      {item.summary}
                    </p>
                  ) : null}
                  <p className="mt-2 inline-flex rounded-md bg-[var(--sf-green)]/10 px-2 py-0.5 text-xs font-medium text-[var(--sf-green-deep)]">
                    Étape en cours : {stepLabel}
                  </p>
                </div>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-900 ring-1 ring-amber-200">
                  {VALIDATION_STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>

              {canDecide ? (
                <div className="mt-4 border-t border-[var(--sf-cream-dark)] pt-4">
                  <label className="block text-xs font-medium text-[var(--sf-green)]/55">
                    Observation (optionnelle)
                  </label>
                  <textarea
                    rows={2}
                    value={commentById[item.id] ?? ""}
                    onChange={(e) =>
                      setCommentById((prev) => ({ ...prev, [item.id]: e.target.value }))
                    }
                    placeholder="Optionnel pour valider — obligatoire en cas de rejet…"
                    className="sf-input mt-1 w-full resize-y text-sm"
                  />
                  {(item.return_targets?.length ?? 0) > 0 ? (
                    <label className="mt-3 block text-xs font-medium text-[var(--sf-green)]/55">
                      Renvoyer à (pour correction) *
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
                      onClick={() => decide(item.id, "approve")}
                      className="sf-btn-primary text-sm disabled:opacity-60"
                    >
                      Valider
                    </button>
                    <button
                      type="button"
                      disabled={actingId === item.id}
                      onClick={() => decide(item.id, "reject")}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-60"
                    >
                      {(item.return_targets?.length ?? 0) > 0
                        ? "Rejeter et renvoyer"
                        : "Rejeter"}
                    </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
