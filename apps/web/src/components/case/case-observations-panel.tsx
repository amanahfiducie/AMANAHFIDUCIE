"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { CaseObservationDetailModal } from "@/components/case/case-observation-detail-modal";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate } from "@/lib/labels";
import {
  userCanReviewCaseObservation,
  userCanSubmitCaseObservation,
  userCanViewCaseRemarksSubmenu,
} from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useOptionalCaseDetail } from "@/providers/case-detail-provider";
import type { CaseObservation, CaseObservationKind, CaseObservationStatus } from "@/types/api";

function statusBadgeClass(status: CaseObservationStatus): string {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (status === "REJECTED") return "bg-red-50 text-red-900 ring-red-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

function excerpt(text: string, max = 120): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

type Props = {
  kind: CaseObservationKind;
  caseId?: string;
  /** Portail externe : pas de sous-menu remarques. */
  compact?: boolean;
};

export function CaseObservationsPanel({ kind, caseId: caseIdProp, compact = false }: Props) {
  const { user } = useAuth();
  const caseDetail = useOptionalCaseDetail();
  const caseId =
    caseIdProp ?? (caseDetail?.data?.id != null ? String(caseDetail.data.id) : null);

  const [items, setItems] = useState<CaseObservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<CaseObservation | null>(null);

  const isSubmission = kind === "SUBMISSION";
  const canSubmit = isSubmission && userCanSubmitCaseObservation(user);
  const canAddRemark = !isSubmission && userCanViewCaseRemarksSubmenu(user);
  const canReview = userCanReviewCaseObservation(user);
  const canUseForm = canSubmit || canAddRemark;

  const filtered = useMemo(() => items.filter((i) => i.kind === kind), [items, kind]);

  const pendingCount = useMemo(
    () =>
      items.filter((i) => i.kind === "SUBMISSION" && i.status === "PENDING").length,
    [items],
  );

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await apiRequest<CaseObservation[]>(`/cases/${caseId}/observations/`);
      setItems(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshAndCloseModal() {
    await load();
    setSelected(null);
    setModalError(null);
  }

  async function handleCreate(e: FormEvent, share: boolean) {
    e.preventDefault();
    if (!caseId || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/cases/${caseId}/observations/`, {
        method: "POST",
        body: JSON.stringify({
          body: body.trim(),
          kind,
          share: isSubmission ? share : false,
        }),
      });
      setBody("");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function shareObservation(id: number) {
    if (!caseId) return;
    setBusy(true);
    setModalError(null);
    try {
      await apiRequest(`/cases/${caseId}/observations/${id}/share/`, { method: "POST" });
      await refreshAndCloseModal();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Partage impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function approveObservation(id: number) {
    if (!caseId) return;
    setBusy(true);
    setModalError(null);
    try {
      await apiRequest(`/cases/${caseId}/observations/${id}/approve/`, { method: "POST" });
      await refreshAndCloseModal();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Validation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function rejectObservation(id: number, review_reason: string) {
    if (!caseId) return;
    setBusy(true);
    setModalError(null);
    try {
      await apiRequest(`/cases/${caseId}/observations/${id}/reject/`, {
        method: "POST",
        body: JSON.stringify({ review_reason }),
      });
      await refreshAndCloseModal();
    } catch (err) {
      setModalError(err instanceof ApiError ? err.message : "Refus impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!caseId) return null;
  if (loading) return <LoadingState label="Chargement…" />;

  const title = isSubmission ? "Observations partagées" : "Remarques internes";
  const description = isSubmission
    ? "Liste à gauche — sélectionnez une observation pour voir le détail et les actions selon votre profil."
    : "Notes de travail de la direction et du comité charaïque sur ce dossier.";

  return (
    <div className="space-y-4">
      {!compact ? (
        <div>
          <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/60">{description}</p>
        </div>
      ) : null}

      {error ? <ErrorAlert message={error} /> : null}

      {isSubmission && canReview && pendingCount > 0 ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {pendingCount} observation{pendingCount > 1 ? "s" : ""} en attente de votre décision.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        {/* Liste à gauche */}
        <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white">
          <div className="border-b border-[var(--sf-cream-dark)] px-4 py-3">
            <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
              Liste ({filtered.length})
            </h3>
          </div>
          {filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title={isSubmission ? "Aucune observation" : "Aucune remarque"}
                hint={
                  isSubmission
                    ? "Les observations déposées apparaîtront ici."
                    : "Ajoutez une remarque via le formulaire à droite."
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--sf-cream-dark)]">
              {filtered.map((item) => (
                <li key={item.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--sf-green-deep)]">
                        {item.author_display}
                      </p>
                      <p className="text-xs text-[var(--sf-green)]/45">
                        {formatDate(item.created_at)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${statusBadgeClass(item.status)}`}
                    >
                      {item.status_label}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm text-[var(--sf-green)]/70">
                    {excerpt(item.body)}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-[var(--sf-green-mid)] hover:underline"
                    onClick={() => {
                      setModalError(null);
                      setSelected(item);
                    }}
                  >
                    Voir détail
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Formulaire à droite */}
        <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
          {canUseForm ? (
            <>
              <h3 className="font-semibold text-[var(--sf-green-deep)]">
                {isSubmission ? "Nouvelle observation" : "Nouvelle remarque"}
              </h3>
              <p className="mt-1 text-sm text-[var(--sf-green)]/55">
                {isSubmission
                  ? "Transmise à la direction et au comité charaïque pour validation."
                  : "Visible immédiatement sur le dossier (direction / comité)."}
              </p>
              <form
                className="mt-4 space-y-3"
                onSubmit={(e) => void handleCreate(e, true)}
              >
                <textarea
                  className="sf-input min-h-[140px] w-full"
                  value={body}
                  placeholder={
                    isSubmission
                      ? "Votre observation sur le dossier…"
                      : "Suivi, note de travail, élément à retenir…"
                  }
                  disabled={busy}
                  onChange={(e) => setBody(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    className={isSubmission ? "sf-btn-primary text-sm" : "sf-btn-gold text-sm"}
                    disabled={busy || !body.trim()}
                  >
                    {isSubmission ? "Partager pour validation" : "Ajouter la remarque"}
                  </button>
                  {isSubmission ? (
                    <button
                      type="button"
                      className="sf-btn-secondary text-sm"
                      disabled={busy || !body.trim()}
                      onClick={(e) => void handleCreate(e, false)}
                    >
                      Enregistrer en brouillon
                    </button>
                  ) : null}
                </div>
              </form>
            </>
          ) : (
            <div className="text-sm text-[var(--sf-green)]/55">
              <p className="font-medium text-[var(--sf-green-deep)]">Consultation</p>
              <p className="mt-2">
                Sélectionnez une entrée dans la liste et cliquez sur{' '}
                <strong>Voir détail</strong> pour consulter le contenu et les actions disponibles
                selon votre profil.
              </p>
            </div>
          )}
        </section>
      </div>

      <CaseObservationDetailModal
        open={selected != null}
        item={selected}
        busy={busy}
        error={modalError}
        onClose={() => {
          if (!busy) {
            setSelected(null);
            setModalError(null);
          }
        }}
        onShare={isSubmission ? shareObservation : undefined}
        onApprove={isSubmission ? approveObservation : undefined}
        onReject={isSubmission ? rejectObservation : undefined}
      />
    </div>
  );
}
