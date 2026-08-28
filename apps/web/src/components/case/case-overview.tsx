"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AssetEvolutionCharts, ClientAssetCashflowCharts, GlobalPatrimoineEvolutionChart } from "@/components/case/asset-evolution-charts";
import { CaseOverviewFinanceSection } from "@/components/case/case-overview-finance";
import { StatusBadge } from "@/components/status-badge";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, apiRequest } from "@/lib/api";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  MANDATE_TYPE_LABELS,
  computePersonAge,
  formatDate,
  formatMoney,
  formatRelativeDate,
  STAKEHOLDER_ROLE_LABELS,
  VALUATION_FREQUENCY_LABELS,
  WAQF_TYPE_LABELS,
} from "@/lib/labels";
import {
  userCanManageCaseAssignment,
  userCanWriteCaseContent,
  userIsComiteCharaique,
} from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { useCaseDetail, useOptionalCaseDetail } from "@/providers/case-detail-provider";
import type {
  AssignableCaseAgent,
  CaseAssignment,
  FiduciaryCaseDetail,
} from "@/types/api";

function formatAssignmentPeriod(startedAt: string, endedAt: string | null): string {
  if (!endedAt) {
    return `Depuis le ${formatDate(startedAt)}`;
  }
  return `${formatDate(startedAt)} → ${formatDate(endedAt)}`;
}

function assignmentLabel(entry: CaseAssignment): string {
  return entry.display_name || entry.username;
}

function CaseAssignmentSettingsModal({
  data,
  open,
  onClose,
}: {
  data: FiduciaryCaseDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { reload } = useCaseDetail();
  const history = data.assignment_history ?? [];
  const current =
    history.find((a) => a.is_current) ??
    (history.length > 0 && !history[0].ended_at ? history[0] : null);
  const isLocked = data.status === "CLOSED" || data.status === "REJECTED";

  const [agents, setAgents] = useState<AssignableCaseAgent[]>([]);
  const [selectedId, setSelectedId] = useState<string>(
    data.assigned_to != null ? String(data.assigned_to) : "",
  );
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSelectedId(data.assigned_to != null ? String(data.assigned_to) : "");
    setError(null);
    setSuccess(null);
  }, [open, data.assigned_to]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadAgents() {
      setLoadingAgents(true);
      setError(null);
      try {
        const list = await apiRequest<AssignableCaseAgent[]>(
          `/cases/${data.id}/assignable-agents/`,
        );
        if (!cancelled) setAgents(list);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Impossible de charger la liste des agents.",
          );
        }
      } finally {
        if (!cancelled) setLoadingAgents(false);
      }
    }
    void loadAgents();
    return () => {
      cancelled = true;
    };
  }, [open, data.id]);

  const dirty =
    (selectedId || "") !== (data.assigned_to != null ? String(data.assigned_to) : "");

  async function saveAssignment() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest<FiduciaryCaseDetail>(`/cases/${data.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          assigned_to: selectedId ? Number(selectedId) : null,
        }),
      });
      setSuccess(
        selectedId
          ? "Chargé de dossier mis à jour."
          : "Chargé de dossier retiré.",
      );
      await reload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer l'affectation.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-assignment-modal-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--sf-cream-dark)] bg-white px-5 py-4">
          <div>
            <h2
              id="case-assignment-modal-title"
              className="text-base font-semibold text-[var(--sf-green-deep)]"
            >
              Paramètres — chargé de dossier
            </h2>
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
              Affecter, modifier ou consulter l&apos;historique
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md p-1 text-[var(--sf-green)]/50 transition hover:bg-[var(--sf-cream)]/60 hover:text-[var(--sf-green-deep)] disabled:opacity-50"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {error ? <ErrorAlert message={error} /> : null}
          {success ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              {success}
            </p>
          ) : null}

          <div>
            <label className="block text-xs font-medium text-[var(--sf-green)]/55">
              Chargé de dossier
            </label>
            {current ? (
              <p className="mt-1 text-sm text-[var(--sf-green-deep)]">
                Actuel :{" "}
                <span className="font-semibold">{assignmentLabel(current)}</span>
                <span className="ml-2 text-xs text-[var(--sf-green)]/50">
                  ({formatAssignmentPeriod(current.started_at, current.ended_at)})
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-[var(--sf-green)]/50">
                Aucun chargé assigné pour le moment.
              </p>
            )}

            {isLocked ? (
              <p className="mt-3 text-xs text-[var(--sf-green)]/45">
                Dossier verrouillé — l&apos;affectation ne peut plus être modifiée.
              </p>
            ) : (
              <div className="mt-3 space-y-3">
                <select
                  className="sf-input w-full text-sm"
                  value={selectedId}
                  disabled={loadingAgents || saving}
                  onChange={(e) => {
                    setSelectedId(e.target.value);
                    setSuccess(null);
                  }}
                >
                  <option value="">— Aucun chargé —</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.display_name}
                      {agent.email ? ` (${agent.email})` : ""}
                    </option>
                  ))}
                </select>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onClose}
                    className="sf-btn-secondary text-sm disabled:opacity-60"
                  >
                    Fermer
                  </button>
                  <button
                    type="button"
                    disabled={!dirty || saving || loadingAgents}
                    onClick={() => void saveAssignment()}
                    className="sf-btn-primary text-sm disabled:opacity-60"
                  >
                    {saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/45">
              Historique des chargés
            </p>
            {history.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--sf-green)]/50">
                Aucun historique d&apos;affectation.
              </p>
            ) : (
              <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                {history.map((entry) => (
                  <li
                    key={entry.id}
                    className={`rounded-lg border px-3 py-2.5 text-sm ${
                      entry.is_current
                        ? "border-[var(--sf-green)]/25 bg-[var(--sf-cream)]/50"
                        : "border-[var(--sf-cream-dark)] bg-white"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-[var(--sf-green-deep)]">
                          {assignmentLabel(entry)}
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">
                          {formatAssignmentPeriod(entry.started_at, entry.ended_at)}
                        </p>
                        {entry.assigned_by_name || entry.assigned_by_username ? (
                          <p className="mt-0.5 text-[10px] text-[var(--sf-green)]/45">
                            Affecté par{" "}
                            {entry.assigned_by_name || entry.assigned_by_username}
                          </p>
                        ) : null}
                      </div>
                      {entry.is_current ? (
                        <span className="rounded-full bg-[var(--sf-green)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--sf-green-mid)]">
                          En cours
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CaseManagerCard({
  data,
  canManage,
}: {
  data: FiduciaryCaseDetail;
  canManage: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const history = data.assignment_history ?? [];
  const current =
    history.find((a) => a.is_current) ??
    (history.length > 0 && !history[0].ended_at ? history[0] : null);
  const pastCount = history.filter((a) => !a.is_current && a.ended_at).length;

  return (
    <>
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
            Chargé du dossier
          </h2>
          {canManage ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--sf-green-mid)] transition hover:border-[var(--sf-green)]/30 hover:bg-[var(--sf-cream)]/40"
            >
              Gérer
            </button>
          ) : null}
        </div>

        {current ? (
          <div className="mt-4 rounded-lg border border-[var(--sf-green)]/15 bg-[var(--sf-cream)]/40 px-3 py-3">
            <p className="text-lg font-semibold text-[var(--sf-green-deep)]">
              {assignmentLabel(current)}
            </p>
            <p className="mt-1 text-sm text-[var(--sf-green)]/60">
              {formatAssignmentPeriod(current.started_at, current.ended_at)}
            </p>
            {current.assigned_by_name || current.assigned_by_username ? (
              <p className="mt-1 text-xs text-[var(--sf-green)]/45">
                Affecté par {current.assigned_by_name || current.assigned_by_username}
              </p>
            ) : null}
            <span className="mt-2 inline-flex rounded-full bg-[var(--sf-green)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--sf-green-mid)]">
              En cours
            </span>
          </div>
        ) : (
          <p className="mt-3 text-sm text-[var(--sf-green)]/50">
            Aucun chargé de dossier assigné pour le moment.
            {canManage ? " Utilisez Gérer pour en affecter un." : null}
          </p>
        )}

        {pastCount > 0 ? (
          <p className="mt-3 text-xs text-[var(--sf-green)]/45">
            {pastCount} ancien{pastCount > 1 ? "s" : ""} chargé
            {pastCount > 1 ? "s" : ""} dans l&apos;historique
            {canManage ? " — voir Gérer" : ""}.
          </p>
        ) : null}
      </Card>

      {canManage ? (
        <CaseAssignmentSettingsModal
          data={data}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}

function InfoRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/45">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[var(--sf-green-deep)]">{children}</dd>
    </div>
  );
}

function CaseDossierSummary({
  data,
  base,
  patrimoineEstimate,
  canWrite,
}: {
  data: FiduciaryCaseDetail;
  base: string;
  patrimoineEstimate: string | null;
  canWrite: boolean;
}) {
  const typeLabel = data.case_type
    ? CASE_TYPE_LABELS[data.case_type] ?? data.case_type
    : "—";
  const statusLabel = CASE_STATUS_LABELS[data.status] ?? data.status;
  const minorCount = data.beneficiaries.filter((b) => b.is_minor).length;
  const withGuardian = data.beneficiaries.filter((b) => b.guardian_name).length;
  const overdueAssets = data.assets.filter((a) => a.valuation_overdue);
  const donorNames = data.donors
    .map((d) => `${d.first_name} ${d.last_name}`.trim())
    .filter(Boolean);
  const mandateLines = data.mandates.map((m) => {
    const type = MANDATE_TYPE_LABELS[m.mandate_type] ?? m.mandate_type;
    return m.reference_number ? `${m.title} (${m.reference_number}) · ${type}` : `${m.title} · ${type}`;
  });
  const beneficiaryNames = data.beneficiaries
    .map((b) => {
      const name = `${b.first_name} ${b.last_name}`.trim();
      const age = computePersonAge(b.date_of_birth);
      const share =
        b.patrimony_share_percent != null && b.patrimony_share_percent !== ""
          ? `${Number(b.patrimony_share_percent).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`
          : null;
      const parts = [name, age, share].filter(Boolean);
      return parts.join(" · ");
    })
    .filter(Boolean);

  const onboardingData = data.onboarding?.onboarding_data ?? {};
  const waqfType =
    typeof onboardingData.waqf_type === "string"
      ? WAQF_TYPE_LABELS[onboardingData.waqf_type] ?? onboardingData.waqf_type
      : null;
  const waqfObject =
    typeof onboardingData.waqf_object === "string" ? onboardingData.waqf_object.trim() : "";
  const waqfRules =
    typeof onboardingData.waqf_distribution_rules === "string"
      ? onboardingData.waqf_distribution_rules.trim()
      : "";

  const pendingTasks = data.onboarding?.pending_tasks?.filter(
    (t) => t.status === "pending" && t.required,
  );

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
        Informations du dossier
      </h2>
      <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
        Vue consolidée de l&apos;ensemble du dossier
      </p>

      <dl className="mt-5 grid gap-5 sm:grid-cols-2">
        <InfoRow label="Référence">
          <span className="font-mono text-[var(--sf-green)]">{data.reference}</span>
        </InfoRow>
        <InfoRow label="Type de dossier">{typeLabel}</InfoRow>
        <InfoRow label="Statut">{statusLabel}</InfoRow>
        <InfoRow label="Chargé de dossier (actuel)">
          {(() => {
            const cur = data.assignment_history?.find((a) => a.is_current);
            if (cur) {
              return (
                <>
                  <span className="font-medium">{assignmentLabel(cur)}</span>
                  <span className="mt-0.5 block text-xs text-[var(--sf-green)]/55">
                    {formatAssignmentPeriod(cur.started_at, cur.ended_at)}
                  </span>
                </>
              );
            }
            return data.assigned_to_username ?? (
              <span className="text-[var(--sf-green)]/45">Non assigné</span>
            );
          })()}
        </InfoRow>
        <InfoRow label="Titre du dossier" className="sm:col-span-2">
          {data.title}
        </InfoRow>

        <InfoRow label="Patrimoine estimé">
          {patrimoineEstimate ? (
            canWrite ? (
              <Link href={`${base}/patrimoine`} className="font-medium hover:underline">
                {patrimoineEstimate}
              </Link>
            ) : (
              <span className="font-medium">{patrimoineEstimate}</span>
            )
          ) : (
            <span className="text-[var(--sf-green)]/45">Non valorisé</span>
          )}
        </InfoRow>
        <InfoRow label="Actifs">
          {data.assets.length === 0 ? (
            <span className="text-[var(--sf-green)]/45">Aucun actif</span>
          ) : (
            <>
              {data.assets.length} actif{data.assets.length > 1 ? "s" : ""}
              {overdueAssets.length > 0 ? (
                <span className="mt-1 block text-xs text-red-800">
                  {overdueAssets.length} réévaluation
                  {overdueAssets.length > 1 ? "s" : ""} en retard
                </span>
              ) : null}
            </>
          )}
        </InfoRow>

        <InfoRow label="Donateur(s)" className="sm:col-span-2">
          {donorNames.length === 0 ? (
            <span className="text-[var(--sf-green)]/45">Aucun donateur enregistré</span>
          ) : (
            <ul className="list-inside list-disc space-y-0.5 text-[var(--sf-green)]/80">
              {donorNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </InfoRow>

        <InfoRow label="Héritiers / bénéficiaires" className="sm:col-span-2">
          {data.beneficiaries.length === 0 ? (
            <span className="text-[var(--sf-green)]/45">Aucun bénéficiaire</span>
          ) : (
            <>
              <p>
                {data.beneficiaries.length} personne
                {data.beneficiaries.length > 1 ? "s" : ""}
                {minorCount > 0
                  ? ` · ${minorCount} mineur${minorCount > 1 ? "s" : ""}`
                  : ""}
                {withGuardian > 0
                  ? ` · ${withGuardian} avec tuteur`
                  : ""}
              </p>
              {beneficiaryNames.length > 0 ? (
                <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-xs text-[var(--sf-green)]/65">
                  {beneficiaryNames.slice(0, 8).map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                  {beneficiaryNames.length > 8 ? (
                    <li>+ {beneficiaryNames.length - 8} autre(s)</li>
                  ) : null}
                </ul>
              ) : null}
            </>
          )}
        </InfoRow>

        <InfoRow label="Mandat(s)" className="sm:col-span-2">
          {mandateLines.length === 0 ? (
            <span className="text-[var(--sf-green)]/45">Aucun mandat</span>
          ) : (
            <ul className="list-inside list-disc space-y-0.5 text-[var(--sf-green)]/80">
              {mandateLines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </InfoRow>

        <InfoRow label="Tuteurs (fiche)">
          {data.guardians.length === 0 ? (
            <span className="text-[var(--sf-green)]/45">—</span>
          ) : (
            <ul className="text-[var(--sf-green)]/80">
              {data.guardians.map((g) => (
                <li key={g.id}>
                  {g.first_name} {g.last_name}
                </li>
              ))}
            </ul>
          )}
        </InfoRow>

        <InfoRow label="Parties prenantes" className="sm:col-span-2">
          {data.stakeholders.length === 0 ? (
            <span className="text-[var(--sf-green)]/45">Aucune partie enregistrée</span>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {data.stakeholders.map((s) => (
                <li
                  key={s.id}
                  className="rounded-full border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/50 px-2.5 py-1 text-xs"
                >
                  <span className="font-medium">{s.username}</span>
                  <span className="text-[var(--sf-green)]/50">
                    {" "}
                    · {STAKEHOLDER_ROLE_LABELS[s.role] ?? s.role}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </InfoRow>

        {(waqfType || waqfObject || waqfRules) && (
          <>
            <InfoRow label="Waqf" className="sm:col-span-2">
              {waqfType ?? "—"}
            </InfoRow>
            {waqfObject ? (
              <InfoRow label="Objet du waqf" className="sm:col-span-2">
                <p className="line-clamp-3 text-[var(--sf-green)]/75">{waqfObject}</p>
              </InfoRow>
            ) : null}
            {waqfRules ? (
              <InfoRow label="Règles de distribution" className="sm:col-span-2">
                <p className="line-clamp-3 text-[var(--sf-green)]/75">{waqfRules}</p>
              </InfoRow>
            ) : null}
          </>
        )}

        {data.status === "DRAFT" && pendingTasks && pendingTasks.length > 0 ? (
          <InfoRow label="Enregistrement — à compléter" className="sm:col-span-2">
            <ul className="mt-1 space-y-1 text-xs text-amber-900/90">
              {pendingTasks.map((t) => (
                <li key={t.id}>· {t.label}</li>
              ))}
            </ul>
            {canWrite ? (
              <Link
                href={`${base}/enregistrement`}
                className="mt-2 inline-flex text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
              >
                Poursuivre l&apos;enregistrement →
              </Link>
            ) : null}
          </InfoRow>
        ) : null}

        {data.assets.some((a) => a.valuation_next_due) ? (
          <InfoRow label="Prochaines réévaluations" className="sm:col-span-2">
            <ul className="space-y-1 text-xs text-[var(--sf-green)]/70">
              {data.assets
                .filter((a) => a.valuation_next_due)
                .slice(0, 6)
                .map((a) => (
                  <li key={a.id} className="flex flex-wrap justify-between gap-2">
                    <span>{a.label}</span>
                    <span
                      className={
                        a.valuation_overdue ? "font-medium text-red-800" : "text-[var(--sf-green)]/50"
                      }
                    >
                      {formatDate(a.valuation_next_due!)}
                      {" · "}
                      {VALUATION_FREQUENCY_LABELS[a.valuation_frequency] ??
                        a.valuation_frequency}
                    </span>
                  </li>
                ))}
            </ul>
          </InfoRow>
        ) : null}
      </dl>
    </Card>
  );
}

function StatCard({
  label,
  value,
  href,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  href?: string | null;
  hint?: string;
  accent?: "green" | "gold" | "slate";
}) {
  const ring =
    accent === "gold"
      ? "hover:border-[var(--sf-gold)]/40"
      : accent === "slate"
        ? "hover:border-slate-300"
        : "hover:border-[var(--sf-green-mid)]/30";

  const className = `group flex flex-col rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm ${
    href ? `transition hover:shadow-md ${ring}` : ""
  }`;

  const body = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/50">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight text-[var(--sf-green-deep)] ${
          href ? "group-hover:text-[var(--sf-green)]" : ""
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-[var(--sf-green)]/45">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}

function OnboardingProgressCard({
  data,
  base,
  canWrite,
}: {
  data: FiduciaryCaseDetail;
  base: string;
  canWrite: boolean;
}) {
  const onboarding = data.onboarding;
  if (!onboarding || data.status !== "DRAFT") return null;

  const steps = onboarding.steps ?? [];
  const completed = steps.filter((s) => s.status === "completed").length;
  const total = steps.length || 1;
  const pct = Math.round((completed / total) * 100);
  const pending = onboarding.pending_tasks ?? [];

  return (
    <Card className="border-amber-200/80 bg-gradient-to-br from-amber-50/90 to-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-amber-950">Enregistrement</h2>
          <p className="mt-1 text-xs text-amber-900/70">
            {completed} / {total} étapes complétées
            {pending.length > 0
              ? ` · ${pending.length} tâche${pending.length > 1 ? "s" : ""} restante${pending.length > 1 ? "s" : ""}`
              : ""}
          </p>
        </div>
        {canWrite ? (
          <Link
            href={`${base}/enregistrement?step=${encodeURIComponent(
              data.onboarding_step === "identification" ? "donor" : data.onboarding_step || "donor",
            )}`}
            className="sf-btn-gold shrink-0 text-xs"
          >
            Poursuivre →
          </Link>
        ) : null}
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-amber-100">
        <div
          className="h-full rounded-full bg-[var(--sf-gold)] transition-all duration-500"
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemin={0}
          aria-valuemax={total}
        />
      </div>
      {onboarding.current_step ? (
        <p className="mt-2 text-xs text-amber-900/65">
          Étape courante :{" "}
          <span className="font-medium">
            {steps.find((s) => s.id === onboarding.current_step)?.label ??
              onboarding.current_step}
          </span>
        </p>
      ) : null}
    </Card>
  );
}

export function CaseOverview({
  data,
  variant = "internal",
}: {
  data: FiduciaryCaseDetail;
  /** Portail client : même vue, sans finance ni actions d'édition. */
  variant?: "internal" | "client";
}) {
  const { user } = useAuth();
  const caseCtx = useOptionalCaseDetail();
  const isClient = variant === "client";
  const canWrite = !isClient && userCanWriteCaseContent(user, data.status);
  const canManageAssignment = !isClient && userCanManageCaseAssignment(user);
  const isLocked = data.status === "CLOSED" || data.status === "REJECTED";
  const base = caseCtx?.navBase ?? `/dossiers/${data.id}`;
  const primaryDonor = data.donors[0];
  const showSuccessionStat =
    !isClient &&
    data.case_type === "SUCCESSION" &&
    userIsComiteCharaique(user);

  const patrimoineEstimate = useMemo(() => {
    let sum = 0;
    for (const a of data.assets) {
      if (a.latest_value) {
        const n = Number(a.latest_value);
        if (!Number.isNaN(n)) sum += n;
      }
    }
    return sum > 0 ? formatMoney(String(sum)) : null;
  }, [data.assets]);

  const successionState =
    data.case_type === "SUCCESSION"
      ? (data.onboarding?.onboarding_data?.succession as Record<string, unknown> | undefined)
      : undefined;
  const successionDone = successionState?.faraidCompleted === true;

  const stats = [
    {
      label: "Mandats",
      value: data.mandates.length,
      href: isClient ? null : `${base}/mandat`,
    },
    {
      label: "Bénéficiaires",
      value: data.beneficiaries.length,
      href: isClient ? null : `${base}/beneficiaires`,
    },
    {
      label: "Avec tuteur",
      value: data.beneficiaries.filter((b) => b.guardian_name).length,
      href: isClient ? null : `${base}/beneficiaires`,
      hint: `${data.beneficiaries.length} héritier${data.beneficiaries.length > 1 ? "s" : ""}`,
    },
    {
      label: "Actifs",
      value: data.assets.length,
      href: isClient ? null : `${base}/patrimoine`,
      hint: patrimoineEstimate ?? undefined,
    },
    {
      label: "Parties",
      value: data.stakeholders.length,
      href: isClient ? null : `${base}/mandat`,
      hint: "Prenantes",
    },
    ...(showSuccessionStat
      ? [
          {
            label: "Farāʾiḍ",
            value: successionDone ? "OK" : "—",
            href: `${base}/succession/synthese`,
            hint: "Évaluation & partage",
          },
        ]
      : []),
  ];

  const typeLabel = data.case_type
    ? CASE_TYPE_LABELS[data.case_type] ?? data.case_type
    : null;

  return (
    <div className="space-y-6">
      {isLocked && !isClient ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            data.status === "CLOSED"
              ? "border-slate-200 bg-slate-50 text-slate-700"
              : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          <p className="font-semibold">
            {data.status === "CLOSED"
              ? "Dossier clôturé — consultation seule"
              : "Dossier rejeté — consultation seule"}
          </p>
          <p className="mt-0.5 text-xs opacity-80">
            Aucune modification n&apos;est possible (patrimoine, bénéficiaires, finance,
            investissements, documents).
          </p>
        </div>
      ) : null}

      {/* Bandeau contexte */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--sf-green)]/12 bg-gradient-to-br from-[var(--sf-cream)] via-white to-[var(--sf-cream)]/40 px-5 py-6 shadow-sm sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[var(--sf-gold)]/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            {typeLabel ? (
              <span className="inline-flex rounded-full bg-[var(--sf-green)]/8 px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--sf-green-mid)]">
                {typeLabel}
              </span>
            ) : null}
            <h1 className="sf-display mt-2 text-2xl font-semibold text-[var(--sf-green-deep)] sm:text-3xl">
              {data.title}
            </h1>
            <p className="mt-1 font-mono text-sm text-[var(--sf-green)]/45">{data.reference}</p>
            {data.description ? (
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--sf-green)]/70">
                {data.description}
              </p>
            ) : (
              <p className="mt-3 text-sm text-[var(--sf-green)]/45">
                {isClient
                  ? "Aucune description renseignée pour ce dossier."
                  : "Aucune description — vous pouvez en ajouter depuis l'enregistrement."}
              </p>
            )}
            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--sf-green)]/55">
              <div>
                <dt className="inline">Créé </dt>
                <dd className="inline font-medium text-[var(--sf-green-deep)]">
                  {formatDate(data.created_at)} · {data.created_by_username}
                </dd>
              </div>
              <div>
                <dt className="inline">Modifié </dt>
                <dd className="inline font-medium text-[var(--sf-green-deep)]">
                  {formatRelativeDate(data.updated_at)}
                </dd>
              </div>
            </dl>
          </div>
          <StatusBadge status={data.status} />
        </div>
      </section>

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {stats.map((s) => (
          <StatCard
            key={s.label}
            label={s.label}
            value={s.value}
            href={s.href}
            hint={s.hint}
            accent={s.value === 0 ? "slate" : "green"}
          />
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <OnboardingProgressCard data={data} base={base} canWrite={canWrite} />

          <div className="grid gap-6 sm:grid-cols-2">
            <Card className="p-5">
              <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                {data.case_type === "SUCCESSION" ? "Le défunt" : "Donateur"}
              </h2>
              {primaryDonor ? (
                <div className="mt-3">
                  <p className="text-lg font-semibold text-[var(--sf-green-deep)]">
                    {primaryDonor.first_name} {primaryDonor.last_name}
                  </p>
                  <ul className="mt-3 space-y-1.5 text-sm text-[var(--sf-green)]/65">
                    {primaryDonor.phone ? <li>{primaryDonor.phone}</li> : null}
                    {primaryDonor.email ? <li>{primaryDonor.email}</li> : null}
                    {primaryDonor.nationality ? (
                      <li>Nationalité : {primaryDonor.nationality}</li>
                    ) : null}
                  </ul>
                  {primaryDonor.trusted_persons.length > 0 ? (
                    <div className="mt-4 border-t border-[var(--sf-cream-dark)] pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--sf-green)]/45">
                        {data.case_type === "SUCCESSION"
                          ? "Témoins"
                          : "Personnes de confiance"}
                        <span className="ml-1 font-normal normal-case tracking-normal text-[var(--sf-green)]/40">
                          ({primaryDonor.trusted_persons.length})
                        </span>
                      </p>
                      <ul className="mt-2 space-y-2">
                        {primaryDonor.trusted_persons.map((person) => (
                          <li
                            key={person.id}
                            className="rounded-lg bg-[var(--sf-cream)]/50 px-3 py-2 text-sm"
                          >
                            <p className="font-medium text-[var(--sf-green-deep)]">
                              {person.first_name} {person.last_name}
                            </p>
                            {person.relationship_label ? (
                              <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">
                                {person.relationship_label}
                              </p>
                            ) : null}
                            <p className="mt-1 text-xs text-[var(--sf-green)]/60">
                              {[person.phone, person.email].filter(Boolean).join(" · ")}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="mt-3 text-sm text-[var(--sf-green)]/50">
                  Non renseigné.
                  {canWrite ? (
                    <>
                      {" "}
                      <Link
                        href={`${base}/enregistrement?step=donor`}
                        className="font-medium text-[var(--sf-green-mid)] hover:underline"
                      >
                        Compléter →
                      </Link>
                    </>
                  ) : null}
                </p>
              )}
            </Card>

            <CaseManagerCard data={data} canManage={canManageAssignment} />
          </div>

          <CaseDossierSummary
            data={data}
            base={base}
            patrimoineEstimate={patrimoineEstimate}
            canWrite={canWrite}
          />
        </div>

        <Card className="lg:col-span-2 lg:self-start">
          <div className="border-b border-[var(--sf-cream-dark)] px-5 py-4 sm:px-6">
            <h2 className="font-semibold text-[var(--sf-green-deep)]">
              Évolution du patrimoine
            </h2>
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
              12 derniers mois ou depuis le début — au moins deux valorisations pour une courbe
            </p>
          </div>
          <div className="px-5 py-4 sm:px-6">
            {isClient ? (
              <GlobalPatrimoineEvolutionChart assets={data.assets} />
            ) : (
              <AssetEvolutionCharts assets={data.assets} caseId={data.id} />
            )}
          </div>

          <div className="border-t border-[var(--sf-cream-dark)] px-5 py-4 sm:px-6">
            {isClient ? (
              <>
                <h2 className="font-semibold text-[var(--sf-green-deep)]">
                  Recettes et dépenses par bien
                </h2>
                <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                  Courbes mensuelles séparées pour chaque actif du dossier
                </p>
                <div className="mt-4">
                  <ClientAssetCashflowCharts assets={data.assets} navBase={base} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-[var(--sf-green-deep)]">Activité récente</h2>
                  {data.timeline_events.length > 0 ? (
                    <Link
                      href={`${base}/timeline`}
                      className="text-xs font-medium text-[var(--sf-green-mid)] hover:text-[var(--sf-green)]"
                    >
                      Tout voir →
                    </Link>
                  ) : null}
                </div>
                {data.timeline_events.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--sf-green)]/55">
                    Aucun événement pour l&apos;instant.
                  </p>
                ) : (
                  <ol className="relative mt-2 space-y-0">
                    {data.timeline_events.slice(0, 8).map((ev, i) => (
                      <li key={ev.id} className="relative flex gap-4 pb-6 last:pb-0">
                        {i < Math.min(data.timeline_events.length, 8) - 1 ? (
                          <span
                            className="absolute left-[7px] top-4 h-full w-px bg-[var(--sf-cream-dark)]"
                            aria-hidden
                          />
                        ) : null}
                        <span
                          className="relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-[var(--sf-gold)] bg-white"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 pt-0.5">
                          <p className="text-sm leading-snug text-[var(--sf-green-deep)]">
                            {ev.message}
                          </p>
                          <p className="mt-1 text-xs text-[var(--sf-green)]/50">
                            {formatRelativeDate(ev.created_at)}
                            {ev.actor_username ? ` · ${ev.actor_username}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {!isClient ? (
        <CaseOverviewFinanceSection caseId={data.id} caseType={data.case_type} />
      ) : null}
    </div>
  );
}
