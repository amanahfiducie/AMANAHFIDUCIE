"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, apiRequest } from "@/lib/api";
import { userCanWriteCase } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type {
  CaseBeneficiaryCapital,
  InvestmentCatalog,
  InvestmentRecord,
  PatrimonyInvestmentCategory,
} from "@/types/api";

type ParticipantRow = {
  beneficiary_id: string;
  patrimony_category_id: string;
  allocated_amount: string;
};

type CaseOption = { id: number; reference: string; title: string };

type Props = {
  assetClassId: number;
  cases: CaseOption[];
  onCreated: () => void;
  onCancel?: () => void;
};

export function InvestmentCreateForm({
  assetClassId,
  cases,
  onCreated,
  onCancel,
}: Props) {
  const { user } = useAuth();
  const canWrite = userCanWriteCase(user);
  const [catalog, setCatalog] = useState<InvestmentCatalog | null>(null);
  const [capital, setCapital] = useState<CaseBeneficiaryCapital | null>(null);
  const [caseId, setCaseId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [riskSummary, setRiskSummary] = useState("");
  const [amountInvested, setAmountInvested] = useState("");
  const [annualYield, setAnnualYield] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [participantRows, setParticipantRows] = useState<ParticipantRow[]>([
    { beneficiary_id: "", patrimony_category_id: "", allocated_amount: "" },
  ]);

  useEffect(() => {
    apiRequest<InvestmentCatalog>("/investments/catalog/")
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);

  useEffect(() => {
    if (!caseId) {
      setCapital(null);
      return;
    }
    apiRequest<CaseBeneficiaryCapital>(`/cases/${caseId}/investment-capital/`)
      .then(setCapital)
      .catch(() => setCapital(null));
  }, [caseId]);

  const categories: PatrimonyInvestmentCategory[] = catalog?.patrimony_categories ?? [];

  const participantsTotal = useMemo(
    () =>
      participantRows.reduce(
        (sum, row) => sum + (Number(row.allocated_amount) || 0),
        0,
      ),
    [participantRows],
  );

  const targetAmount = Number(amountInvested) || 0;
  const allocationComplete =
    targetAmount > 0 && Math.abs(participantsTotal - targetAmount) < 0.01;

  function updateParticipantRow(index: number, patch: Partial<ParticipantRow>) {
    setParticipantRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function addParticipantRow() {
    setParticipantRows((rows) => [
      ...rows,
      { beneficiary_id: "", patrimony_category_id: "", allocated_amount: "" },
    ]);
  }

  const getBeneficiaryLimit = useCallback(
    (beneficiaryId: string) => {
      if (!capital) return null;
      return capital.beneficiaries.find(
        (b) => String(b.beneficiary_id) === beneficiaryId,
      );
    },
    [capital],
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || !caseId) return;

    const participants = participantRows
      .filter((row) => row.beneficiary_id && row.patrimony_category_id && row.allocated_amount)
      .map((row) => ({
        beneficiary_id: Number(row.beneficiary_id),
        patrimony_category_id: Number(row.patrimony_category_id),
        allocated_amount: row.allocated_amount,
      }));

    if (participants.length === 0) {
      setError("Ajoutez au moins un client avec une part d'investissement.");
      return;
    }
    if (!allocationComplete) {
      setError(
        `La somme des parts (${participantsTotal.toLocaleString()} XOF) doit égaler le montant investi (${targetAmount.toLocaleString()} XOF).`,
      );
      return;
    }

    for (const row of participantRows) {
      if (!row.beneficiary_id || !row.allocated_amount) continue;
      const limit = getBeneficiaryLimit(row.beneficiary_id);
      const amount = Number(row.allocated_amount) || 0;
      if (limit && amount > Number(limit.available_amount)) {
        setError(
          `${limit.display_name} : montant supérieur au capital disponible (${Number(limit.available_amount).toLocaleString()} XOF).`,
        );
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      await apiRequest<InvestmentRecord>(`/cases/${caseId}/investments/`, {
        method: "POST",
        body: JSON.stringify({
          asset_class_id: assetClassId,
          label,
          reference,
          notes,
          risk_summary: riskSummary,
          amount_invested: amountInvested,
          current_value: amountInvested,
          start_date: startDate,
          status: "PENDING_VALIDATION",
          annual_yield_percent: annualYield || null,
          participants,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création impossible.");
    } finally {
      setBusy(false);
    }
  }

  if (!canWrite) {
    return (
      <p className="text-sm text-[var(--sf-green)]/55">
        Vous n&apos;avez pas les droits pour créer un investissement.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? <ErrorAlert message={error} /> : null}

      <label className="block text-sm">
        <span className="text-[var(--sf-green)]/55">Dossier (mandat / tutelle)</span>
        <select
          required
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
        >
          <option value="">— Choisir un dossier —</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.reference} — {c.title}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-[var(--sf-green)]/55">Titre de l&apos;investissement</span>
        <input
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[var(--sf-green)]/55">Référence</span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--sf-green)]/55">Rendement estimé (% / an)</span>
          <input
            type="number"
            step="0.01"
            value={annualYield}
            onChange={(e) => setAnnualYield(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="text-[var(--sf-green)]/55">Informations complémentaires</span>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
        />
      </label>

      <label className="block text-sm">
        <span className="text-[var(--sf-green)]/55">Risques identifiés</span>
        <textarea
          rows={2}
          value={riskSummary}
          onChange={(e) => setRiskSummary(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
        />
      </label>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-sm">
          <span className="text-[var(--sf-green)]/55">Montant de l&apos;investissement (XOF)</span>
          <input
            required
            type="number"
            min={0}
            step="0.01"
            value={amountInvested}
            onChange={(e) => setAmountInvested(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
          />
        </label>
        <label className="block text-sm">
          <span className="text-[var(--sf-green)]/55">Date de début</span>
          <input
            required
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
          />
        </label>
      </div>

      <div className="rounded-lg border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/15 p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-[var(--sf-green-deep)]">
            Parts clients (type patrimonial A–D)
          </p>
          <button
            type="button"
            onClick={addParticipantRow}
            className="text-xs font-medium text-[var(--sf-green)] hover:underline"
          >
            + Client
          </button>
        </div>
        <div className="space-y-3">
          {participantRows.map((row, index) => {
            const limit = row.beneficiary_id ? getBeneficiaryLimit(row.beneficiary_id) : null;
            return (
              <div key={index} className="grid gap-2 md:grid-cols-3">
                <select
                  value={row.beneficiary_id}
                  onChange={(e) =>
                    updateParticipantRow(index, { beneficiary_id: e.target.value })
                  }
                  className="rounded-lg border border-[var(--sf-cream-dark)] px-2 py-2 text-sm"
                >
                  <option value="">Client</option>
                  {(capital?.beneficiaries ?? []).map((b) => (
                    <option key={b.beneficiary_id} value={b.beneficiary_id}>
                      {b.display_name} (dispo.{" "}
                      {Number(b.available_amount).toLocaleString()} XOF)
                    </option>
                  ))}
                </select>
                <select
                  value={row.patrimony_category_id}
                  onChange={(e) =>
                    updateParticipantRow(index, { patrimony_category_id: e.target.value })
                  }
                  className="rounded-lg border border-[var(--sf-cream-dark)] px-2 py-2 text-sm"
                >
                  <option value="">Type A–D</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="Montant XOF"
                  value={row.allocated_amount}
                  onChange={(e) =>
                    updateParticipantRow(index, { allocated_amount: e.target.value })
                  }
                  className="rounded-lg border border-[var(--sf-cream-dark)] px-2 py-2 text-sm"
                />
                {limit ? (
                  <p className="md:col-span-3 text-xs text-[var(--sf-green)]/45">
                    Limite patrimoniale : {Number(limit.patrimony_limit).toLocaleString()} XOF
                    · déjà déployé {Number(limit.deployed_amount).toLocaleString()} XOF
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-[var(--sf-green)]/50">
          Total parts : {participantsTotal.toLocaleString()} XOF
          {targetAmount > 0 ? ` / ${targetAmount.toLocaleString()} XOF` : ""}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !caseId}
          className="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-gold)] disabled:opacity-50"
        >
          {busy ? "Création…" : "Créer l'investissement"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--sf-cream-dark)] px-4 py-2 text-sm"
          >
            Annuler
          </button>
        ) : null}
      </div>
    </form>
  );
}
