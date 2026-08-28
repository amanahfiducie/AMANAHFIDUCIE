"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, apiRequest } from "@/lib/api";
import {
  formatAmountInput,
  formatMoney,
  parseAmountInput,
} from "@/lib/labels";
import { userCanWriteCase } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type {
  CaseInvestmentPolicy,
  InvestmentAssetClass,
  InvestmentCatalog,
  InvestmentsManagement,
  ManagementInvestment,
} from "@/types/api";

const fieldClass =
  "mt-1 w-full rounded-md border border-[var(--sf-cream-dark)] bg-white px-3 py-2 text-sm text-[var(--sf-green-deep)] outline-none transition focus:border-[var(--sf-green)]/40 focus:ring-1 focus:ring-[var(--sf-green)]/15";

const labelClass = "block text-xs font-medium text-[var(--sf-green)]/65";

type CaseOption = {
  id: number;
  reference: string;
  title: string;
  planned_investment_amount?: string | null;
};

/** Client = le dossier lui-même. */
type EligibleClient = {
  case_id: number;
  case_reference: string;
  case_title: string;
  display_name: string;
  category_max: number;
  category_allocated: number;
  already_invested: number;
};

type CartItem = EligibleClient & {
  allocated_amount: string;
};

type Props = {
  cases: CaseOption[];
  assetClasses: InvestmentAssetClass[];
  initialAssetClassId?: number | null;
  /** Reprendre une enveloppe incomplète pour allouer des dossiers. */
  existingInvestment?: ManagementInvestment | null;
  onCreated: () => void;
  onCancel?: () => void;
};

/** Couleur type barre de progression : rouge (0 %) → vert (100 %). */
export function allocationProgressStyle(percent: number): {
  backgroundColor: string;
  color: string;
} {
  const pct = Math.min(100, Math.max(0, percent));
  const hue = Math.round((pct / 100) * 120); // 0=rouge, 120=vert
  return {
    backgroundColor: `hsl(${hue} 72% 38%)`,
    color: "white",
  };
}

function caseDeployedInCategory(
  investments: ManagementInvestment[],
  caseId: number,
  assetClassSlug: string,
): number {
  let total = 0;
  for (const inv of investments) {
    if (inv.status === "CLOSED") continue;
    if (inv.asset_class_slug !== assetClassSlug) continue;
    if (inv.case_id === caseId) {
      total += Number(inv.amount_invested) || 0;
      continue;
    }
    for (const alloc of inv.allocations ?? []) {
      if (alloc.case_id === caseId) {
        total += Number(alloc.amount_invested) || 0;
      }
    }
  }
  return total;
}

function caseTotalDeployed(
  investments: ManagementInvestment[],
  caseId: number,
): number {
  let total = 0;
  for (const inv of investments) {
    if (inv.status === "CLOSED") continue;
    if (inv.case_id === caseId) {
      total += Number(inv.amount_invested) || 0;
      continue;
    }
    for (const alloc of inv.allocations ?? []) {
      if (alloc.case_id === caseId) {
        total += Number(alloc.amount_invested) || 0;
      }
    }
  }
  return total;
}

/** Affiche 12 ou 12.3 — sans symbole %, sans .0 inutile. */
function formatPct(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function InvestmentCreateWizard({
  cases,
  assetClasses,
  initialAssetClassId = null,
  existingInvestment = null,
  onCreated,
  onCancel,
}: Props) {
  const { user } = useAuth();
  const canWrite = userCanWriteCase(user);
  const isCompleting = Boolean(existingInvestment);

  const [step, setStep] = useState<1 | 2>(isCompleting ? 2 : 1);
  const [busy, setBusy] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [catalog, setCatalog] = useState<InvestmentCatalog | null>(null);
  const [managementInvestments, setManagementInvestments] = useState<
    ManagementInvestment[]
  >([]);
  const [eligibleClients, setEligibleClients] = useState<EligibleClient[]>([]);

  const [assetClassId, setAssetClassId] = useState(() => {
    if (existingInvestment?.asset_class_slug) {
      const found = assetClasses.find(
        (c) => c.slug === existingInvestment.asset_class_slug,
      );
      if (found) return String(found.id);
    }
    return initialAssetClassId ? String(initialAssetClassId) : "";
  });
  const [label, setLabel] = useState(existingInvestment?.label ?? "");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [riskSummary, setRiskSummary] = useState("");
  const [amountInvested, setAmountInvested] = useState(
    existingInvestment
      ? formatAmountInput(existingInvestment.amount_invested)
      : "",
  );
  const [annualYield, setAnnualYield] = useState(
    existingInvestment?.annual_yield_percent
      ? String(existingInvestment.annual_yield_percent)
      : "",
  );
  const [startDate, setStartDate] = useState(
    existingInvestment?.start_date?.slice(0, 10) ??
      new Date().toISOString().slice(0, 10),
  );

  const [cart, setCart] = useState<CartItem[]>([]);
  const [dossierQuery, setDossierQuery] = useState("");

  const alreadyAllocated = Number(existingInvestment?.allocated_amount) || 0;

  useEffect(() => {
    Promise.all([
      apiRequest<InvestmentCatalog>("/investments/catalog/"),
      apiRequest<InvestmentsManagement>("/investments/management/"),
    ])
      .then(([cat, mgmt]) => {
        setCatalog(cat);
        setManagementInvestments(mgmt.management_investments ?? []);
        if (existingInvestment?.asset_class_slug) {
          const found = (cat.asset_classes ?? []).find(
            (c) => c.slug === existingInvestment.asset_class_slug,
          );
          if (found) setAssetClassId(String(found.id));
        }
      })
      .catch(() => {
        setCatalog(null);
        setManagementInvestments([]);
      });
  }, [existingInvestment]);

  const selectedAssetClass = useMemo(() => {
    const id = Number(assetClassId);
    return (
      assetClasses.find((c) => c.id === id) ??
      catalog?.asset_classes.find((c) => c.id === id) ??
      null
    );
  }, [assetClassId, assetClasses, catalog]);

  const targetAmount = Number(parseAmountInput(amountInvested)) || 0;
  /** Montant encore à allouer (nouvelle création ou complément). */
  const remainingToAllocate = Math.max(targetAmount - alreadyAllocated, 0);

  useEffect(() => {
    if (isCompleting && selectedAssetClass) {
      void loadEligibleClients(selectedAssetClass.slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleting, selectedAssetClass?.slug, managementInvestments.length]);

  async function loadEligibleClients(slug: string) {
    setLoadingClients(true);
    setError(null);
    try {
      const [mgmt, policies] = await Promise.all([
        apiRequest<InvestmentsManagement>("/investments/management/").catch(
          () => null,
        ),
        Promise.all(
          cases.map(async (c) => {
            try {
              const policy = await apiRequest<CaseInvestmentPolicy>(
                `/cases/${c.id}/investment-policy/`,
              );
              return { case: c, policy };
            } catch {
              return null;
            }
          }),
        ),
      ]);

      const investments =
        mgmt?.management_investments ?? managementInvestments;
      if (mgmt?.management_investments) {
        setManagementInvestments(mgmt.management_investments);
      }

      const alreadyCaseIds = new Set(
        (existingInvestment?.allocations ?? [])
          .map((a) => a.case_id)
          .filter((id): id is number => id != null),
      );

      const eligible: EligibleClient[] = [];

      for (const row of policies) {
        if (!row) continue;
        const { case: c, policy } = row;
        if (alreadyCaseIds.has(c.id)) continue;

        const targets = policy.patrimony_category.allocation_targets ?? {};
        const targetPct = targets[slug];
        if (typeof targetPct !== "number" || targetPct <= 0) continue;

        const planned =
          Number(policy.planned_investment_amount) ||
          Number(c.planned_investment_amount) ||
          0;
        if (planned <= 0) continue;

        const categoryAllocated = (planned * targetPct) / 100;
        const already = caseDeployedInCategory(investments, c.id, slug);
        const overallRemaining = Math.max(
          planned - caseTotalDeployed(investments, c.id),
          0,
        );
        const remaining = Math.min(
          Math.max(categoryAllocated - already, 0),
          overallRemaining,
        );

        if (remaining > 0.009) {
          eligible.push({
            case_id: c.id,
            case_reference: c.reference,
            case_title: c.title,
            display_name: c.title,
            category_max: remaining,
            category_allocated: categoryAllocated,
            already_invested: already,
          });
        }
      }

      eligible.sort((a, b) =>
        a.case_reference.localeCompare(b.case_reference, "fr"),
      );
      setEligibleClients(eligible);
    } catch (err) {
      setEligibleClients([]);
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger les dossiers éligibles.",
      );
    } finally {
      setLoadingClients(false);
    }
  }

  const cartTotal = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum + (Number(parseAmountInput(item.allocated_amount)) || 0),
        0,
      ),
    [cart],
  );

  const allocatedAfterSave = alreadyAllocated + cartTotal;
  const progressPercent =
    targetAmount > 0
      ? Math.min(100, (allocatedAfterSave / targetAmount) * 100)
      : 0;
  const stillMissing = Math.max(targetAmount - allocatedAfterSave, 0);
  const allocationComplete =
    targetAmount > 0 && Math.abs(allocatedAfterSave - targetAmount) < 0.01;
  const overAllocated = allocatedAfterSave > targetAmount + 0.01;

  const cartKeys = useMemo(
    () => new Set(cart.map((c) => String(c.case_id))),
    [cart],
  );

  const filteredClients = useMemo(() => {
    const q = dossierQuery.trim().toLowerCase();
    if (!q) return eligibleClients;
    return eligibleClients.filter((c) => {
      const hay = `${c.case_reference} ${c.case_title}`.toLowerCase();
      return hay.includes(q);
    });
  }, [eligibleClients, dossierQuery]);

  function addClient(client: EligibleClient) {
    if (cartKeys.has(String(client.case_id))) return;
    const room = Math.max(remainingToAllocate - cartTotal, 0);
    const suggested = Math.min(
      client.category_max,
      room || client.category_max,
    );
    setCart((prev) => [
      ...prev,
      {
        ...client,
        allocated_amount:
          suggested > 0 ? String(Math.round(suggested * 100) / 100) : "",
      },
    ]);
  }

  function updateCartAmount(caseId: number, raw: string) {
    const formatted = formatAmountInput(raw);
    const value = Number(parseAmountInput(formatted)) || 0;
    setCart((prev) =>
      prev.map((item) => {
        if (item.case_id !== caseId) return item;
        const capped = Math.min(value, item.category_max);
        return {
          ...item,
          allocated_amount:
            capped === value ? formatted : formatAmountInput(String(capped)),
        };
      }),
    );
  }

  function removeFromCart(caseId: number) {
    setCart((prev) => prev.filter((c) => c.case_id !== caseId));
  }

  function validateStep1(): boolean {
    if (!assetClassId || !selectedAssetClass) {
      setError("Choisissez une catégorie d'investissement.");
      return false;
    }
    if (!label.trim()) {
      setError("Indiquez le titre de l'investissement.");
      return false;
    }
    if (targetAmount <= 0) {
      setError("Indiquez le montant total à investir.");
      return false;
    }
    setError(null);
    return true;
  }

  async function goToStep2(e: FormEvent) {
    e.preventDefault();
    if (!validateStep1() || !selectedAssetClass) return;
    setCart([]);
    setStep(2);
    await loadEligibleClients(selectedAssetClass.slug);
  }

  async function handleSave() {
    if (!canWrite || !selectedAssetClass) return;
    if (overAllocated) {
      setError("Le panier dépasse le montant de l'investissement.");
      return;
    }
    for (const item of cart) {
      const amount = Number(parseAmountInput(item.allocated_amount)) || 0;
      if (amount <= 0) {
        setError(`${item.case_reference} : montant invalide.`);
        return;
      }
      if (amount > item.category_max + 0.009) {
        setError(
          `${item.case_reference} : dépasse le capital catégorie restant (${formatMoney(String(item.category_max), "XOF")}).`,
        );
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      if (isCompleting && existingInvestment) {
        for (const item of cart) {
          await apiRequest(
            `/investments/${existingInvestment.id}/allocations/`,
            {
              method: "POST",
              body: JSON.stringify({
                case_id: item.case_id,
                amount: parseAmountInput(item.allocated_amount),
              }),
            },
          );
        }
      } else {
        await apiRequest("/investments/", {
          method: "POST",
          body: JSON.stringify({
            asset_class_id: Number(assetClassId),
            label,
            reference,
            notes,
            risk_summary: riskSummary,
            amount_invested: parseAmountInput(amountInvested),
            current_value: parseAmountInput(amountInvested),
            start_date: startDate,
            status: "PENDING_VALIDATION",
            annual_yield_percent: annualYield || null,
            allocations: cart.map((item) => ({
              case_id: item.case_id,
              amount: parseAmountInput(item.allocated_amount),
            })),
          }),
        });
      }
      onCreated();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Enregistrement impossible.",
      );
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

  const saveLabel = allocationComplete
    ? busy
      ? "Enregistrement…"
      : "Enregistrer (complet)"
    : busy
      ? "Enregistrement…"
      : cart.length === 0 && !isCompleting
        ? "Enregistrer sans dossier"
        : "Enregistrer (à compléter)";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
        <span
          className={`rounded-full px-2.5 py-1 ${
            step === 1
              ? "bg-[var(--sf-green)] text-[var(--sf-gold)]"
              : "bg-[var(--sf-cream)] text-[var(--sf-green)]/70"
          }`}
        >
          1. Informations
        </span>
        <span className="text-[var(--sf-green)]/30">→</span>
        <span
          className={`rounded-full px-2.5 py-1 ${
            step === 2
              ? "bg-[var(--sf-green)] text-[var(--sf-gold)]"
              : "bg-[var(--sf-cream)] text-[var(--sf-green)]/70"
          }`}
        >
          2. Dossiers
        </span>
        <span className="ml-auto text-[var(--sf-green)]/45">
          {isCompleting
            ? "Compléter l'allocation"
            : "Enregistrement possible sans dossier"}
        </span>
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      {step === 1 && !isCompleting ? (
        <form onSubmit={(e) => void goToStep2(e)} className="space-y-3">
          <div className="grid gap-x-3 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-6">
            <label className="block sm:col-span-2 lg:col-span-3">
              <span className={labelClass}>Catégorie *</span>
              <select
                required
                value={assetClassId}
                onChange={(e) => setAssetClassId(e.target.value)}
                className={fieldClass}
                disabled={Boolean(initialAssetClassId)}
              >
                <option value="">— Choisir la catégorie —</option>
                {(assetClasses.length > 0
                  ? assetClasses
                  : catalog?.asset_classes ?? []
                ).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block sm:col-span-2 lg:col-span-3">
              <span className={labelClass}>Titre *</span>
              <input
                required
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className={fieldClass}
                placeholder="Ex. Sukuk souverain Sénégal 2026"
              />
            </label>

            <label className="block sm:col-span-1 lg:col-span-2">
              <span className={labelClass}>Montant (XOF) *</span>
              <input
                required
                type="text"
                inputMode="numeric"
                value={amountInvested}
                onChange={(e) =>
                  setAmountInvested(formatAmountInput(e.target.value))
                }
                className={`${fieldClass} tabular-nums`}
                placeholder="50 000 000"
              />
            </label>

            <label className="block sm:col-span-1 lg:col-span-2">
              <span className={labelClass}>Date de début *</span>
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={fieldClass}
              />
            </label>

            <label className="block sm:col-span-1 lg:col-span-2">
              <span className={labelClass}>Rendement (% / an)</span>
              <input
                type="number"
                step="0.01"
                value={annualYield}
                onChange={(e) => setAnnualYield(e.target.value)}
                className={fieldClass}
                placeholder="5.50"
              />
            </label>

            <label className="block sm:col-span-1 lg:col-span-2">
              <span className={labelClass}>Référence</span>
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className={fieldClass}
                placeholder="Optionnel"
              />
            </label>

            <label className="block sm:col-span-1 lg:col-span-2">
              <span className={labelClass}>Risque</span>
              <input
                value={riskSummary}
                onChange={(e) => setRiskSummary(e.target.value)}
                className={fieldClass}
                placeholder="Niveau / facteurs de risque"
              />
            </label>

            <label className="block sm:col-span-2 lg:col-span-2">
              <span className={labelClass}>Notes</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className={fieldClass}
                placeholder="Informations complémentaires"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--sf-cream-dark)] pt-3">
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-lg border border-[var(--sf-cream-dark)] px-3.5 py-2 text-sm font-medium text-[var(--sf-green)]/70"
              >
                Annuler
              </button>
            ) : null}
            <button
              type="submit"
              disabled={!assetClassId}
              className="rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-[var(--sf-gold)] disabled:opacity-50"
            >
              Continuer → Dossiers
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg bg-[var(--sf-cream)]/35 px-4 py-2.5 text-sm text-[var(--sf-green)]/70">
            <span className="font-medium text-[var(--sf-green-deep)]">
              {label}
            </span>
            {" · "}
            {selectedAssetClass?.label}
            {" · "}
            <span className="tabular-nums font-medium text-emerald-900">
              {formatMoney(String(targetAmount), "XOF")}
            </span>
            {alreadyAllocated > 0 ? (
              <span className="ml-2 text-xs">
                · Déjà alloué{" "}
                {formatMoney(String(alreadyAllocated), "XOF")}
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4">
              <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                Dossiers clients — {selectedAssetClass?.label}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
                Optionnel : vous pouvez enregistrer sans dossier et compléter
                plus tard.
              </p>

              {loadingClients ? (
                <p className="mt-6 text-center text-sm text-[var(--sf-green)]/45">
                  Analyse des dossiers…
                </p>
              ) : eligibleClients.length === 0 ? (
                <p className="mt-6 text-center text-sm text-[var(--sf-green)]/45">
                  Aucun dossier éligible pour le moment.
                </p>
              ) : (
                <div className="mt-3 space-y-2">
                  <input
                    type="search"
                    value={dossierQuery}
                    onChange={(e) => setDossierQuery(e.target.value)}
                    className={fieldClass}
                    placeholder="Rechercher (réf. ou titre)…"
                    autoComplete="off"
                  />
                  {filteredClients.length === 0 ? (
                    <p className="py-4 text-center text-sm text-[var(--sf-green)]/45">
                      Aucun résultat
                      {dossierQuery.trim()
                        ? ` pour « ${dossierQuery.trim()} »`
                        : ""}
                      .
                    </p>
                  ) : (
                    <ul className="max-h-[13.5rem] space-y-2 overflow-y-auto overscroll-contain pr-1">
                      {filteredClients.map((client) => {
                        const inCart = cartKeys.has(String(client.case_id));
                        return (
                          <li key={client.case_id}>
                            <button
                              type="button"
                              disabled={inCart}
                              onClick={() => addClient(client)}
                              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                                inCart
                                  ? "cursor-default border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 opacity-60"
                                  : "border-[var(--sf-cream-dark)] hover:border-[var(--sf-green)]/30 hover:bg-[var(--sf-cream)]/30"
                              }`}
                            >
                              <div>
                                <p className="font-medium text-[var(--sf-green-deep)]">
                                  {client.case_reference}
                                </p>
                                <p className="text-xs text-[var(--sf-green)]/50">
                                  {client.case_title} · Reste{" "}
                                  {formatMoney(
                                    String(client.category_max),
                                    "XOF",
                                  )}
                                </p>
                              </div>
                              <span className="shrink-0 text-xs font-medium text-[var(--sf-green)]">
                                {inCart ? "Ajouté" : "+ Ajouter"}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4">
              <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                Allocation
              </h3>

              <div className="mt-3">
                <div className="mb-1.5 flex justify-between text-xs text-[var(--sf-green)]/60">
                  <span>
                    Alloué{" "}
                    {formatMoney(String(allocatedAfterSave), "XOF")}
                  </span>
                  <span>
                    Objectif {formatMoney(String(targetAmount), "XOF")}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[var(--sf-cream)]">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, progressPercent)}%`,
                      ...allocationProgressStyle(
                        overAllocated ? 0 : progressPercent,
                      ),
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-[var(--sf-green)]/55">
                  {overAllocated
                    ? "Dépassement du montant."
                    : allocationComplete
                      ? "Allocation complète."
                      : `Reste à allouer : ${formatMoney(String(stillMissing), "XOF")} — enregistrement possible.`}
                </p>
              </div>

              {cart.length === 0 ? (
                <p className="mt-6 text-center text-sm text-[var(--sf-green)]/45">
                  Aucun dossier dans le panier.
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[26rem] text-left text-xs">
                    <thead>
                      <tr className="border-b border-[var(--sf-cream-dark)] text-[var(--sf-green)]/45">
                        <th className="pb-2 pr-2 font-medium">Dossier</th>
                        <th className="pb-2 pr-2 font-medium">Montant</th>
                        <th className="pb-2 pr-2 font-medium">% fonds</th>
                        <th className="pb-2 pr-2 font-medium">% inv.</th>
                        <th className="pb-2 font-medium" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--sf-cream-dark)]">
                      {cart.map((item) => {
                        const amount =
                          Number(parseAmountInput(item.allocated_amount)) || 0;
                        const pctOfFunds =
                          item.category_max > 0
                            ? (amount / item.category_max) * 100
                            : 0;
                        const pctOfInv =
                          targetAmount > 0
                            ? (amount / targetAmount) * 100
                            : 0;
                        return (
                          <tr key={item.case_id}>
                            <td className="py-2 pr-2 font-medium text-[var(--sf-green-deep)]">
                              {item.case_reference}
                              <p className="font-normal text-[var(--sf-green)]/45">
                                {item.case_title} · max{" "}
                                {formatMoney(String(item.category_max), "XOF")}
                              </p>
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={
                                  item.allocated_amount
                                    ? formatAmountInput(item.allocated_amount)
                                    : ""
                                }
                                onChange={(e) =>
                                  updateCartAmount(item.case_id, e.target.value)
                                }
                                className="w-28 rounded-md border border-[var(--sf-cream-dark)] px-2 py-1.5 tabular-nums"
                              />
                            </td>
                            <td className="py-2 pr-2 tabular-nums text-[var(--sf-green)]/70">
                              {formatPct(pctOfFunds)}
                            </td>
                            <td className="py-2 pr-2 tabular-nums text-[var(--sf-green)]/70">
                              {formatPct(pctOfInv)}
                            </td>
                            <td className="py-2">
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.case_id)}
                                className="text-[var(--sf-green)]/50 hover:text-red-700"
                              >
                                Retirer
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--sf-cream-dark)] pt-3">
            {!isCompleting ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setError(null);
                  setStep(1);
                }}
                className="rounded-lg border border-[var(--sf-cream-dark)] px-3.5 py-2 text-sm font-medium text-[var(--sf-green)]/70"
              >
                ← Retour
              </button>
            ) : null}
            {onCancel ? (
              <button
                type="button"
                disabled={busy}
                onClick={onCancel}
                className="rounded-lg border border-[var(--sf-cream-dark)] px-3.5 py-2 text-sm font-medium text-[var(--sf-green)]/70"
              >
                Annuler
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy || overAllocated || targetAmount <= 0}
              onClick={() => {
                void handleSave();
              }}
              className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
              style={allocationProgressStyle(
                overAllocated ? 0 : progressPercent,
              )}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
