"use client";

import { useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { formatDate } from "@/lib/labels";
import {
  userCanReviewCaseObservation,
  userCanSubmitCaseObservation,
} from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { CaseObservation } from "@/types/api";

function statusBadgeClass(status: CaseObservation["status"]): string {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-900 ring-emerald-200";
  if (status === "REJECTED") return "bg-red-50 text-red-900 ring-red-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-900 ring-amber-200";
  return "bg-slate-50 text-slate-700 ring-slate-200";
}

type Props = {
  open: boolean;
  item: CaseObservation | null;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onShare?: (id: number) => void | Promise<void>;
  onApprove?: (id: number) => void | Promise<void>;
  onReject?: (id: number, reason: string) => void | Promise<void>;
};

export function CaseObservationDetailModal({
  open,
  item,
  busy = false,
  error = null,
  onClose,
  onShare,
  onApprove,
  onReject,
}: Props) {
  const { user } = useAuth();
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (!open || !item) return null;

  const canReview = userCanReviewCaseObservation(user);
  const isAuthor = user?.id === item.author;
  const isSubmission = item.kind === "SUBMISSION";
  const canShareDraft = isSubmission && item.status === "DRAFT" && isAuthor && onShare;
  const canApprove = isSubmission && item.status === "PENDING" && canReview && onApprove;
  const canReject = isSubmission && item.status === "PENDING" && canReview && onReject;

  function handleClose() {
    if (busy) return;
    setShowRejectForm(false);
    setRejectReason("");
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="obs-detail-title"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--sf-cream-dark)] px-5 py-4">
          <div>
            <h2 id="obs-detail-title" className="text-lg font-semibold text-[var(--sf-green-deep)]">
              {isSubmission ? "Détail de l'observation" : "Détail de la remarque"}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--sf-green)]/60">
              {item.author_display} · {formatDate(item.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Fermer
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error ? <ErrorAlert message={error} /> : null}

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${statusBadgeClass(item.status)}`}
            >
              {item.status_label}
            </span>
            <span className="text-xs text-[var(--sf-green)]/50">{item.kind_label}</span>
          </div>

          <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/20 p-4">
            <p className="whitespace-pre-wrap text-sm text-[var(--sf-green-deep)]">{item.body}</p>
          </div>

          {item.shared_at ? (
            <p className="text-xs text-[var(--sf-green)]/50">
              Partagé le {formatDate(item.shared_at)}
            </p>
          ) : null}

          {item.review_reason ? (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900">
              <p className="font-semibold">Motif du refus</p>
              <p className="mt-1 whitespace-pre-wrap">{item.review_reason}</p>
            </div>
          ) : null}

          {item.reviewed_by_username && item.reviewed_at ? (
            <p className="text-xs text-[var(--sf-green)]/50">
              Traité par {item.reviewed_by_username} · {formatDate(item.reviewed_at)}
            </p>
          ) : null}

          {canShareDraft ? (
            <div className="rounded-lg border border-[var(--sf-cream-dark)] bg-white p-4">
              <p className="text-sm font-medium text-[var(--sf-green-deep)]">Votre action</p>
              <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                Cette observation est en brouillon. Partagez-la pour la soumettre à la direction et
                au comité charaïque.
              </p>
              <button
                type="button"
                className="sf-btn-primary mt-3 text-sm"
                disabled={busy}
                onClick={() => void onShare(item.id)}
              >
                Partager pour validation
              </button>
            </div>
          ) : null}

          {canApprove || canReject ? (
            <div className="rounded-lg border border-[var(--sf-gold)]/30 bg-[var(--sf-gold)]/5 p-4">
              <p className="text-sm font-semibold text-[var(--sf-green-deep)]">
                Décision direction / comité
              </p>
              <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                Retenir pour l&apos;ajouter au dossier, ou refuser avec un motif obligatoire.
              </p>
              {!showRejectForm ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="sf-btn-primary text-sm"
                    disabled={busy}
                    onClick={() => void onApprove?.(item.id)}
                  >
                    Retenir et ajouter au dossier
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-60"
                    disabled={busy}
                    onClick={() => setShowRejectForm(true)}
                  >
                    Refuser
                  </button>
                </div>
              ) : (
                <form
                  className="mt-3 space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void onReject?.(item.id, rejectReason);
                    setShowRejectForm(false);
                    setRejectReason("");
                  }}
                >
                  <label className="block text-xs font-medium text-red-900">
                    Motif du refus (obligatoire)
                    <textarea
                      className="sf-input mt-1 min-h-[80px] w-full text-sm"
                      value={rejectReason}
                      required
                      disabled={busy}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={busy || !rejectReason.trim()}
                    >
                      Confirmer le refus
                    </button>
                    <button
                      type="button"
                      className="sf-btn-secondary text-sm"
                      disabled={busy}
                      onClick={() => setShowRejectForm(false)}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : null}

          {isSubmission &&
          item.status === "PENDING" &&
          !canReview &&
          userCanSubmitCaseObservation(user) ? (
            <p className="text-xs text-[var(--sf-green)]/50">
              En attente de validation par la direction ou le comité charaïque.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
