"use client";

import { FormEvent, useId, useState, type ReactNode } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, apiRequest } from "@/lib/api";
import { INVESTMENT_STATUS_LABELS } from "@/lib/investment-labels";
import {
  formatAmountInput,
  formatMoney,
  parseAmountInput,
} from "@/lib/labels";
import type { InvestmentDetail } from "@/types/api";

const fieldClass =
  "mt-1 w-full rounded-md border border-[var(--sf-cream-dark)] bg-white px-3 py-2 text-sm text-[var(--sf-green-deep)] outline-none transition focus:border-[var(--sf-green)]/40 focus:ring-1 focus:ring-[var(--sf-green)]/15";

const labelClass = "block text-xs font-medium text-[var(--sf-green)]/65";

type Op = "estimate" | "distribute" | "status" | null;

type Props = {
  detail: InvestmentDetail;
  canWrite: boolean;
  onUpdated: () => void;
};

export function InvestmentOperationsPanel({
  detail,
  canWrite,
  onUpdated,
}: Props) {
  const [op, setOp] = useState<Op>(null);

  if (!canWrite) return null;

  const isClosed = detail.status === "CLOSED";
  const isPending = detail.status === "PENDING_VALIDATION";
  const isActive = detail.status === "ACTIVE";
  const isMatured = detail.status === "MATURED";

  return (
    <>
      <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
          Opérations
        </h3>
        <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
          Estimation, distribution de revenus et cycle de vie du placement.
        </p>

        {isClosed ? (
          <p className="mt-4 text-sm text-[var(--sf-green)]/55">
            Investissement clôturé — aucune opération disponible.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {isPending ? (
              <ActionButton
                label="Valider l'investissement"
                onClick={() => setOp("status")}
                variant="primary"
              />
            ) : null}
            {!isPending ? (
              <ActionButton
                label="Nouvelle estimation"
                onClick={() => setOp("estimate")}
              />
            ) : null}
            {isActive || isMatured ? (
              <ActionButton
                label="Distribuer des revenus"
                onClick={() => setOp("distribute")}
              />
            ) : null}
            {isActive || isMatured ? (
              <ActionButton
                label="Changer le statut"
                onClick={() => setOp("status")}
              />
            ) : null}
          </div>
        )}
      </section>

      {op === "estimate" ? (
        <EstimateModal
          detail={detail}
          onClose={() => setOp(null)}
          onSaved={onUpdated}
        />
      ) : null}
      {op === "distribute" ? (
        <DistributeModal
          detail={detail}
          onClose={() => setOp(null)}
          onSaved={onUpdated}
        />
      ) : null}
      {op === "status" ? (
        <StatusModal
          detail={detail}
          onClose={() => setOp(null)}
          onSaved={onUpdated}
        />
      ) : null}
    </>
  );
}

function ActionButton({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "danger";
}) {
  const classes =
    variant === "primary"
      ? "bg-[var(--sf-green)] text-[var(--sf-gold)]"
      : variant === "danger"
        ? "border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
        : "border-[var(--sf-cream-dark)] bg-white text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]/40";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-3.5 py-2 text-sm font-medium transition ${classes}`}
    >
      {label}
    </button>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--sf-cream-dark)] px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-base font-semibold text-[var(--sf-green-deep)]"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--sf-green)]/55 hover:bg-[var(--sf-cream)]/50"
          >
            Fermer
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

function EstimateModal({
  detail,
  onClose,
  onSaved,
}: {
  detail: InvestmentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currency = detail.currency || "XOF";
  const [currentValue, setCurrentValue] = useState(
    formatAmountInput(detail.current_value),
  );
  const [valuedAt, setValuedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invested = Number(detail.amount_invested) || 0;
  const next = Number(parseAmountInput(currentValue)) || 0;
  const delta = next - invested;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (next <= 0) {
      setError("Indiquez une valeur estimée positive.");
      return;
    }
    if (!valuedAt) {
      setError("Indiquez la date d'estimation.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/investments/${detail.id}/valuations/`, {
        method: "POST",
        body: JSON.stringify({
          value: parseAmountInput(currentValue),
          valued_at: valuedAt,
          notes,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Mise à jour impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Nouvelle estimation"
      subtitle={`Valeur actuelle : ${formatMoney(detail.current_value, currency)}`}
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        {error ? <ErrorAlert message={error} /> : null}
        <label className="block">
          <span className={labelClass}>Date d&apos;estimation *</span>
          <input
            required
            type="date"
            value={valuedAt}
            onChange={(e) => setValuedAt(e.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Valeur estimée ({currency}) *</span>
          <input
            required
            type="text"
            inputMode="numeric"
            value={currentValue}
            onChange={(e) => setCurrentValue(formatAmountInput(e.target.value))}
            className={`${fieldClass} tabular-nums`}
          />
        </label>
        {next > 0 ? (
          <p
            className={`text-xs tabular-nums ${delta >= 0 ? "text-emerald-800" : "text-red-700"}`}
          >
            {delta >= 0 ? "+" : ""}
            {formatMoney(String(delta), currency)} vs montant investi
          </p>
        ) : null}
        <label className="block">
          <span className={labelClass}>Notes</span>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={fieldClass}
            placeholder="Contexte de l'estimation…"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-[var(--sf-cream-dark)] px-3.5 py-2 text-sm text-[var(--sf-green)]/70"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-gold)] disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function DistributeModal({
  detail,
  onClose,
  onSaved,
}: {
  detail: InvestmentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const currency = detail.currency || "XOF";
  const already = Number(detail.distributed_income) || 0;
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState(detail.notes || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = Number(parseAmountInput(amount)) || 0;
  const total = already + add;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (add <= 0) {
      setError("Indiquez un montant à distribuer.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/investments/${detail.id}/`, {
        method: "PATCH",
        body: JSON.stringify({
          distributed_income: String(total),
          notes,
        }),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Distribution impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Distribuer des revenus"
      subtitle={`Déjà distribué : ${formatMoney(String(already), currency)}`}
      onClose={onClose}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
        {error ? <ErrorAlert message={error} /> : null}
        <label className="block">
          <span className={labelClass}>Montant à distribuer ({currency}) *</span>
          <input
            required
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(formatAmountInput(e.target.value))}
            className={`${fieldClass} tabular-nums`}
            placeholder="0"
          />
        </label>
        {add > 0 ? (
          <p className="text-xs text-[var(--sf-green)]/55">
            Total distribué après opération :{" "}
            <span className="font-medium tabular-nums text-[var(--sf-green-deep)]">
              {formatMoney(String(total), currency)}
            </span>
          </p>
        ) : null}
        <label className="block">
          <span className={labelClass}>Notes</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={fieldClass}
            placeholder="Détail de la distribution…"
          />
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-[var(--sf-cream-dark)] px-3.5 py-2 text-sm text-[var(--sf-green)]/70"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-gold)] disabled:opacity-50"
          >
            {busy ? "Enregistrement…" : "Distribuer"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function StatusModal({
  detail,
  onClose,
  onSaved,
}: {
  detail: InvestmentDetail;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const options = getStatusOptions(detail.status);

  async function applyStatus(status: string) {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, string> = { status };
      if (status === "MATURED" && !detail.maturity_date) {
        body.maturity_date = new Date().toISOString().slice(0, 10);
      }
      await apiRequest(`/investments/${detail.id}/`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Changement de statut impossible.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ModalShell
      title="Changer le statut"
      subtitle={`Actuel : ${INVESTMENT_STATUS_LABELS[detail.status] ?? detail.status}`}
      onClose={onClose}
    >
      {error ? <ErrorAlert message={error} /> : null}
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.status}
            type="button"
            disabled={busy}
            onClick={() => void applyStatus(opt.status)}
            className={`flex w-full flex-col items-start rounded-lg border px-4 py-3 text-left text-sm transition disabled:opacity-50 ${
              opt.variant === "danger"
                ? "border-red-200 hover:bg-red-50"
                : "border-[var(--sf-cream-dark)] hover:bg-[var(--sf-cream)]/40"
            }`}
          >
            <span className="font-medium text-[var(--sf-green-deep)]">
              {opt.label}
            </span>
            <span className="mt-0.5 text-xs text-[var(--sf-green)]/50">
              {opt.hint}
            </span>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}

function getStatusOptions(current: string) {
  if (current === "PENDING_VALIDATION") {
    return [
      {
        status: "ACTIVE",
        label: "Valider et activer",
        hint: "L'investissement devient actif et opérationnel.",
        variant: "default" as const,
      },
    ];
  }
  if (current === "ACTIVE") {
    return [
      {
        status: "MATURED",
        label: "Marquer à échéance",
        hint: "Le placement est arrivé à terme, sans clôture définitive.",
        variant: "default" as const,
      },
      {
        status: "CLOSED",
        label: "Clôturer l'investissement",
        hint: "Termine définitivement le placement.",
        variant: "danger" as const,
      },
    ];
  }
  if (current === "MATURED") {
    return [
      {
        status: "CLOSED",
        label: "Clôturer l'investissement",
        hint: "Termine définitivement le placement.",
        variant: "danger" as const,
      },
    ];
  }
  return [];
}
