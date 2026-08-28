"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PatrimoineSection } from "@/components/case/patrimoine-layout";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate, CASE_STATUS_LABELS } from "@/lib/labels";
import {
  DOSSIER_WORKFLOW_STEPS,
  VALIDATION_STATUS_LABELS,
  VALIDATION_STEP_STATUS_LABELS,
  VALIDATION_SUBJECT_LABELS,
  VALIDATION_TYPE_LABELS,
  validationStepLabel,
} from "@/lib/validation-labels";
import { useAuth } from "@/providers/auth-provider";
import { useCaseDetail } from "@/providers/case-detail-provider";
import {
  userCanActOnValidationStep,
  userCanCreateValidation,
} from "@/lib/role-access";
import type { ValidationRequest, ValidationStep } from "@/types/api";

function stepStatusClass(status: string): string {
  if (status === "APPROVED") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "REJECTED") return "bg-red-50 text-red-800 ring-red-200";
  if (status === "PENDING") return "bg-amber-50 text-amber-900 ring-amber-200";
  if (status === "REQUEST_CHANGES") return "bg-orange-50 text-orange-900 ring-orange-200";
  if (status === "IN_PROGRESS") return "bg-sky-50 text-sky-900 ring-sky-200";
  return "bg-[var(--sf-cream)]/60 text-[var(--sf-green)]/55 ring-[var(--sf-cream-dark)]";
}

function stepDotClass(status: string, isCurrent: boolean): string {
  if (status === "APPROVED") {
    return "border-emerald-600 bg-emerald-600 text-white";
  }
  if (status === "REJECTED") {
    return "border-red-600 bg-red-600 text-white";
  }
  if (status === "REQUEST_CHANGES") {
    return "border-orange-500 bg-orange-500 text-white";
  }
  if (isCurrent) {
    return "border-[var(--sf-green-mid)] bg-[var(--sf-green-mid)] text-white ring-4 ring-[var(--sf-green)]/15";
  }
  if (status === "PENDING") {
    return "border-[var(--sf-cream-dark)] bg-white text-[var(--sf-green)]/40";
  }
  return "border-[var(--sf-cream-dark)] bg-white text-[var(--sf-green)]/35";
}

type WorkflowStateInfo = {
  tone: "progress" | "done" | "rejected" | "changes" | "idle";
  title: string;
  detail: string;
  stepIndex: number;
  total: number;
};

function resolveWorkflowState(
  steps: ValidationStep[],
  requestStatus: string,
): WorkflowStateInfo {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  const total = Math.max(ordered.length, 1);
  const currentIndex = ordered.findIndex((s) => s.status === "PENDING");
  const rejectedStep = ordered.find((s) => s.status === "REJECTED");
  const changesStep = ordered.find((s) => s.status === "REQUEST_CHANGES");
  const doneCount = ordered.filter(
    (s) => s.status === "APPROVED" || s.status === "SKIPPED",
  ).length;

  if (rejectedStep) {
    return {
      tone: "rejected",
      title: "Circuit rejeté",
      detail: `Rejeté à l'étape « ${validationStepLabel(rejectedStep.assigned_role, rejectedStep.step_label)} » (étape ${rejectedStep.step_order}/${total}).`,
      stepIndex: rejectedStep.step_order,
      total,
    };
  }
  if (changesStep) {
    return {
      tone: "changes",
      title: "Modifications demandées",
      detail: `Par « ${validationStepLabel(changesStep.assigned_role, changesStep.step_label)} » — le dossier doit être repris avant de relancer l'étape.`,
      stepIndex: changesStep.step_order,
      total,
    };
  }
  if (requestStatus === "APPROVED" || doneCount >= total) {
    return {
      tone: "done",
      title: "Circuit terminé",
      detail: "Toutes les étapes ont été validées.",
      stepIndex: total,
      total,
    };
  }
  if (currentIndex >= 0) {
    const step = ordered[currentIndex];
    return {
      tone: "progress",
      title: `En attente de : ${validationStepLabel(step.assigned_role, step.step_label)}`,
      detail: `Étape ${step.step_order} sur ${total}`,
      stepIndex: step.step_order,
      total,
    };
  }
  return {
    tone: "idle",
    title: VALIDATION_STATUS_LABELS[requestStatus] ?? requestStatus,
    detail: "Statut de la demande.",
    stepIndex: doneCount,
    total,
  };
}

function stateBannerClass(tone: WorkflowStateInfo["tone"]): string {
  if (tone === "done") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (tone === "rejected") return "border-red-200 bg-red-50 text-red-900";
  if (tone === "changes") return "border-orange-200 bg-orange-50 text-orange-950";
  if (tone === "progress") return "border-sky-200 bg-sky-50 text-sky-950";
  return "border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 text-[var(--sf-green-deep)]";
}

function decisionActorName(decision: {
  decided_by_name?: string;
  decided_by_username: string;
} | null | undefined): string {
  if (!decision) return "";
  return (decision.decided_by_name || decision.decided_by_username || "").trim();
}

function WorkflowProgressBar({
  steps,
  requestStatus,
  currentUserCanAct = false,
  showStateBanner = true,
}: {
  steps: ValidationStep[];
  requestStatus: string;
  /** Si true, l'étape courante affiche « Votre tour » au lieu de « En cours ». */
  currentUserCanAct?: boolean;
  showStateBanner?: boolean;
}) {
  const ordered = [...steps].sort((a, b) => a.step_order - b.step_order);
  const total = Math.max(ordered.length, 1);
  const doneCount = ordered.filter(
    (s) => s.status === "APPROVED" || s.status === "SKIPPED",
  ).length;
  const rejected = ordered.some((s) => s.status === "REJECTED");
  const changes = ordered.some((s) => s.status === "REQUEST_CHANGES");
  const currentIndex = ordered.findIndex((s) => s.status === "PENDING");
  const segments = Math.max(total - 1, 1);
  const fillPercent =
    doneCount >= total
      ? 100
      : currentIndex >= 0
        ? (currentIndex / segments) * 100
        : (doneCount / segments) * 100;
  const state = resolveWorkflowState(steps, requestStatus);

  return (
    <div className="space-y-4">
      {showStateBanner ? (
        <div
          className={`rounded-lg border px-3 py-2.5 sm:px-4 ${stateBannerClass(state.tone)}`}
          role="status"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
            Progression
          </p>
          <p className="mt-0.5 text-sm font-semibold">{state.title}</p>
          <p className="mt-0.5 text-xs opacity-80">{state.detail}</p>
        </div>
      ) : null}

      <div className="relative px-1 pt-1">
        <div
          className="absolute left-[12.5%] right-[12.5%] top-[18px] h-1.5 rounded-full bg-[var(--sf-cream-dark)]/80"
          aria-hidden
        />
        <div
          className={`absolute left-[12.5%] top-[18px] h-1.5 rounded-full transition-all duration-500 ${
            rejected
              ? "bg-red-500"
              : changes
                ? "bg-orange-500"
                : "bg-[var(--sf-green-mid)]"
          }`}
          style={{ width: `calc((100% - 25%) * ${Math.min(100, fillPercent) / 100})` }}
          aria-hidden
        />

        <ol
          className="relative z-10 grid gap-2"
          style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
        >
          {ordered.map((step, index) => {
            const isCurrent = currentIndex === index;
            const lastDecision = step.decisions[step.decisions.length - 1];
            const actor = decisionActorName(lastDecision);
            const decidedAt = lastDecision?.created_at
              ? formatDate(lastDecision.created_at)
              : null;
            const label = validationStepLabel(step.assigned_role, step.step_label);
            return (
              <li
                key={step.id}
                className={`flex flex-col items-center rounded-lg px-1 py-1 text-center ${
                  isCurrent ? "bg-sky-50/80 ring-1 ring-sky-200" : ""
                }`}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-bold ${stepDotClass(step.status, isCurrent)}`}
                  title={VALIDATION_STEP_STATUS_LABELS[step.status] ?? step.status}
                >
                  {step.status === "APPROVED" ? (
                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor" aria-hidden>
                      <path
                        fillRule="evenodd"
                        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : step.status === "REJECTED" ? (
                    "!"
                  ) : (
                    step.step_order
                  )}
                </span>
                <p className="mt-2 text-[11px] font-semibold leading-tight text-[var(--sf-green-deep)] sm:text-xs">
                  {label}
                </p>
                <p
                  className={`mt-0.5 text-[10px] ${
                    isCurrent
                      ? "font-semibold text-sky-800"
                      : "text-[var(--sf-green)]/45"
                  }`}
                >
                  {isCurrent
                    ? currentUserCanAct
                      ? "← Votre tour"
                      : "En cours"
                    : (VALIDATION_STEP_STATUS_LABELS[step.status] ?? step.status)}
                </p>
                {actor ? (
                  <p className="mt-1 max-w-[10rem] text-[11px] font-medium leading-tight text-[var(--sf-green-deep)] sm:max-w-[12rem]">
                    {step.status === "APPROVED"
                      ? "Validé par"
                      : step.status === "REJECTED"
                        ? "Rejeté par"
                        : step.status === "REQUEST_CHANGES"
                          ? "Demandé par"
                          : "Par"}{" "}
                    <span className="font-semibold">{actor}</span>
                    {decidedAt ? (
                      <span className="mt-0.5 block text-[10px] font-normal text-[var(--sf-green)]/45">
                        {decidedAt}
                      </span>
                    ) : null}
                  </p>
                ) : null}
                {lastDecision?.comment ? (
                  <p className="mt-1.5 line-clamp-2 max-w-[9rem] text-[10px] italic text-[var(--sf-green)]/55 sm:max-w-[11rem]">
                    « {lastDecision.comment} »
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function ValidationCard({
  item,
  canAct,
  acting,
  onDecide,
  hideCircuit = false,
}: {
  item: ValidationRequest;
  canAct: boolean;
  acting: boolean;
  onDecide: (
    id: number,
    action: "approve" | "reject" | "request-changes",
    comment: string,
    returnToRole?: string,
  ) => void;
  /** Masquer le circuit (déjà affiché une seule fois en haut de page). */
  hideCircuit?: boolean;
}) {
  const [comment, setComment] = useState("");
  const [returnToRole, setReturnToRole] = useState("");
  const state = resolveWorkflowState(item.steps, item.status);
  const returnTargets = item.return_targets ?? [];
  const currentLabel = item.current_step
    ? validationStepLabel(
        item.current_step.assigned_role,
        item.current_step.step_label,
      )
    : null;

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
      <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-[var(--sf-green-deep)]">{item.title}</h3>
            <p className="mt-1 text-xs text-[var(--sf-green)]/55">
              {VALIDATION_TYPE_LABELS[item.validation_type] ?? item.validation_type}
              {" · "}
              {VALIDATION_SUBJECT_LABELS[item.subject_type] ?? item.subject_type}
              {" · "}
              {formatDate(item.created_at)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${stepStatusClass(item.status)}`}
            >
              {VALIDATION_STATUS_LABELS[item.status] ?? item.status}
            </span>
            {hideCircuit ? null : (
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ${stepStatusClass(
                  state.tone === "progress"
                    ? "IN_PROGRESS"
                    : state.tone === "done"
                      ? "APPROVED"
                      : state.tone === "rejected"
                        ? "REJECTED"
                        : state.tone === "changes"
                          ? "REQUEST_CHANGES"
                          : item.status,
                )}`}
              >
                {state.tone === "progress"
                  ? `Étape ${state.stepIndex}/${state.total}`
                  : state.title}
              </span>
            )}
          </div>
        </div>
        {item.summary ? (
          <p className="mt-2 text-sm text-[var(--sf-green)]/70">{item.summary}</p>
        ) : null}
        <p className="mt-1 text-[10px] text-[var(--sf-green)]/45">
          Demandé par {item.requested_by_username}
        </p>
      </div>

      {hideCircuit ? null : (
        <div className="p-4 sm:p-5">
          <WorkflowProgressBar
            steps={item.steps}
            requestStatus={item.status}
            currentUserCanAct={canAct}
          />
        </div>
      )}

      {canAct && item.current_step ? (
        <div className="border-t border-[var(--sf-cream-dark)] bg-[var(--sf-green)]/5 px-4 py-4 sm:px-5">
          <p className="text-sm font-medium text-[var(--sf-green-deep)]">
            Votre tour : {currentLabel}
          </p>
          <label className="mt-3 block text-xs font-medium text-[var(--sf-green)]/55">
            Observation (optionnelle)
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optionnel pour valider — obligatoire en cas de rejet ou renvoi…"
            className="sf-input mt-1 w-full resize-y text-sm"
          />
          {returnTargets.length > 0 ? (
            <label className="mt-3 block text-xs font-medium text-[var(--sf-green)]/55">
              En cas de rejet — renvoyer à *
              <select
                value={returnToRole}
                onChange={(e) => setReturnToRole(e.target.value)}
                className="sf-input mt-1 block w-full text-sm"
              >
                <option value="">Choisir la personne / le pôle…</option>
                {returnTargets.map((t) => (
                  <option key={`${t.role}-${t.step_order}`} value={t.role}>
                    {validationStepLabel(t.role, t.label)}
                    {t.user_name ? ` — ${t.user_name}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={acting}
              onClick={() => onDecide(item.id, "approve", comment)}
              className="sf-btn-primary text-sm disabled:opacity-60"
            >
              Valider et transmettre
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() =>
                onDecide(item.id, "request-changes", comment, returnToRole)
              }
              className="sf-btn-secondary text-sm disabled:opacity-60"
            >
              Demander des modifications
            </button>
            <button
              type="button"
              disabled={acting}
              onClick={() => onDecide(item.id, "reject", comment, returnToRole)}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-800 hover:bg-red-50 disabled:opacity-60"
            >
              {returnTargets.length > 0 ? "Rejeter et renvoyer" : "Rejeter"}
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function CaseValidationsHub() {
  const { caseId, data } = useCaseDetail();
  const { user } = useAuth();
  const [items, setItems] = useState<ValidationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await apiRequest<ValidationRequest[]>(
        `/cases/${caseId}/validations/`,
      );
      setItems(list);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de charger les validations.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingForMe = useMemo(() => {
    if (!user) return [];
    return items.filter((item) => {
      if (!["PENDING", "IN_PROGRESS"].includes(item.status) || !item.current_step) {
        return false;
      }
      const role = item.current_step.assigned_role;
      if (user.is_superuser) return true;
      if (user.roles.includes(role)) return true;
      if (
        role === "AGENT_FIDUCIAIRE"
        && data?.assigned_to === user.id
      ) {
        return true;
      }
      return false;
    });
  }, [items, user, data?.assigned_to]);

  const history = useMemo(
    () => items.filter((item) => !pendingForMe.some((p) => p.id === item.id)),
    [items, pendingForMe],
  );

  async function submitRequest() {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest<ValidationRequest>(`/cases/${caseId}/validations/`, {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          summary: summary.trim(),
          subject_type: "CASE",
        }),
      });
      setTitle("");
      setSummary("");
      setShowForm(false);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de créer la demande.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function decide(
    id: number,
    action: "approve" | "reject" | "request-changes",
    comment: string,
    returnToRole?: string,
  ) {
    const item = items.find((i) => i.id === id);
    const targets = item?.return_targets ?? [];
    const role = (returnToRole ?? "").trim();
    if (
      (action === "reject" || action === "request-changes")
      && !comment.trim()
    ) {
      setError("Le motif est obligatoire pour rejeter ou demander des modifications.");
      return;
    }
    if (
      (action === "reject" || action === "request-changes")
      && targets.length > 0
      && !role
    ) {
      setError(
        "Sélectionnez la personne / le pôle concerné pour apporter les corrections.",
      );
      return;
    }
    setActing(true);
    setError(null);
    try {
      const path =
        action === "request-changes"
          ? `/validations/${id}/request-changes/`
          : `/validations/${id}/${action}/`;
      const body: { comment: string; return_to_role?: string } = {
        comment: comment.trim(),
      };
      if (role) body.return_to_role = role;
      await apiRequest(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action impossible.");
    } finally {
      setActing(false);
    }
  }

  const canCreate = userCanCreateValidation(user);

  const activeCircuit = useMemo(() => {
    const open = items.filter(
      (i) =>
        i.validation_type === "CASE_REVIEW" &&
        ["PENDING", "IN_PROGRESS"].includes(i.status),
    );
    return open[0] ?? items.find((i) => i.validation_type === "CASE_REVIEW") ?? null;
  }, [items]);

  const dossierValidationState = useMemo(() => {
    if (!activeCircuit) return null;
    return resolveWorkflowState(activeCircuit.steps, activeCircuit.status);
  }, [activeCircuit]);

  if (loading) return <LoadingState />;
  if (error && items.length === 0) return <ErrorAlert message={error} />;

  const caseStatusLabel = data?.status
    ? (CASE_STATUS_LABELS[data.status] ?? data.status)
    : null;

  return (
    <div className="space-y-8">
      {error ? <ErrorAlert message={error} /> : null}

      <PatrimoineSection
        title="Validations du dossier"
        description="Circuit obligatoire : chargé du dossier → direction → comité charaïque → juridique & conformité. Chaque intervenant valide avant de transmettre à l'étape suivante."
        action={
          canCreate ? (
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              className="sf-btn-primary text-sm"
            >
              {showForm ? "Fermer" : "+ Nouvelle demande"}
            </button>
          ) : null
        }
      >
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/40">
              Statut du dossier
            </p>
            <p className="mt-1 text-sm font-semibold text-[var(--sf-green-deep)]">
              {caseStatusLabel ?? "—"}
            </p>
            {data?.assigned_to_username ? (
              <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">
                Chargé : {data.assigned_to_username}
              </p>
            ) : null}
          </div>
          <div
            className={`rounded-xl border px-4 py-3 ${
              dossierValidationState
                ? stateBannerClass(dossierValidationState.tone)
                : "border-[var(--sf-cream-dark)] bg-white text-[var(--sf-green-deep)]"
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-60">
              Circuit dossier
            </p>
            {dossierValidationState && activeCircuit ? (
              <>
                <p className="mt-1 text-sm font-semibold">{dossierValidationState.title}</p>
                <p className="mt-0.5 text-xs opacity-80">{dossierValidationState.detail}</p>
              </>
            ) : (
              <p className="mt-1 text-sm font-semibold">Aucune validation de circuit en cours</p>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-xl border border-[var(--sf-cream-dark)] bg-white px-3 py-5 sm:px-6">
          <p className="mb-4 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/40">
            Circuit de validation du dossier
          </p>
          {activeCircuit ? (
            <WorkflowProgressBar
              steps={activeCircuit.steps}
              requestStatus={activeCircuit.status}
              currentUserCanAct={
                !!user
                && userCanActOnValidationStep(
                  user,
                  activeCircuit.validation_type,
                  activeCircuit.current_step?.assigned_role,
                  { caseAssignedTo: data?.assigned_to },
                )
              }
              showStateBanner={false}
            />
          ) : (
            <ol className="relative z-10 grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-2">
              {DOSSIER_WORKFLOW_STEPS.map((step) => (
                <li
                  key={step.role}
                  className="flex flex-col items-center px-1 py-1 text-center"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[var(--sf-cream-dark)] bg-white text-xs font-bold text-[var(--sf-green)]/45">
                    {step.order}
                  </span>
                  <p className="mt-2 text-[11px] font-semibold leading-tight text-[var(--sf-green-deep)] sm:text-xs">
                    {step.label}
                  </p>
                  <p className="mt-0.5 text-[10px] text-[var(--sf-green)]/45">À venir</p>
                </li>
              ))}
            </ol>
          )}
        </div>

        {showForm ? (
          <div className="mb-6 rounded-xl border border-[var(--sf-green)]/20 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
              Nouvelle demande de validation
            </h3>
            <p className="mt-1 text-xs text-[var(--sf-green)]/55">
              La demande sera adressée au chargé du dossier
              {data?.assigned_to_username ? ` (${data.assigned_to_username})` : ""}, puis transmise
              automatiquement aux étapes suivantes après chaque validation.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium text-[var(--sf-green)]/55">
                  Objet de la demande *
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="sf-input mt-1 w-full"
                  placeholder="Ex. Validation du mandat fiduciaire patrimonial"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--sf-green)]/55">
                  Contexte
                </label>
                <textarea
                  rows={3}
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="sf-input mt-1 w-full resize-y"
                  placeholder="Précisez ce qui doit être validé et les pièces concernées…"
                />
              </div>
              <button
                type="button"
                disabled={submitting || !title.trim()}
                onClick={() => void submitRequest()}
                className="sf-btn-primary text-sm disabled:opacity-60"
              >
                {submitting ? "Envoi…" : "Soumettre la demande"}
              </button>
            </div>
          </div>
        ) : null}
      </PatrimoineSection>

      {pendingForMe.length > 0 ? (
        <PatrimoineSection
          title="À traiter par vous"
          description="Demandes dont l'étape courante vous est assignée."
        >
          <div className="space-y-4">
            {pendingForMe.map((item) => (
              <ValidationCard
                key={item.id}
                item={item}
                canAct={userCanActOnValidationStep(
                  user,
                  item.validation_type,
                  item.current_step?.assigned_role,
                  { caseAssignedTo: data?.assigned_to },
                )}
                acting={acting}
                onDecide={decide}
                hideCircuit={
                  item.validation_type === "CASE_REVIEW"
                  && activeCircuit?.id === item.id
                }
              />
            ))}
          </div>
        </PatrimoineSection>
      ) : null}

      <PatrimoineSection
        title="Historique des demandes"
        description={
          items.length === 0
            ? "Aucune validation enregistrée pour ce dossier."
            : `${items.length} demande(s) — suivi complet du circuit.`
        }
      >
        {history.length === 0 && pendingForMe.length === 0 ? (
          <EmptyState
            title="Aucune validation"
            description="Créez une demande pour lancer le circuit de validation du dossier."
          />
        ) : (
          <div className="space-y-4">
            {history.map((item) => (
              <ValidationCard
                key={item.id}
                item={item}
                canAct={false}
                acting={acting}
                onDecide={decide}
                hideCircuit={
                  item.validation_type === "CASE_REVIEW"
                  && activeCircuit?.id === item.id
                }
              />
            ))}
          </div>
        )}
      </PatrimoineSection>
    </div>
  );
}
