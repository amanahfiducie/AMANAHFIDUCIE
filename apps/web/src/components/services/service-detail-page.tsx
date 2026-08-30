"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import {
  ApiError,
  createServiceBillingRule,
  deleteServiceBillingRule,
  generateServicePeriodicBilling,
  getServiceOffer,
  getServicesMeta,
  listServiceBilledCases,
  updateServiceBillingRule,
  updateServiceOffer,
} from "@/lib/api";
import { formatMoney } from "@/lib/labels";
import { userCanManageServices } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type {
  BillingFormula,
  BillingPeriodicity,
  ServiceBilledCase,
  ServiceBillingRule,
  ServiceBillingRulePayload,
  ServiceOfferDetail,
  ServicesMeta,
} from "@/types/api";

const EMPTY_FORM: ServiceBillingRulePayload = {
  formula: "MANAGEMENT_FEE_AUM",
  label: "",
  description: "",
  rate_percent: "",
  rate_min_percent: "",
  rate_max_percent: "",
  fixed_amount: "",
  fixed_amount_min: "",
  fixed_amount_max: "",
  base_min: "",
  base_max: "",
  currency: "XOF",
  periodicity: "ANNUAL",
  is_active: true,
  sort_order: 0,
  notes: "",
};

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function ruleToForm(rule: ServiceBillingRule): ServiceBillingRulePayload {
  return {
    formula: rule.formula,
    label: rule.label,
    description: rule.description,
    rate_percent: rule.rate_percent ?? "",
    rate_min_percent: rule.rate_min_percent ?? "",
    rate_max_percent: rule.rate_max_percent ?? "",
    fixed_amount: rule.fixed_amount ?? "",
    fixed_amount_min: rule.fixed_amount_min ?? "",
    fixed_amount_max: rule.fixed_amount_max ?? "",
    base_min: rule.base_min ?? "",
    base_max: rule.base_max ?? "",
    currency: rule.currency || "XOF",
    periodicity: rule.periodicity,
    is_active: rule.is_active,
    sort_order: rule.sort_order,
    notes: rule.notes,
  };
}

function summarizeRule(rule: ServiceBillingRule): string {
  const parts: string[] = [];
  if (rule.rate_percent != null) {
    let rate = `${Number(rule.rate_percent)} %`;
    if (rule.rate_min_percent != null || rule.rate_max_percent != null) {
      rate += ` (fourchette ${rule.rate_min_percent ?? "—"}–${rule.rate_max_percent ?? "—"} %)`;
    }
    parts.push(rate);
  }
  if (rule.fixed_amount != null) {
    let fixed = formatMoney(rule.fixed_amount, rule.currency);
    if (rule.fixed_amount_min != null || rule.fixed_amount_max != null) {
      fixed += ` (${rule.fixed_amount_min ?? "—"}–${rule.fixed_amount_max ?? "—"})`;
    }
    parts.push(fixed);
  }
  if (rule.base_min != null || rule.base_max != null) {
    parts.push(
      `tranche ${rule.base_min ?? "0"} → ${rule.base_max ?? "∞"}`,
    );
  }
  parts.push(rule.periodicity_label);
  return parts.join(" · ");
}

export function ServiceDetailPage({ caseType }: { caseType: string }) {
  const { user } = useAuth();
  const canManage = userCanManageServices(user);

  const [service, setService] = useState<ServiceOfferDetail | null>(null);
  const [meta, setMeta] = useState<ServicesMeta | null>(null);
  const [cases, setCases] = useState<ServiceBilledCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [infoName, setInfoName] = useState("");
  const [infoDescription, setInfoDescription] = useState("");
  const [infoActive, setInfoActive] = useState(true);

  const [editingRuleId, setEditingRuleId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ServiceBillingRulePayload>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

  const [periodLabel, setPeriodLabel] = useState(String(new Date().getFullYear()));
  const [generateMsg, setGenerateMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, servicesMeta, billed] = await Promise.all([
        getServiceOffer(caseType),
        getServicesMeta(),
        listServiceBilledCases(caseType),
      ]);
      setService(detail);
      setMeta(servicesMeta);
      setCases(billed.cases);
      setInfoName(detail.name);
      setInfoDescription(detail.description);
      setInfoActive(detail.is_active);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger ce service.",
      );
    } finally {
      setLoading(false);
    }
  }, [caseType]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const formulaOptions = useMemo(() => meta?.formulas ?? [], [meta]);
  const periodicityOptions = useMemo(() => meta?.periodicities ?? [], [meta]);

  function openCreate() {
    setEditingRuleId(null);
    setForm({
      ...EMPTY_FORM,
      sort_order: (service?.billing_rules.length ?? 0) + 1,
    });
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(rule: ServiceBillingRule) {
    setEditingRuleId(rule.id);
    setForm(ruleToForm(rule));
    setFormError(null);
    setShowForm(true);
  }

  async function saveServiceInfo(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateServiceOffer(caseType, {
        name: infoName.trim(),
        description: infoDescription.trim(),
        is_active: infoActive,
      });
      setService(updated);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveRule(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setFormError(null);
    const payload: ServiceBillingRulePayload = {
      ...form,
      label: form.label.trim(),
      description: (form.description ?? "").trim(),
      rate_percent: emptyToNull(form.rate_percent),
      rate_min_percent: emptyToNull(form.rate_min_percent),
      rate_max_percent: emptyToNull(form.rate_max_percent),
      fixed_amount: emptyToNull(form.fixed_amount),
      fixed_amount_min: emptyToNull(form.fixed_amount_min),
      fixed_amount_max: emptyToNull(form.fixed_amount_max),
      base_min: emptyToNull(form.base_min),
      base_max: emptyToNull(form.base_max),
      notes: form.notes?.trim() ?? "",
    };
    try {
      if (editingRuleId != null) {
        await updateServiceBillingRule(caseType, editingRuleId, payload);
      } else {
        await createServiceBillingRule(caseType, payload);
      }
      setShowForm(false);
      setEditingRuleId(null);
      await reload();
    } catch (err) {
      setFormError(
        err instanceof ApiError
          ? err.message
          : "Enregistrement de la règle impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rule: ServiceBillingRule) {
    if (!canManage) return;
    if (
      !window.confirm(
        `Supprimer la règle « ${rule.label} » ? Cette action est définitive.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      await deleteServiceBillingRule(caseType, rule.id);
      await reload();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Suppression impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerate(dryRun: boolean) {
    if (!canManage) return;
    setSaving(true);
    setGenerateMsg(null);
    setError(null);
    try {
      const result = await generateServicePeriodicBilling(caseType, {
        period_label: periodLabel.trim() || undefined,
        dry_run: dryRun,
        post: false,
      });
      const s = result.summary;
      setGenerateMsg(
        dryRun
          ? `Simulation : ${s.created} à créer, ${s.skipped} déjà présentes, ${s.errors} erreurs.`
          : `Génération : ${s.created} créées, ${s.skipped} ignorées, ${s.errors} erreurs.`,
      );
      if (!dryRun) await reload();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Génération périodique impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState label="Chargement du service…" />;
  if (error && !service) return <ErrorAlert message={error} />;
  if (!service) return <ErrorAlert message="Service introuvable." />;

  return (
    <>
      <PageHeader
        backHref="/services"
        badge={service.case_type_label}
        title={service.name}
        description="Configurez les formules de facturation (Politique Tarifaire Institutionnelle v1.0)."
      />

      {error ? <ErrorAlert message={error} /> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        <Card className="h-fit p-5">
          <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
            Fiche service
          </h2>
          <form className="mt-4 space-y-3" onSubmit={saveServiceInfo}>
            <div>
              <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                Nom
              </label>
              <input
                className="sf-input mt-1 w-full"
                value={infoName}
                disabled={!canManage || saving}
                onChange={(e) => setInfoName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                Description
              </label>
              <textarea
                className="sf-input mt-1 min-h-[120px] w-full"
                value={infoDescription}
                disabled={!canManage || saving}
                onChange={(e) => setInfoDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-[var(--sf-green-deep)]">
              <input
                type="checkbox"
                checked={infoActive}
                disabled={!canManage || saving}
                onChange={(e) => setInfoActive(e.target.checked)}
              />
              Service actif
            </label>
            {canManage ? (
              <Button type="submit" variant="gold" disabled={saving}>
                Enregistrer
              </Button>
            ) : null}
          </form>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
              Règles tarifaires ({service.billing_rules.length})
            </h2>
            {canManage ? (
              <Button
                type="button"
                variant="secondary"
                onClick={openCreate}
                disabled={saving}
              >
                Ajouter une règle
              </Button>
            ) : null}
          </div>

          {showForm && canManage ? (
            <Card className="p-5">
              <h3 className="font-semibold text-[var(--sf-green-deep)]">
                {editingRuleId ? "Modifier la règle" : "Nouvelle règle"}
              </h3>
              <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={saveRule}>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Libellé *
                  </label>
                  <input
                    className="sf-input mt-1 w-full"
                    value={form.label}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, label: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Formule
                  </label>
                  <select
                    className="sf-input mt-1 w-full"
                    value={form.formula}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        formula: e.target.value as BillingFormula,
                      }))
                    }
                  >
                    {formulaOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Périodicité
                  </label>
                  <select
                    className="sf-input mt-1 w-full"
                    value={form.periodicity}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        periodicity: e.target.value as BillingPeriodicity,
                      }))
                    }
                  >
                    {periodicityOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Taux %
                  </label>
                  <input
                    className="sf-input mt-1 w-full"
                    value={form.rate_percent ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, rate_percent: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Forfait
                  </label>
                  <input
                    className="sf-input mt-1 w-full"
                    value={form.fixed_amount ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fixed_amount: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Tranche base min (AUM)
                  </label>
                  <input
                    className="sf-input mt-1 w-full"
                    value={form.base_min ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, base_min: e.target.value }))
                    }
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Tranche base max (AUM)
                  </label>
                  <input
                    className="sf-input mt-1 w-full"
                    value={form.base_max ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, base_max: e.target.value }))
                    }
                    placeholder="vide = ∞"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Forfait min
                  </label>
                  <input
                    className="sf-input mt-1 w-full"
                    value={form.fixed_amount_min ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fixed_amount_min: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Forfait max
                  </label>
                  <input
                    className="sf-input mt-1 w-full"
                    value={form.fixed_amount_max ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fixed_amount_max: e.target.value }))
                    }
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                    Description
                  </label>
                  <textarea
                    className="sf-input mt-1 min-h-[72px] w-full"
                    value={form.description ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </div>
                {formError ? (
                  <p className="sm:col-span-2 text-sm text-red-700">{formError}</p>
                ) : null}
                <div className="flex gap-2 sm:col-span-2">
                  <Button type="submit" variant="gold" disabled={saving}>
                    Enregistrer
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={saving}
                    onClick={() => setShowForm(false)}
                  >
                    Annuler
                  </Button>
                </div>
              </form>
            </Card>
          ) : null}

          {service.billing_rules.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-sm text-[var(--sf-green)]/50">
              Aucune règle tarifaire pour ce service.
            </Card>
          ) : (
            <ul className="space-y-3">
              {service.billing_rules.map((rule) => (
                <li key={rule.id}>
                  <Card className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-[var(--sf-green-deep)]">
                            {rule.label}
                          </p>
                          {rule.is_active ? (
                            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-800">
                              Active
                            </span>
                          ) : (
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                          {rule.formula_label} · {summarizeRule(rule)}
                        </p>
                        {rule.description ? (
                          <p className="mt-2 text-sm text-[var(--sf-green)]/70">
                            {rule.description}
                          </p>
                        ) : null}
                      </div>
                      {canManage ? (
                        <div className="flex shrink-0 gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs"
                            onClick={() => openEdit(rule)}
                            disabled={saving}
                          >
                            Modifier
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs text-red-800 hover:bg-red-50"
                            onClick={() => void handleDelete(rule)}
                            disabled={saving}
                          >
                            Supprimer
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="mt-8 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
              Dossiers de ce service ({cases.length})
            </h2>
            <p className="mt-1 text-xs text-[var(--sf-green)]/55">
              Vue consolidée des dossiers et de leur facturation.
            </p>
          </div>
          {canManage ? (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                  Période
                </label>
                <input
                  className="sf-input mt-1 w-28"
                  value={periodLabel}
                  onChange={(e) => setPeriodLabel(e.target.value)}
                  placeholder="2026"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="text-xs"
                disabled={saving}
                onClick={() => void handleGenerate(true)}
              >
                Simuler
              </Button>
              <Button
                type="button"
                variant="gold"
                className="text-xs"
                disabled={saving}
                onClick={() => {
                  if (
                    window.confirm(
                      `Générer les brouillons d'honoraires périodiques pour la période « ${periodLabel || "courante"} » ?`,
                    )
                  ) {
                    void handleGenerate(false);
                  }
                }}
              >
                Générer brouillons
              </Button>
            </div>
          ) : null}
        </div>

        {generateMsg ? (
          <p className="rounded-lg border border-[var(--sf-gold)]/35 bg-[var(--sf-cream)]/60 px-3 py-2 text-sm text-[var(--sf-green-deep)]">
            {generateMsg}
          </p>
        ) : null}

        {cases.length === 0 ? (
          <Card className="border-dashed p-6 text-center text-sm text-[var(--sf-green)]/50">
            Aucun dossier pour ce type de service.
          </Card>
        ) : (
          <ul className="space-y-2">
            {cases.map((item) => (
              <li key={item.id}>
                <Card className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/factures`}
                        className="font-semibold text-[var(--sf-green-deep)] hover:underline"
                      >
                        {item.reference}
                      </Link>
                      <p className="mt-0.5 text-sm text-[var(--sf-green)]/70">
                        {item.title}
                      </p>
                      <p className="mt-1 text-xs text-[var(--sf-green)]/50">
                        {item.status_label}
                        {item.charges_count > 0
                          ? ` · ${item.charges_count} charge${item.charges_count > 1 ? "s" : ""}`
                          : " · aucune charge"}
                        {item.posted_count > 0
                          ? ` · ${formatMoney(item.total_posted, item.currency)} comptabilisés`
                          : ""}
                        {item.last_charge_period
                          ? ` · dernière période ${item.last_charge_period}`
                          : ""}
                      </p>
                    </div>
                    <Link
                      href="/factures"
                      className="sf-btn-secondary shrink-0 px-3 py-1.5 text-xs"
                    >
                      Factures →
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
