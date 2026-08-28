"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import {
  ApiError,
  apiRequest,
  cancelPeriodBillingInvoice,
  downloadPeriodBillingInvoicePdf,
  listBillingInvoices,
  postPeriodBillingInvoice,
  previewBillingInvoice,
  saveBillingInvoice,
  updatePeriodBillingInvoice,
} from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/labels";
import { userCanManageServices, userCanViewServices } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type {
  BillingInvoicePreview,
  FiduciaryCaseListItem,
  PeriodBillingInvoice,
} from "@/types/api";

type ComposeMode = "auto" | "manual";

type ComposeLine = {
  key: string;
  source: ComposeMode;
  billing_rule_id: number | null;
  formula: string;
  formula_label: string;
  label: string;
  periodicity_label: string;
  rate_percent: string | null;
  base_amount: string | null;
  amount: string;
  selected: boolean;
  error: string | null;
  notes: string;
};

type FilterTab = "all" | "draft" | "posted" | "to_bill" | "billed";

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: "all", label: "Toutes les factures" },
  { id: "draft", label: "Brouillons" },
  { id: "posted", label: "Validées" },
  { id: "to_bill", label: "Dossiers à facturer" },
  { id: "billed", label: "Dossiers déjà facturés" },
];

const PAGE_SIZE = 10;

function caseTypeLabel(c: FiduciaryCaseListItem): string {
  return c.case_type || "—";
}

function newManualLine(partial?: Partial<ComposeLine>): ComposeLine {
  return {
    key: `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    source: "manual",
    billing_rule_id: null,
    formula: "OTHER",
    formula_label: "Saisie manuelle",
    label: "",
    periodicity_label: "Libre",
    rate_percent: null,
    base_amount: null,
    amount: "",
    selected: true,
    error: null,
    notes: "",
    ...partial,
  };
}

export function FacturesWorkspace() {
  const { user } = useAuth();
  const canView = userCanViewServices(user);
  const canManage = userCanManageServices(user);

  const [items, setItems] = useState<PeriodBillingInvoice[]>([]);
  const [cases, setCases] = useState<FiduciaryCaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [periodFilter, setPeriodFilter] = useState(String(new Date().getFullYear()));
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [viewing, setViewing] = useState<PeriodBillingInvoice | null>(null);

  const [composerOpen, setComposerOpen] = useState(false);
  const [caseSearch, setCaseSearch] = useState("");
  const [caseId, setCaseId] = useState<number | "">("");
  const [periodLabel, setPeriodLabel] = useState(String(new Date().getFullYear()));
  const [composeMode, setComposeMode] = useState<ComposeMode>("auto");
  const [preview, setPreview] = useState<BillingInvoicePreview | null>(null);
  const [lines, setLines] = useState<ComposeLine[]>([]);
  const [editingInvoiceId, setEditingInvoiceId] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [composerError, setComposerError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!canView) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [data, caseList] = await Promise.all([
        listBillingInvoices(),
        apiRequest<FiduciaryCaseListItem[]>("/cases/"),
      ]);
      setItems(data.results);
      setCases(caseList);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger les factures.",
      );
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const billedCaseIds = useMemo(() => {
    const ids = new Set<number>();
    for (const inv of items) {
      if (periodFilter && inv.period_label !== periodFilter) continue;
      ids.add(inv.case_id);
    }
    return ids;
  }, [items, periodFilter]);

  const postedCaseIds = useMemo(() => {
    const ids = new Set<number>();
    for (const inv of items) {
      if (inv.status !== "POSTED") continue;
      if (periodFilter && inv.period_label !== periodFilter) continue;
      ids.add(inv.case_id);
    }
    return ids;
  }, [items, periodFilter]);

  const stats = useMemo(() => {
    const forPeriod = periodFilter
      ? items.filter((i) => i.period_label === periodFilter)
      : items;
    const drafts = forPeriod.filter((i) => i.status === "DRAFT");
    const posted = forPeriod.filter((i) => i.status === "POSTED");
    const toBill = cases.filter((c) => !billedCaseIds.has(c.id));
    const totalPosted = posted.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    return {
      invoices: forPeriod.length,
      drafts: drafts.length,
      posted: posted.length,
      toBill: toBill.length,
      billed: postedCaseIds.size,
      totalPosted,
    };
  }, [items, cases, periodFilter, billedCaseIds, postedCaseIds]);

  const filteredInvoices = useMemo(() => {
    let list = items;
    if (periodFilter) {
      list = list.filter((i) => i.period_label === periodFilter);
    }
    if (filter === "draft") list = list.filter((i) => i.status === "DRAFT");
    if (filter === "posted" || filter === "billed") {
      list = list.filter((i) => i.status === "POSTED");
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.case_reference.toLowerCase().includes(q) ||
          i.case_title.toLowerCase().includes(q) ||
          i.label.toLowerCase().includes(q) ||
          i.period_label.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, filter, periodFilter, search]);

  const casesToBill = useMemo(() => {
    let list = cases.filter((c) => !billedCaseIds.has(c.id));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.reference.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.case_type || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [cases, billedCaseIds, search]);

  const billedCases = useMemo(() => {
    let list = cases.filter((c) => billedCaseIds.has(c.id));
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (c) =>
          c.reference.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q),
      );
    }
    return list;
  }, [cases, billedCaseIds, search]);

  useEffect(() => {
    setPage(1);
  }, [filter, search, periodFilter]);

  const activeListTotal = useMemo(() => {
    if (filter === "to_bill") return casesToBill.length;
    if (filter === "billed") return billedCases.length;
    return filteredInvoices.length;
  }, [filter, casesToBill.length, billedCases.length, filteredInvoices.length]);

  const pageCount = Math.max(1, Math.ceil(activeListTotal / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  const pagedInvoices = useMemo(
    () =>
      filteredInvoices.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [filteredInvoices, currentPage],
  );

  const pagedCasesToBill = useMemo(
    () =>
      casesToBill.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [casesToBill, currentPage],
  );

  const pagedBilledCases = useMemo(
    () =>
      billedCases.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [billedCases, currentPage],
  );

  const caseSuggestions = useMemo(() => {
    const q = caseSearch.trim().toLowerCase();
    let list = cases;
    if (q) {
      list = cases.filter(
        (c) =>
          c.reference.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q) ||
          (c.case_type || "").toLowerCase().includes(q) ||
          (c.primary_donor_name || "").toLowerCase().includes(q),
      );
    }
    return list.slice(0, 12);
  }, [cases, caseSearch]);

  const selectedCase = useMemo(
    () => (caseId === "" ? null : cases.find((c) => c.id === caseId) ?? null),
    [cases, caseId],
  );

  const totalSelected = useMemo(
    () =>
      lines
        .filter((l) => l.selected)
        .reduce((sum, l) => sum + (Number(l.amount) || 0), 0),
    [lines],
  );

  const autoLines = useMemo(
    () => lines.filter((l) => l.source === "auto"),
    [lines],
  );
  const manualLines = useMemo(
    () => lines.filter((l) => l.source === "manual"),
    [lines],
  );

  function resetComposer() {
    setComposerOpen(false);
    setPreview(null);
    setLines([]);
    setEditingInvoiceId(null);
    setCaseId("");
    setCaseSearch("");
    setComposeMode("auto");
    setComposerError(null);
    setPeriodLabel(periodFilter || String(new Date().getFullYear()));
  }

  function openComposer(prefillCase?: FiduciaryCaseListItem) {
    setViewing(null);
    setComposerError(null);
    setError(null);
    setInfo(null);
    setPreview(null);
    setLines([]);
    setEditingInvoiceId(null);
    setComposeMode("auto");
    const period = periodFilter || String(new Date().getFullYear());
    setPeriodLabel(period);
    if (prefillCase) {
      setCaseId(prefillCase.id);
      setCaseSearch(`${prefillCase.reference} — ${prefillCase.title}`);
      setComposerOpen(true);
      void loadCasePreview(prefillCase.id, period);
    } else {
      setCaseId("");
      setCaseSearch("");
      setComposerOpen(true);
    }
  }

  async function loadCasePreview(forCaseId: number, period: string) {
    setLoadingPreview(true);
    setComposerError(null);
    try {
      const data = await previewBillingInvoice({
        case_id: forCaseId,
        period_label: period || undefined,
      });
      setPreview(data);
      setEditingInvoiceId(data.existing_invoice_id);
      const auto = data.lines.map((l) => ({
        key: `a-${l.billing_rule_id}`,
        source: "auto" as const,
        billing_rule_id: l.billing_rule_id,
        formula: l.formula,
        formula_label: l.formula_label,
        label: l.label,
        periodicity_label: l.periodicity_label,
        rate_percent: l.rate_percent,
        base_amount: l.base_amount,
        amount: l.amount,
        selected: l.selected,
        error: l.error,
        notes: l.notes,
      }));
      setLines((prev) => {
        const manuals = prev.filter((l) => l.source === "manual");
        return [...auto, ...manuals];
      });
      if (data.lines.length === 0) {
        setComposeMode("manual");
        setLines((prev) => {
          const manuals = prev.filter((l) => l.source === "manual");
          return manuals.length ? manuals : [newManualLine()];
        });
      }
    } catch (err) {
      setComposerError(
        err instanceof ApiError ? err.message : "Prévisualisation impossible.",
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  async function selectCaseForComposer(c: FiduciaryCaseListItem) {
    setCaseId(c.id);
    setCaseSearch(`${c.reference} — ${c.title}`);
    await loadCasePreview(c.id, periodLabel.trim());
  }

  async function handleOpenEdit(invoice: PeriodBillingInvoice) {
    setViewing(null);
    setComposerOpen(true);
    setComposerError(null);
    setCaseId(invoice.case_id);
    setCaseSearch(`${invoice.case_reference} — ${invoice.case_title}`);
    setPeriodLabel(invoice.period_label);
    setEditingInvoiceId(invoice.id);
    setLoadingPreview(true);
    try {
      const data = await previewBillingInvoice({
        case_id: invoice.case_id,
        period_label: invoice.period_label,
      });
      setPreview(data);
      const byRule = new Map(
        invoice.lines
          .filter((l) => l.billing_rule_id != null)
          .map((l) => [l.billing_rule_id as number, l] as const),
      );
      const auto: ComposeLine[] = data.lines.map((l) => {
        const saved = l.billing_rule_id != null ? byRule.get(l.billing_rule_id) : undefined;
        if (saved) {
          return {
            key: `a-${l.billing_rule_id}`,
            source: "auto",
            billing_rule_id: l.billing_rule_id,
            formula: l.formula,
            formula_label: l.formula_label,
            label: saved.label,
            periodicity_label: l.periodicity_label,
            rate_percent: saved.rate_percent,
            base_amount: saved.base_amount,
            amount: saved.amount,
            selected: saved.is_selected,
            error: l.error,
            notes: saved.notes,
          };
        }
        return {
          key: `a-${l.billing_rule_id}`,
          source: "auto",
          billing_rule_id: l.billing_rule_id,
          formula: l.formula,
          formula_label: l.formula_label,
          label: l.label,
          periodicity_label: l.periodicity_label,
          rate_percent: l.rate_percent,
          base_amount: l.base_amount,
          amount: l.amount,
          selected: false,
          error: l.error,
          notes: l.notes,
        };
      });
      const manuals: ComposeLine[] = invoice.lines
        .filter((l) => !l.billing_rule_id)
        .map((l) =>
          newManualLine({
            key: `m-saved-${l.id}`,
            label: l.label,
            amount: l.amount,
            selected: l.is_selected,
            notes: l.notes,
            formula: l.formula,
            formula_label: l.formula_label || "Saisie manuelle",
          }),
        );
      setLines([...auto, ...manuals]);
      setComposeMode(manuals.length && !auto.some((a) => a.selected) ? "manual" : "auto");
    } catch (err) {
      setComposerError(
        err instanceof ApiError ? err.message : "Chargement impossible.",
      );
    } finally {
      setLoadingPreview(false);
    }
  }

  function updateLine(key: string, patch: Partial<ComposeLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeManualLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function buildPayload() {
    if (caseId === "") return null;
    const period = preview?.period_label || periodLabel.trim();
    const payloadLines = lines
      .filter((l) => l.source === "auto" || l.label.trim() || Number(l.amount) > 0)
      .map((l) => ({
        billing_rule_id: l.billing_rule_id,
        formula: l.formula,
        label: l.label.trim(),
        amount: l.amount || "0",
        rate_percent: l.rate_percent,
        base_amount: l.base_amount,
        selected: l.selected && Boolean(l.label.trim()),
        notes: l.notes,
      }));
    return {
      case_id: Number(caseId),
      period_label: period,
      lines: payloadLines,
    };
  }

  async function handleSaveDraft() {
    if (!canManage) return;
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    setComposerError(null);
    setInfo(null);
    try {
      let invoice: PeriodBillingInvoice;
      if (editingInvoiceId) {
        invoice = await updatePeriodBillingInvoice(editingInvoiceId, {
          period_label: payload.period_label,
          lines: payload.lines,
        });
      } else {
        invoice = await saveBillingInvoice(payload);
        setEditingInvoiceId(invoice.id);
      }
      setInfo(
        `Brouillon enregistré — total ${formatMoney(invoice.amount, invoice.currency)}.`,
      );
      await reload();
    } catch (err) {
      setComposerError(
        err instanceof ApiError ? err.message : "Enregistrement impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleValidate() {
    if (!canManage) return;
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    setComposerError(null);
    try {
      let invoice: PeriodBillingInvoice;
      if (editingInvoiceId) {
        invoice = await updatePeriodBillingInvoice(editingInvoiceId, {
          period_label: payload.period_label,
          lines: payload.lines,
        });
      } else {
        invoice = await saveBillingInvoice(payload);
      }
      if (
        !window.confirm(
          `Valider et générer la facture ${invoice.period_label} pour ${formatMoney(invoice.amount, invoice.currency)} ?`,
        )
      ) {
        setEditingInvoiceId(invoice.id);
        await reload();
        return;
      }
      const posted = await postPeriodBillingInvoice(invoice.id);
      setInfo("Facture validée et générée.");
      resetComposer();
      setViewing(posted);
      await reload();
    } catch (err) {
      setComposerError(
        err instanceof ApiError ? err.message : "Validation impossible.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(invoice: PeriodBillingInvoice) {
    if (!canManage) return;
    if (!window.confirm("Annuler ce brouillon de facture ?")) return;
    setBusyId(invoice.id);
    try {
      await cancelPeriodBillingInvoice(invoice.id);
      if (viewing?.id === invoice.id) setViewing(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Annulation impossible.");
    } finally {
      setBusyId(null);
    }
  }

  async function handlePdf(invoice: PeriodBillingInvoice) {
    setBusyId(invoice.id);
    try {
      const blob = await downloadPeriodBillingInvoicePdf(invoice.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `facture-${invoice.case_reference}-${invoice.period_label}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Téléchargement PDF impossible.",
      );
    } finally {
      setBusyId(null);
    }
  }

  function latestInvoiceForCase(caseIdValue: number): PeriodBillingInvoice | undefined {
    return items
      .filter((i) => i.case_id === caseIdValue)
      .filter((i) => !periodFilter || i.period_label === periodFilter)
      .sort((a, b) => b.id - a.id)[0];
  }

  if (!canView) {
    return (
      <ErrorAlert message="Accès réservé à la Direction, l'administration ou la comptabilité." />
    );
  }

  const showInvoiceList =
    filter === "all" || filter === "draft" || filter === "posted";
  const showToBill = filter === "to_bill";

  return (
    <div className="space-y-8">
      <PageHeader
        badge="Facturation"
        title="Factures"
        description="Composez les honoraires par dossier — automatiquement via la grille tarifaire, ou manuellement — puis validez en un coup d’œil."
        action={
          canManage ? (
            <Button type="button" variant="gold" onClick={() => openComposer()}>
              Nouvelle facture
            </Button>
          ) : undefined
        }
      />

      {/* Synthèse période */}
      <section className="overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--sf-cream-dark)] bg-gradient-to-br from-[var(--sf-green-deep)] to-[var(--sf-green)] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--sf-gold)]/85">
              Synthèse
            </p>
            <p className="mt-1 text-lg font-semibold">
              Période {periodFilter || "toutes"}
            </p>
            <p className="mt-0.5 text-sm text-white/65">
              {stats.posted} validée{stats.posted > 1 ? "s" : ""} ·{" "}
              {stats.drafts} brouillon{stats.drafts > 1 ? "s" : ""} ·{" "}
              {stats.toBill} dossier{stats.toBill > 1 ? "s" : ""} à facturer
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-white/50">
              Total validé
            </p>
            <p className="sf-display text-2xl font-semibold tabular-nums text-[var(--sf-gold)]">
              {formatMoney(String(stats.totalPosted), "XOF")}
            </p>
          </div>
        </div>
        <div className="grid gap-px bg-[var(--sf-cream-dark)] sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Toutes"
            value={String(stats.invoices)}
            hint="Factures de la période"
            accent="neutral"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <StatCard
            label="Brouillons"
            value={String(stats.drafts)}
            hint="À finaliser"
            accent="amber"
            active={filter === "draft"}
            onClick={() => setFilter("draft")}
          />
          <StatCard
            label="À facturer"
            value={String(stats.toBill)}
            hint="Dossiers sans facture"
            accent="gold"
            active={filter === "to_bill"}
            onClick={() => setFilter("to_bill")}
          />
          <StatCard
            label="Validées"
            value={String(stats.posted)}
            hint={formatMoney(String(stats.totalPosted), "XOF")}
            accent="emerald"
            active={filter === "posted" || filter === "billed"}
            onClick={() => setFilter("posted")}
          />
        </div>
      </section>

      {/* Barre de filtres */}
      <div className="rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex flex-wrap gap-1.5" aria-label="Filtres factures">
            {FILTER_TABS.map((tab) => {
              const count =
                tab.id === "all"
                  ? stats.invoices
                  : tab.id === "draft"
                    ? stats.drafts
                    : tab.id === "posted"
                      ? stats.posted
                      : tab.id === "to_bill"
                        ? stats.toBill
                        : stats.billed;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition ${
                    filter === tab.id
                      ? "bg-[var(--sf-green)] text-[var(--sf-gold)] shadow-sm"
                      : "bg-[var(--sf-cream)]/50 text-[var(--sf-green)]/65 hover:bg-[var(--sf-cream)] hover:text-[var(--sf-green-deep)]"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] tabular-nums ${
                      filter === tab.id
                        ? "bg-white/15 text-[var(--sf-gold)]"
                        : "bg-white text-[var(--sf-green)]/50"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                Période
              </span>
              <input
                className="sf-input w-28"
                value={periodFilter}
                onChange={(e) => setPeriodFilter(e.target.value)}
                placeholder="2026"
                title="Filtrer par période"
              />
            </label>
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Rechercher</span>
              <input
                className="sf-input w-full pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Référence, titre, dossier…"
              />
              <span
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--sf-green)]/35"
                aria-hidden
              >
                ⌕
              </span>
            </label>
          </div>
        </div>
        <p className="mt-3 text-xs text-[var(--sf-green)]/45">
          <Link
            href="/services"
            className="font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Voir la grille tarifaire des services
          </Link>
          {" · "}
          Une facture par dossier et période
        </p>
      </div>

      {info ? (
        <p className="rounded-xl border border-[var(--sf-gold)]/35 bg-[var(--sf-cream)]/70 px-4 py-3 text-sm text-[var(--sf-green-deep)]">
          {info}
        </p>
      ) : null}
      {error ? <ErrorAlert message={error} /> : null}

      {composerOpen && canManage ? (
        <InvoiceComposerModal
          editingInvoiceId={editingInvoiceId}
          caseSearch={caseSearch}
          onCaseSearchChange={(v) => {
            setCaseSearch(v);
            if (caseId !== "") setCaseId("");
            setPreview(null);
            setLines((prev) => prev.filter((l) => l.source === "manual"));
          }}
          caseSuggestions={caseSuggestions}
          selectedCase={selectedCase}
          billedCaseIds={billedCaseIds}
          periodLabel={periodLabel}
          onPeriodChange={async (v) => {
            setPeriodLabel(v);
            if (caseId !== "") await loadCasePreview(Number(caseId), v.trim());
          }}
          composeMode={composeMode}
          onComposeModeChange={(mode) => {
            setComposeMode(mode);
            if (mode === "manual" && manualLines.length === 0) {
              setLines((prev) => [...prev, newManualLine()]);
            }
          }}
          preview={preview}
          autoLines={autoLines}
          manualLines={manualLines}
          totalSelected={totalSelected}
          loadingPreview={loadingPreview}
          saving={saving}
          composerError={composerError}
          onSelectCase={(c) => void selectCaseForComposer(c)}
          onUpdateLine={updateLine}
          onAddManualLine={() => setLines((prev) => [...prev, newManualLine()])}
          onRemoveManualLine={removeManualLine}
          onClose={resetComposer}
          onSaveDraft={() => void handleSaveDraft()}
          onValidate={() => void handleValidate()}
        />
      ) : null}

      {viewing ? (
        <InvoiceDetailModal
          invoice={viewing}
          canManage={canManage}
          busy={busyId === viewing.id}
          onClose={() => setViewing(null)}
          onPdf={() => void handlePdf(viewing)}
          onEdit={() => void handleOpenEdit(viewing)}
          onValidate={async () => {
            setBusyId(viewing.id);
            try {
              const posted = await postPeriodBillingInvoice(viewing.id);
              setViewing(posted);
              setInfo("Facture validée.");
              await reload();
            } catch (err) {
              setError(
                err instanceof ApiError ? err.message : "Validation impossible.",
              );
            } finally {
              setBusyId(null);
            }
          }}
          onCancel={() => void handleCancel(viewing)}
        />
      ) : null}

      {loading || (loadingPreview && !composerOpen) ? (
        <LoadingState label="Chargement…" />
      ) : null}

      {!loading && showToBill ? (
        casesToBill.length === 0 ? (
          <EmptyState
            title="Aucun dossier à facturer"
            description={`Tous les dossiers ont une facture pour la période ${periodFilter || "courante"}.`}
          />
        ) : (
          <CaseListPanel
            title="Dossiers à facturer"
            count={casesToBill.length}
            subtitle={`Période ${periodFilter || "courante"} — dossiers sans facture`}
            footer={
              <ListPagination
                page={currentPage}
                pageCount={pageCount}
                total={casesToBill.length}
                pageSize={PAGE_SIZE}
                label="dossiers"
                onPageChange={setPage}
              />
            }
          >
            {pagedCasesToBill.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-[var(--sf-cream)]/35"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--sf-green-deep)]">
                      {c.reference}
                    </p>
                    <span className="rounded-md bg-[var(--sf-cream)] px-2 py-0.5 text-[10px] font-medium text-[var(--sf-green)]/60">
                      {caseTypeLabel(c)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-[var(--sf-green)]/65">{c.title}</p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/dossiers/${c.id}`}
                    className="sf-btn-secondary px-3 py-1.5 text-xs"
                  >
                    Dossier
                  </Link>
                  {canManage ? (
                    <Button
                      type="button"
                      variant="gold"
                      className="text-xs"
                      onClick={() => openComposer(c)}
                    >
                      Facturer
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </CaseListPanel>
        )
      ) : null}

      {!loading && filter === "billed" ? (
        billedCases.length === 0 ? (
          <EmptyState
            title="Aucun dossier facturé"
            description="Aucune facture pour cette période."
          />
        ) : (
          <CaseListPanel
            title="Dossiers déjà facturés"
            count={billedCases.length}
            subtitle={`Factures associées à la période ${periodFilter || "courante"}`}
            footer={
              <ListPagination
                page={currentPage}
                pageCount={pageCount}
                total={billedCases.length}
                pageSize={PAGE_SIZE}
                label="dossiers"
                onPageChange={setPage}
              />
            }
          >
            {pagedBilledCases.map((c) => {
              const inv = latestInvoiceForCase(c.id);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 transition hover:bg-[var(--sf-cream)]/35"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--sf-green-deep)]">
                      {c.reference}
                    </p>
                    <p className="mt-0.5 text-sm text-[var(--sf-green)]/65">{c.title}</p>
                    {inv ? (
                      <p className="mt-1 text-xs text-[var(--sf-green)]/50">
                        {inv.period_label} · {inv.status_label} ·{" "}
                        <span className="font-medium tabular-nums text-[var(--sf-green-deep)]">
                          {formatMoney(inv.amount, inv.currency)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    {inv ? (
                      <Button
                        type="button"
                        variant="secondary"
                        className="text-xs"
                        onClick={() => setViewing(inv)}
                      >
                        Voir la facture
                      </Button>
                    ) : null}
                    <Link
                      href={`/dossiers/${c.id}`}
                      className="sf-btn-secondary px-3 py-1.5 text-xs"
                    >
                      Dossier
                    </Link>
                  </div>
                </li>
              );
            })}
          </CaseListPanel>
        )
      ) : null}

      {!loading && showInvoiceList ? (
        filteredInvoices.length === 0 ? (
          <EmptyState
            title="Aucune facture"
            description={
              canManage
                ? "Créez une facture ou changez de filtre / période."
                : "Aucune facture ne correspond à ce filtre."
            }
          />
        ) : (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3 px-1">
              <div>
                <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                  {filter === "draft"
                    ? "Brouillons"
                    : filter === "posted"
                      ? "Factures validées"
                      : "Liste des factures"}
                </h2>
                <p className="text-xs text-[var(--sf-green)]/45">
                  {filteredInvoices.length} résultat
                  {filteredInvoices.length > 1 ? "s" : ""}
                  {pageCount > 1
                    ? ` · page ${currentPage}/${pageCount}`
                    : ""}
                </p>
              </div>
            </div>
            <ul className="space-y-3">
              {pagedInvoices.map((invoice) => {
                const lineCount = invoice.lines.filter((l) => l.is_selected).length;
                return (
                  <li
                    key={invoice.id}
                    className="group overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm transition hover:border-[var(--sf-green)]/20 hover:shadow-md"
                  >
                    <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-stretch sm:gap-0">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setViewing(invoice)}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusPill status={invoice.status} label={invoice.status_label} />
                          <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/40">
                            {invoice.case_type_label}
                          </span>
                          <span className="text-[10px] text-[var(--sf-green)]/35">
                            {invoice.period_label}
                          </span>
                        </div>
                        <p className="mt-2 sf-display text-base font-semibold text-[var(--sf-green-deep)] group-hover:text-[var(--sf-green)]">
                          {invoice.label}
                        </p>
                        <p className="mt-1 text-sm text-[var(--sf-green)]/60">
                          <span className="font-medium text-[var(--sf-green-mid)]">
                            {invoice.case_reference}
                          </span>
                          {" — "}
                          {invoice.case_title}
                        </p>
                        <p className="mt-2 text-xs text-[var(--sf-green)]/45">
                          {lineCount} ligne{lineCount > 1 ? "s" : ""} ·{" "}
                          {formatDate(invoice.movement_date)}
                          {invoice.created_by_username
                            ? ` · ${invoice.created_by_username}`
                            : ""}
                        </p>
                      </button>

                      <div className="flex flex-row items-center justify-between gap-4 border-t border-[var(--sf-cream-dark)] pt-3 sm:w-52 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:border-l sm:pt-0 sm:pl-5">
                        <div className="text-right">
                          <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/40">
                            Montant
                          </p>
                          <p className="mt-0.5 text-lg font-semibold tabular-nums text-[var(--sf-green-deep)]">
                            {formatMoney(invoice.amount, invoice.currency)}
                          </p>
                        </div>
                        <div className="flex flex-wrap justify-end gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs"
                            onClick={() => setViewing(invoice)}
                          >
                            Voir
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            className="text-xs"
                            disabled={busyId === invoice.id}
                            onClick={() => void handlePdf(invoice)}
                          >
                            PDF
                          </Button>
                          {canManage && invoice.status === "DRAFT" ? (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                className="text-xs"
                                onClick={() => void handleOpenEdit(invoice)}
                              >
                                Modifier
                              </Button>
                              <Button
                                type="button"
                                variant="gold"
                                className="text-xs"
                                disabled={busyId === invoice.id}
                                onClick={async () => {
                                  setBusyId(invoice.id);
                                  try {
                                    const posted = await postPeriodBillingInvoice(
                                      invoice.id,
                                    );
                                    setViewing(posted);
                                    await reload();
                                  } catch (err) {
                                    setError(
                                      err instanceof ApiError
                                        ? err.message
                                        : "Validation impossible.",
                                    );
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                              >
                                Valider
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                className="text-xs text-red-800"
                                disabled={busyId === invoice.id}
                                onClick={() => void handleCancel(invoice)}
                              >
                                Annuler
                              </Button>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <ListPagination
              page={currentPage}
              pageCount={pageCount}
              total={filteredInvoices.length}
              pageSize={PAGE_SIZE}
              label="factures"
              onPageChange={setPage}
              className="rounded-2xl border border-[var(--sf-cream-dark)] bg-white px-4 py-3 shadow-sm"
            />
          </section>
        )
      ) : null}
    </div>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: PeriodBillingInvoice["status"];
  label: string;
}) {
  const cls =
    status === "POSTED"
      ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
      : status === "DRAFT"
        ? "bg-amber-50 text-amber-900 ring-amber-100"
        : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${cls}`}
    >
      {label}
    </span>
  );
}

function CaseListPanel({
  title,
  count,
  subtitle,
  children,
  footer,
}: {
  title: string;
  count: number;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
      <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/45 px-5 py-4">
        <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
          {title}{" "}
          <span className="font-normal text-[var(--sf-green)]/45">({count})</span>
        </h2>
        <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">{subtitle}</p>
      </div>
      <ul className="divide-y divide-[var(--sf-cream-dark)]">{children}</ul>
      {footer}
    </section>
  );
}

function ListPagination({
  page,
  pageCount,
  total,
  pageSize,
  label,
  onPageChange,
  className = "",
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  label: string;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (total === 0 || pageCount <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-t border-[var(--sf-cream-dark)] px-4 py-3 ${className}`}
    >
      <p className="text-xs text-[var(--sf-green)]/55">
        Page {page} sur {pageCount} · {from}–{to} sur {total} {label}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-1.5 text-xs font-medium text-[var(--sf-green)] transition hover:bg-[var(--sf-cream)]/40 disabled:cursor-default disabled:opacity-40"
        >
          ← Précédent
        </button>
        {Array.from({ length: pageCount }, (_, i) => i + 1)
          .filter(
            (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1,
          )
          .map((p, idx, arr) => (
            <span key={p} className="flex items-center">
              {idx > 0 && arr[idx - 1] !== p - 1 ? (
                <span className="px-1 text-xs text-[var(--sf-green)]/40">…</span>
              ) : null}
              <button
                type="button"
                onClick={() => onPageChange(p)}
                aria-current={p === page ? "page" : undefined}
                className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                  p === page
                    ? "bg-[var(--sf-green)] text-[var(--sf-gold)]"
                    : "text-[var(--sf-green)]/60 hover:bg-[var(--sf-cream)]/40"
                }`}
              >
                {p}
              </button>
            </span>
          ))}
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-1.5 text-xs font-medium text-[var(--sf-green)] transition hover:bg-[var(--sf-cream)]/40 disabled:cursor-default disabled:opacity-40"
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  active,
  accent = "neutral",
  onClick,
}: {
  label: string;
  value: string;
  hint: string;
  active?: boolean;
  accent?: "neutral" | "amber" | "gold" | "emerald";
  onClick?: () => void;
}) {
  const bar =
    accent === "amber"
      ? "bg-amber-400"
      : accent === "gold"
        ? "bg-[var(--sf-gold)]"
        : accent === "emerald"
          ? "bg-emerald-500"
          : "bg-[var(--sf-green-mid)]";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative bg-white px-5 py-4 text-left transition ${
        active
          ? "bg-[var(--sf-cream)]/80 ring-2 ring-inset ring-[var(--sf-gold)]/40"
          : "hover:bg-[var(--sf-cream)]/40"
      }`}
    >
      <span
        className={`absolute top-0 left-0 h-full w-1 ${bar} ${active ? "opacity-100" : "opacity-40"}`}
        aria-hidden
      />
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--sf-green-deep)]">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-[var(--sf-green)]/50">{hint}</p>
    </button>
  );
}

function InvoiceComposerModal({
  editingInvoiceId,
  caseSearch,
  onCaseSearchChange,
  caseSuggestions,
  selectedCase,
  billedCaseIds,
  periodLabel,
  onPeriodChange,
  composeMode,
  onComposeModeChange,
  preview,
  autoLines,
  manualLines,
  totalSelected,
  loadingPreview,
  saving,
  composerError,
  onSelectCase,
  onUpdateLine,
  onAddManualLine,
  onRemoveManualLine,
  onClose,
  onSaveDraft,
  onValidate,
}: {
  editingInvoiceId: number | null;
  caseSearch: string;
  onCaseSearchChange: (v: string) => void;
  caseSuggestions: FiduciaryCaseListItem[];
  selectedCase: FiduciaryCaseListItem | null;
  billedCaseIds: Set<number>;
  periodLabel: string;
  onPeriodChange: (v: string) => void | Promise<void>;
  composeMode: ComposeMode;
  onComposeModeChange: (m: ComposeMode) => void;
  preview: BillingInvoicePreview | null;
  autoLines: ComposeLine[];
  manualLines: ComposeLine[];
  totalSelected: number;
  loadingPreview: boolean;
  saving: boolean;
  composerError: string | null;
  onSelectCase: (c: FiduciaryCaseListItem) => void;
  onUpdateLine: (key: string, patch: Partial<ComposeLine>) => void;
  onAddManualLine: () => void;
  onRemoveManualLine: (key: string) => void;
  onClose: () => void;
  onSaveDraft: () => void;
  onValidate: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, saving]);

  const previewLines = [...autoLines, ...manualLines].filter(
    (l) => l.selected && l.label.trim(),
  );
  const caseReady = Boolean(selectedCase || preview);
  const showSuggestions = !selectedCase && caseSearch.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-3 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-composer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--sf-cream-dark)] bg-[var(--sf-green-deep)] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-gold)]/80">
              {editingInvoiceId ? "Modification" : "Nouvelle facture"}
            </p>
            <h2 id="invoice-composer-title" className="mt-1 text-lg font-semibold">
              Composer une facture
            </h2>
            <p className="mt-1 text-sm text-white/70">
              Recherchez un dossier, choisissez le mode, contrôlez l’aperçu.
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            disabled={saving}
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>

        <div className="grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4 overflow-y-auto border-b border-[var(--sf-cream-dark)] p-5 lg:border-b-0 lg:border-r">
            <div>
              <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                Rechercher un dossier
              </label>
              <input
                className="sf-input mt-1 w-full"
                value={caseSearch}
                onChange={(e) => onCaseSearchChange(e.target.value)}
                placeholder="Référence, titre, type…"
                autoFocus
              />
              {showSuggestions ? (
                <ul className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-[var(--sf-cream-dark)] bg-white shadow-sm">
                  {caseSuggestions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-[var(--sf-green)]/50">
                      Aucun dossier trouvé.
                    </li>
                  ) : (
                    caseSuggestions.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="flex w-full flex-col px-3 py-2 text-left hover:bg-[var(--sf-cream)]/60"
                          onClick={() => onSelectCase(c)}
                        >
                          <span className="text-sm font-medium text-[var(--sf-green-deep)]">
                            {c.reference}
                            {billedCaseIds.has(c.id) ? (
                              <span className="ml-2 text-[10px] font-normal text-amber-800">
                                déjà facturé
                              </span>
                            ) : null}
                          </span>
                          <span className="text-xs text-[var(--sf-green)]/55">
                            {c.title} · {caseTypeLabel(c)}
                          </span>
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                  Période
                </label>
                <input
                  className="sf-input mt-1 w-full"
                  value={periodLabel}
                  onChange={(e) => void onPeriodChange(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--sf-green)]/60">
                  Mode de facturation
                </label>
                <div className="mt-1 flex rounded-lg border border-[var(--sf-cream-dark)] p-0.5">
                  <button
                    type="button"
                    className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                      composeMode === "auto"
                        ? "bg-[var(--sf-green)] text-[var(--sf-gold)]"
                        : "text-[var(--sf-green)]/60"
                    }`}
                    onClick={() => onComposeModeChange("auto")}
                  >
                    Automatique
                  </button>
                  <button
                    type="button"
                    className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition ${
                      composeMode === "manual"
                        ? "bg-[var(--sf-green)] text-[var(--sf-gold)]"
                        : "text-[var(--sf-green)]/60"
                    }`}
                    onClick={() => onComposeModeChange("manual")}
                  >
                    Manuelle
                  </button>
                </div>
              </div>
            </div>

            {composerError ? <ErrorAlert message={composerError} /> : null}
            {loadingPreview ? <LoadingState label="Chargement du dossier…" /> : null}

            {caseReady && !loadingPreview && composeMode === "auto" ? (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                    Règles du service
                  </h3>
                  {preview?.service ? (
                    <Link
                      href={`/services/${preview.service.case_type}`}
                      className="text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
                    >
                      Grille →
                    </Link>
                  ) : null}
                </div>
                {!preview?.service ? (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Aucun service catalogue pour ce dossier. Passez en mode
                    manuelle.
                  </p>
                ) : autoLines.length === 0 ? (
                  <p className="text-sm text-[var(--sf-green)]/55">
                    Aucune règle applicable. Ajoutez des lignes manuelles.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {autoLines.map((line) => (
                      <li
                        key={line.key}
                        className={`rounded-lg border px-3 py-3 ${
                          line.selected
                            ? "border-[var(--sf-gold)]/40 bg-white"
                            : "border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 opacity-70"
                        }`}
                      >
                        <div className="flex flex-wrap items-start gap-3">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={line.selected}
                            onChange={() =>
                              onUpdateLine(line.key, { selected: !line.selected })
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-[var(--sf-green-deep)]">
                              {line.label}
                            </p>
                            <p className="text-xs text-[var(--sf-green)]/55">
                              {line.formula_label} · {line.periodicity_label}
                              {line.rate_percent ? ` · ${line.rate_percent} %` : ""}
                            </p>
                            {line.error ? (
                              <p className="mt-1 text-xs text-amber-800">{line.error}</p>
                            ) : null}
                          </div>
                          <input
                            className="sf-input w-36 text-right tabular-nums"
                            type="number"
                            step="1"
                            value={line.amount}
                            disabled={!line.selected}
                            onChange={(e) =>
                              onUpdateLine(line.key, { amount: e.target.value })
                            }
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="mt-3 text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
                  onClick={() => onComposeModeChange("manual")}
                >
                  + Ajouter aussi des lignes manuelles
                </button>
              </div>
            ) : null}

            {caseReady && !loadingPreview && composeMode === "manual" ? (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                      Lignes manuelles
                    </h3>
                    <Button
                      type="button"
                      variant="secondary"
                      className="text-xs"
                      onClick={onAddManualLine}
                    >
                      + Ligne
                    </Button>
                  </div>
                  {manualLines.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[var(--sf-cream-dark)] px-3 py-4 text-sm text-[var(--sf-green)]/50">
                      Aucune ligne manuelle. Cliquez sur « + Ligne » pour en ajouter.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {manualLines.map((line, idx) => (
                        <li
                          key={line.key}
                          className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-3 py-3"
                        >
                          <div className="grid gap-2 sm:grid-cols-[1fr_8rem_auto]">
                            <div>
                              <label className="text-[10px] uppercase tracking-wide text-[var(--sf-green)]/45">
                                Désignation {idx + 1}
                              </label>
                              <input
                                className="sf-input mt-1 w-full"
                                value={line.label}
                                placeholder="Ex. Honoraires de mission"
                                onChange={(e) =>
                                  onUpdateLine(line.key, {
                                    label: e.target.value,
                                    selected: true,
                                  })
                                }
                              />
                            </div>
                            <div>
                              <label className="text-[10px] uppercase tracking-wide text-[var(--sf-green)]/45">
                                Montant
                              </label>
                              <input
                                className="sf-input mt-1 w-full text-right tabular-nums"
                                type="number"
                                step="1"
                                min="0"
                                value={line.amount}
                                placeholder="0"
                                onChange={(e) =>
                                  onUpdateLine(line.key, {
                                    amount: e.target.value,
                                    selected: true,
                                  })
                                }
                              />
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="secondary"
                                className="text-xs text-red-800"
                                onClick={() => onRemoveManualLine(line.key)}
                              >
                                Retirer
                              </Button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {autoLines.some((l) => l.selected) ? (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-[var(--sf-green-deep)]">
                      Lignes automatiques incluses
                    </h3>
                    <ul className="space-y-2">
                      {autoLines
                        .filter((l) => l.selected)
                        .map((line) => (
                          <li
                            key={line.key}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--sf-gold)]/35 bg-[var(--sf-cream)]/40 px-3 py-2"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-[var(--sf-green-deep)]">
                                {line.label}
                              </p>
                              <p className="text-xs tabular-nums text-[var(--sf-green)]/55">
                                {formatMoney(line.amount || "0", "XOF")} · auto
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="secondary"
                              className="text-xs text-red-800"
                              onClick={() =>
                                onUpdateLine(line.key, { selected: false })
                              }
                            >
                              Retirer
                            </Button>
                          </li>
                        ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}

            {!caseReady && !loadingPreview ? (
              <p className="text-sm text-[var(--sf-green)]/55">
                Sélectionnez un dossier pour composer la facture.
              </p>
            ) : null}
          </div>

          {/* Live preview — même présentation que la facture */}
          <div className="flex min-h-0 flex-col overflow-hidden bg-[var(--sf-cream)]/30">
            <div className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-green-deep)] px-5 py-4 text-white">
              <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-gold)]/80">
                Aperçu facture
              </p>
              <h3 className="mt-1 text-base font-semibold">
                Facture honoraires {periodLabel}
                {preview || selectedCase
                  ? ` — ${preview?.case_reference || selectedCase?.reference}`
                  : ""}
              </h3>
              <p className="mt-1 text-sm text-white/70">
                {preview?.case_title ||
                  selectedCase?.title ||
                  "Dossier non sélectionné"}
              </p>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex flex-wrap gap-2 text-xs text-[var(--sf-green)]/55">
                {(preview?.case_type_label || selectedCase?.case_type) && (
                  <span className="rounded-md bg-white px-2 py-0.5">
                    {preview?.case_type_label || selectedCase?.case_type}
                  </span>
                )}
                {preview?.service ? (
                  <span className="rounded-md bg-white px-2 py-0.5">
                    {preview.service.name}
                  </span>
                ) : null}
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-amber-900">
                  Brouillon
                </span>
              </div>

              {previewLines.length === 0 ? (
                <p className="text-sm text-[var(--sf-green)]/50">
                  Aucune ligne sélectionnée. Cochez des règles ou saisissez une
                  désignation et un montant.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--sf-cream-dark)] text-left text-[10px] uppercase tracking-wide text-[var(--sf-green)]/45">
                      <th className="pb-2 font-medium">Désignation</th>
                      <th className="pb-2 text-right font-medium">Montant</th>
                      <th className="pb-2 text-right font-medium"> </th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewLines.map((line) => (
                      <tr
                        key={line.key}
                        className="border-b border-[var(--sf-cream-dark)]/60"
                      >
                        <td className="py-2.5">
                          <p className="font-medium text-[var(--sf-green-deep)]">
                            {line.label}
                          </p>
                          <p className="text-xs text-[var(--sf-green)]/50">
                            {line.source === "manual"
                              ? "Saisie manuelle"
                              : line.formula_label}
                          </p>
                        </td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--sf-green-deep)]">
                          {formatMoney(line.amount || "0", "XOF")}
                        </td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            className="text-xs font-medium text-red-800 hover:underline"
                            onClick={() => {
                              if (line.source === "manual") {
                                onRemoveManualLine(line.key);
                              } else {
                                onUpdateLine(line.key, { selected: false });
                              }
                            }}
                          >
                            Retirer
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
                  Total
                </p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--sf-green-deep)]">
                  {formatMoney(String(totalSelected), "XOF")}
                </p>
                <p className="mt-1 text-xs text-[var(--sf-green)]/50">
                  {previewLines.length} ligne(s) · mis à jour automatiquement
                </p>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--sf-cream-dark)] bg-white p-4">
              <Button
                type="button"
                variant="secondary"
                disabled={saving || !caseReady || totalSelected <= 0}
                onClick={onSaveDraft}
              >
                Enregistrer brouillon
              </Button>
              <Button
                type="button"
                variant="gold"
                disabled={saving || !caseReady || totalSelected <= 0}
                onClick={onValidate}
              >
                Valider et générer
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InvoiceDetailModal({
  invoice,
  canManage,
  busy,
  onClose,
  onPdf,
  onEdit,
  onValidate,
  onCancel,
}: {
  invoice: PeriodBillingInvoice;
  canManage: boolean;
  busy: boolean;
  onClose: () => void;
  onPdf: () => void;
  onEdit: () => void;
  onValidate: () => void;
  onCancel: () => void;
}) {
  const selectedLines = invoice.lines.filter((l) => l.is_selected);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invoice-detail-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--sf-cream-dark)] bg-[var(--sf-green-deep)] px-5 py-4 text-white">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-gold)]/80">
              Aperçu facture
            </p>
            <h2 id="invoice-detail-title" className="mt-1 text-lg font-semibold">
              {invoice.label}
            </h2>
            <p className="mt-1 text-sm text-white/70">
              {invoice.case_reference} — {invoice.case_title} · {invoice.period_label}
            </p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="text-xs"
            disabled={busy}
            onClick={onClose}
          >
            Fermer
          </Button>
        </div>

        <div className="grid gap-4 overflow-y-auto p-5 lg:grid-cols-[1fr_240px]">
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-[var(--sf-green)]/55">
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                  invoice.status === "POSTED"
                    ? "bg-emerald-50 text-emerald-800"
                    : "bg-amber-50 text-amber-900"
                }`}
              >
                {invoice.status_label}
              </span>
              <span>{invoice.case_type_label}</span>
              <span>·</span>
              <span>{formatDate(invoice.movement_date)}</span>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--sf-cream-dark)] text-left text-[10px] uppercase tracking-wide text-[var(--sf-green)]/45">
                  <th className="pb-2 font-medium">Désignation</th>
                  <th className="pb-2 text-right font-medium">Montant</th>
                </tr>
              </thead>
              <tbody>
                {selectedLines.map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-[var(--sf-cream-dark)]/60"
                  >
                    <td className="py-2.5">
                      <p className="font-medium text-[var(--sf-green-deep)]">
                        {line.label}
                      </p>
                      <p className="text-xs text-[var(--sf-green)]/50">
                        {line.billing_rule_id
                          ? line.formula_label
                          : "Saisie manuelle"}
                        {line.rate_percent ? ` · ${line.rate_percent} %` : ""}
                      </p>
                    </td>
                    <td className="py-2.5 text-right tabular-nums font-semibold text-[var(--sf-green-deep)]">
                      {formatMoney(line.amount, invoice.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
              Total
            </p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-[var(--sf-green-deep)]">
              {formatMoney(invoice.amount, invoice.currency)}
            </p>
            <p className="mt-1 text-xs text-[var(--sf-green)]/50">
              {selectedLines.length} ligne(s) facturée(s)
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button type="button" variant="secondary" disabled={busy} onClick={onPdf}>
                Télécharger PDF
              </Button>
              <Link
                href={`/dossiers/${invoice.case_id}`}
                className="sf-btn-secondary px-3 py-2 text-center text-sm"
              >
                Ouvrir le dossier
              </Link>
              {canManage && invoice.status === "DRAFT" ? (
                <>
                  <Button type="button" variant="secondary" disabled={busy} onClick={onEdit}>
                    Modifier
                  </Button>
                  <Button type="button" variant="gold" disabled={busy} onClick={onValidate}>
                    Valider la facture
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="text-red-800"
                    disabled={busy}
                    onClick={onCancel}
                  >
                    Annuler le brouillon
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
