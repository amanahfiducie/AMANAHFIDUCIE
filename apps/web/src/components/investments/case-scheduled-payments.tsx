"use client";

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";

import { DashboardPanel } from "@/components/investments/investment-charts";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, apiRequest } from "@/lib/api";
import {
  formatAmountInput,
  formatDate,
  formatMoney,
  parseAmountInput,
} from "@/lib/labels";
import { userCanWriteCase } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type {
  CaseBeneficiaryCapital,
  CaseInvestmentPolicy,
  ScheduledPayment,
} from "@/types/api";

const fieldClass =
  "mt-1.5 w-full rounded-lg border border-[var(--sf-cream-dark)] bg-white px-3.5 py-2.5 text-sm text-[var(--sf-green-deep)] outline-none transition focus:border-[var(--sf-green)]/40 focus:ring-2 focus:ring-[var(--sf-green)]/10 disabled:cursor-not-allowed disabled:bg-[var(--sf-cream)]/40";

type ModalMode = "add" | "view" | "edit";

type BeneficiaryOption = {
  beneficiary_id: number;
  display_name: string;
};

export function createEmptyPayment(): ScheduledPayment {
  return {
    id: `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    label: "",
    status: "PAID",
    notes: "",
    paid_at: new Date().toISOString().slice(0, 10),
    beneficiary_id: null,
    beneficiary_name: null,
  };
}

export function normalizePayments(rows: ScheduledPayment[]): ScheduledPayment[] {
  return rows.map((row, index) => ({
    id: row.id || `pay-legacy-${index}`,
    date: row.date ?? "",
    amount: String(row.amount ?? "").replace(/\s/g, ""),
    label: row.label ?? "",
    status: row.status === "PENDING" ? "PENDING" : "PAID",
    notes: row.notes ?? "",
    paid_at: row.paid_at ?? (row.status === "PAID" ? row.date : null),
    beneficiary_id: row.beneficiary_id ?? null,
    beneficiary_name: row.beneficiary_name ?? null,
  }));
}

export function sortPaymentsNewestFirst(
  rows: ScheduledPayment[],
): ScheduledPayment[] {
  return [...rows].sort((a, b) => {
    const da = a.date || "";
    const db = b.date || "";
    if (da !== db) return db.localeCompare(da);
    return String(b.id ?? "").localeCompare(String(a.id ?? ""));
  });
}

export function paymentsReadyToSave(
  rows: ScheduledPayment[],
): ScheduledPayment[] {
  return normalizePayments(rows)
    .filter((p) => p.date && p.amount && p.label)
    .map((p) => ({
      ...p,
      amount: parseAmountInput(p.amount) || p.amount,
      paid_at: p.status === "PAID" ? p.paid_at || p.date : null,
    }));
}

const STATUS_LABELS: Record<ScheduledPayment["status"], string> = {
  PENDING: "En attente",
  PAID: "Versé",
};

function statusBadgeClass(status: ScheduledPayment["status"]): string {
  return status === "PAID"
    ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
    : "bg-amber-50 text-amber-900 ring-amber-200";
}

/** Aperçu lecture seule (Gestion — 5 derniers). */
export function ScheduledPaymentsPreview({
  caseId,
  payments,
  limit = 5,
}: {
  caseId: number;
  payments: ScheduledPayment[];
  limit?: number;
}) {
  const sorted = sortPaymentsNewestFirst(normalizePayments(payments));
  const visible = sorted.slice(0, limit);
  const hasMore = sorted.length > limit;
  const totalPaid = sorted
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  return (
    <DashboardPanel
      title="Versements clients"
      subtitle={
        sorted.length === 0
          ? "Aucune somme versée"
          : `${sorted.length} versement(s) · Total versé ${formatMoney(String(totalPaid), "XOF")}`
      }
      action={
        <Link
          href={`/dossiers/${caseId}/finance/versements`}
          className="text-xs font-medium text-[var(--sf-green)] hover:underline"
        >
          {hasMore || sorted.length > 0 ? "Voir tout →" : "Gérer →"}
        </Link>
      }
    >
      {visible.length === 0 ? (
        <div className="rounded-lg bg-[var(--sf-cream)]/25 px-4 py-6 text-center text-sm text-[var(--sf-green)]/45">
          Aucun versement client.{" "}
          <Link
            href={`/dossiers/${caseId}/finance/versements`}
            className="font-medium text-[var(--sf-green)] underline-offset-2 hover:underline"
          >
            Enregistrer une somme versée
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--sf-cream-dark)] text-xs uppercase tracking-wide text-[var(--sf-green)]/45">
                <th className="pb-2 pr-3 font-medium">Date</th>
                <th className="pb-2 pr-3 font-medium">Client</th>
                <th className="pb-2 pr-3 font-medium">Montant</th>
                <th className="pb-2 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sf-cream-dark)]">
              {visible.map((row) => (
                <tr key={row.id}>
                  <td className="py-2.5 pr-3 text-[var(--sf-green)]/70">
                    {row.date ? formatDate(row.date) : "—"}
                  </td>
                  <td className="py-2.5 pr-3 font-medium text-[var(--sf-green-deep)]">
                    {row.beneficiary_name || row.label || "—"}
                  </td>
                  <td className="py-2.5 pr-3 tabular-nums text-emerald-900">
                    {row.amount ? formatMoney(row.amount, "XOF") : "—"}
                  </td>
                  <td className="py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(row.status)}`}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {hasMore ? (
        <p className="mt-3 text-center text-xs text-[var(--sf-green)]/45">
          +{sorted.length - limit} autre(s) —{" "}
          <Link
            href={`/dossiers/${caseId}/finance/versements`}
            className="font-medium text-[var(--sf-green)] hover:underline"
          >
            page dédiée
          </Link>
        </p>
      ) : null}
    </DashboardPanel>
  );
}

function PaymentModal({
  open,
  mode,
  draft,
  beneficiaries,
  busy,
  error,
  canWrite,
  onClose,
  onChange,
  onStartEdit,
  onSave,
  onDelete,
}: {
  open: boolean;
  mode: ModalMode;
  draft: ScheduledPayment | null;
  beneficiaries: BeneficiaryOption[];
  busy: boolean;
  error: string | null;
  canWrite: boolean;
  onClose: () => void;
  onChange: (next: ScheduledPayment) => void;
  onStartEdit: () => void;
  onSave: () => void;
  onDelete?: () => void;
}) {
  const titleId = useId();
  if (!open || !draft) return null;

  const readOnly = mode === "view";
  const title =
    mode === "add"
      ? "Nouveau versement client"
      : mode === "edit"
        ? "Modifier le versement"
        : "Détail du versement";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--sf-cream-dark)] px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-lg font-semibold text-[var(--sf-green-deep)]"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
              Somme versée par le client pour investir
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--sf-green)]/55 hover:bg-[var(--sf-cream)]/50"
          >
            Fermer
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <label className="block text-xs">
            <span className="font-medium text-[var(--sf-green)]/55">
              Client *
            </span>
            <select
              required
              disabled={readOnly || busy || beneficiaries.length === 0}
              value={draft.beneficiary_id ? String(draft.beneficiary_id) : ""}
              onChange={(e) => {
                const id = e.target.value ? Number(e.target.value) : null;
                const found = beneficiaries.find((b) => b.beneficiary_id === id);
                onChange({
                  ...draft,
                  beneficiary_id: id,
                  beneficiary_name: found?.display_name ?? null,
                  label:
                    draft.label && draft.label !== draft.beneficiary_name
                      ? draft.label
                      : found?.display_name || draft.label,
                });
              }}
              className={fieldClass}
            >
              <option value="">— Choisir le client —</option>
              {beneficiaries.map((b) => (
                <option key={b.beneficiary_id} value={b.beneficiary_id}>
                  {b.display_name}
                </option>
              ))}
            </select>
            {beneficiaries.length === 0 ? (
              <p className="mt-1 text-xs text-amber-800">
                Aucun client sur ce dossier. Ajoutez un bénéficiaire avant
                d&apos;enregistrer un versement.
              </p>
            ) : null}
          </label>

          <label className="block text-xs">
            <span className="font-medium text-[var(--sf-green)]/55">
              Date du versement *
            </span>
            <input
              type="date"
              required
              disabled={readOnly || busy}
              value={draft.date}
              onChange={(e) =>
                onChange({
                  ...draft,
                  date: e.target.value,
                  paid_at:
                    draft.status === "PAID"
                      ? e.target.value
                      : draft.paid_at,
                })
              }
              className={fieldClass}
            />
          </label>

          <label className="block text-xs">
            <span className="font-medium text-[var(--sf-green)]/55">
              Montant versé (XOF) *
            </span>
            <input
              type="text"
              inputMode="numeric"
              required
              disabled={readOnly || busy}
              placeholder="50 000 000"
              value={draft.amount ? formatAmountInput(draft.amount) : ""}
              onChange={(e) =>
                onChange({
                  ...draft,
                  amount: parseAmountInput(e.target.value),
                })
              }
              className={`${fieldClass} tabular-nums`}
            />
          </label>

          <label className="block text-xs">
            <span className="font-medium text-[var(--sf-green)]/55">
              Libellé *
            </span>
            <input
              required
              disabled={readOnly || busy}
              placeholder="Versement initial, apport complémentaire…"
              value={draft.label}
              onChange={(e) => onChange({ ...draft, label: e.target.value })}
              className={fieldClass}
            />
          </label>

          <label className="block text-xs">
            <span className="font-medium text-[var(--sf-green)]/55">Statut</span>
            <select
              disabled={readOnly || busy}
              value={draft.status}
              onChange={(e) => {
                const status = e.target.value as ScheduledPayment["status"];
                onChange({
                  ...draft,
                  status,
                  paid_at:
                    status === "PAID" ? draft.paid_at || draft.date : null,
                });
              }}
              className={fieldClass}
            >
              <option value="PAID">Versé</option>
              <option value="PENDING">En attente</option>
            </select>
          </label>

          <label className="block text-xs">
            <span className="font-medium text-[var(--sf-green)]/55">Notes</span>
            <textarea
              rows={3}
              disabled={readOnly || busy}
              placeholder="Référence bancaire, mode de paiement, observations…"
              value={draft.notes ?? ""}
              onChange={(e) => onChange({ ...draft, notes: e.target.value })}
              className={fieldClass}
            />
          </label>

          {error ? <ErrorAlert message={error} /> : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--sf-cream-dark)] px-5 py-4">
          {mode === "view" && canWrite ? (
            <>
              {onDelete ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={onDelete}
                  className="mr-auto rounded-lg px-3 py-2 text-sm font-medium text-red-700/80 hover:bg-red-50"
                >
                  Supprimer
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm font-medium text-[var(--sf-green)]/70"
              >
                Fermer
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onStartEdit}
                className="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-gold)]"
              >
                Modifier
              </button>
            </>
          ) : null}

          {(mode === "add" || mode === "edit") && canWrite ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={onClose}
                className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm font-medium text-[var(--sf-green)]/70"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onSave}
                className="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-gold)] disabled:opacity-50"
              >
                {busy ? "Enregistrement…" : "Enregistrer"}
              </button>
            </>
          ) : null}

          {mode === "view" && !canWrite ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm font-medium text-[var(--sf-green)]/70"
            >
              Fermer
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Page dédiée : liste des sommes versées par les clients pour investir. */
export function CaseScheduledPaymentsManager({
  caseId,
  initialPayments,
  capital,
  onSaved,
}: {
  caseId: number;
  initialPayments: ScheduledPayment[];
  capital?: CaseBeneficiaryCapital | null;
  onSaved?: (payments: ScheduledPayment[]) => void;
}) {
  const { user } = useAuth();
  const canWrite = userCanWriteCase(user);
  const beneficiaries = useMemo<BeneficiaryOption[]>(
    () =>
      (capital?.beneficiaries ?? []).map((b) => ({
        beneficiary_id: b.beneficiary_id,
        display_name: b.display_name,
      })),
    [capital],
  );

  const [rows, setRows] = useState(() =>
    sortPaymentsNewestFirst(normalizePayments(initialPayments)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("add");
  const [draft, setDraft] = useState<ScheduledPayment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setRows(sortPaymentsNewestFirst(normalizePayments(initialPayments)));
  }, [initialPayments]);

  const totalPaid = useMemo(
    () =>
      rows
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
    [rows],
  );

  function openAdd() {
    setError(null);
    setEditingId(null);
    const empty = createEmptyPayment();
    if (beneficiaries.length === 1) {
      empty.beneficiary_id = beneficiaries[0].beneficiary_id;
      empty.beneficiary_name = beneficiaries[0].display_name;
      empty.label = `Versement — ${beneficiaries[0].display_name}`;
    }
    setDraft(empty);
    setModalMode("add");
    setModalOpen(true);
  }

  function openDetail(row: ScheduledPayment) {
    setError(null);
    setEditingId(row.id ?? null);
    setDraft({ ...row });
    setModalMode("view");
    setModalOpen(true);
  }

  function closeModal() {
    if (busy) return;
    setModalOpen(false);
    setDraft(null);
    setEditingId(null);
    setError(null);
  }

  async function persist(nextRows: ScheduledPayment[]) {
    setBusy(true);
    setError(null);
    try {
      const payload = paymentsReadyToSave(nextRows);
      const updated = await apiRequest<CaseInvestmentPolicy>(
        `/cases/${caseId}/investment-policy/`,
        {
          method: "PATCH",
          body: JSON.stringify({ scheduled_payments: payload }),
        },
      );
      const saved = sortPaymentsNewestFirst(
        normalizePayments(updated.scheduled_payments ?? payload),
      );
      setRows(saved);
      onSaved?.(saved);
      setModalOpen(false);
      setDraft(null);
      setEditingId(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSave() {
    if (!canWrite || !draft) return;
    if (
      !draft.date ||
      !draft.amount ||
      !String(draft.label).trim() ||
      !draft.beneficiary_id
    ) {
      setError("Renseignez le client, la date, le montant et le libellé.");
      return;
    }

    const found = beneficiaries.find(
      (b) => b.beneficiary_id === draft.beneficiary_id,
    );
    const normalizedDraft: ScheduledPayment = {
      ...draft,
      id: draft.id || createEmptyPayment().id,
      amount: parseAmountInput(draft.amount) || draft.amount,
      beneficiary_name:
        found?.display_name ?? draft.beneficiary_name ?? null,
      paid_at:
        draft.status === "PAID" ? draft.paid_at || draft.date : null,
    };

    const next =
      modalMode === "add"
        ? [normalizedDraft, ...rows]
        : rows.map((r) => (r.id === editingId ? normalizedDraft : r));
    await persist(next);
  }

  async function handleDelete() {
    if (!canWrite || !editingId) return;
    await persist(rows.filter((r) => r.id !== editingId));
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
            Versements clients
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/55">
            Sommes versées par les clients pour investir. La liste ci-dessous
            regroupe tous les versements du dossier.
          </p>
          {rows.length > 0 ? (
            <p className="mt-2 text-sm font-medium tabular-nums text-emerald-900">
              Total versé : {formatMoney(String(totalPaid), "XOF")}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dossiers/${caseId}/finance/gestion`}
            className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-xs font-medium text-[var(--sf-green)]/70 hover:bg-[var(--sf-cream)]/40"
          >
            ← Gestion
          </Link>
          <Link
            href={`/dossiers/${caseId}/finance/investissements`}
            className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-xs font-medium text-[var(--sf-green)]/70 hover:bg-[var(--sf-cream)]/40"
          >
            Investissements →
          </Link>
          {canWrite ? (
            <button
              type="button"
              onClick={openAdd}
              className="rounded-lg bg-[var(--sf-green)] px-3 py-2 text-xs font-medium text-[var(--sf-gold)]"
            >
              + Nouveau versement
            </button>
          ) : null}
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-white px-4 py-10 text-center text-sm text-[var(--sf-green)]/50">
          Aucun versement enregistré.
          {canWrite ? (
            <>
              {" "}
              <button
                type="button"
                onClick={openAdd}
                className="font-medium text-[var(--sf-green)] underline-offset-2 hover:underline"
              >
                Ajouter le premier
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 text-xs uppercase tracking-wide text-[var(--sf-green)]/50">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Libellé</th>
                <th className="px-4 py-3 font-medium">Montant versé</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--sf-cream-dark)]">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-[var(--sf-cream)]/20">
                  <td className="px-4 py-3 text-[var(--sf-green)]/70">
                    {row.date ? formatDate(row.date) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--sf-green-deep)]">
                    {row.beneficiary_name || "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--sf-green)]/70">
                    {row.label || "—"}
                  </td>
                  <td className="px-4 py-3 font-medium tabular-nums text-emerald-900">
                    {row.amount ? formatMoney(row.amount, "XOF") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusBadgeClass(row.status)}`}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openDetail(row)}
                      className="text-xs font-medium text-[var(--sf-green)] hover:underline"
                    >
                      Détail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaymentModal
        open={modalOpen}
        mode={modalMode}
        draft={draft}
        beneficiaries={beneficiaries}
        busy={busy}
        error={error}
        canWrite={canWrite}
        onClose={closeModal}
        onChange={setDraft}
        onStartEdit={() => setModalMode("edit")}
        onSave={() => {
          void handleSave();
        }}
        onDelete={
          modalMode === "view" && editingId
            ? () => {
                void handleDelete();
              }
            : undefined
        }
      />
    </div>
  );
}
