"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatDate, formatMoney } from "@/lib/labels";
import { userCanManageEnterpriseFinance } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { EnterpriseMovement, MovementCategory } from "@/types/api";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  INCOME: "Recette",
  EXPENSE: "Dépense",
  MANAGEMENT_FEE: "Frais de gestion",
  PERFORMANCE_FEE: "Frais de performance",
  TRANSFER: "Virement",
  ADJUSTMENT: "Ajustement",
};

type Props = {
  title: string;
  movementTypes: string[];
  defaultMovementType: string;
  /** Recettes ou dépenses : catégories obligatoires et gérées sur place. */
  categoryScope?: "REVENUE" | "EXPENSE";
  /**
   * Recettes métier = factures validées uniquement.
   * Désactive la saisie manuelle de recettes et oriente vers /factures.
   */
  invoiceLinkedRevenue?: boolean;
};

type WorkspaceView = "gerer" | "historique";

const MONTH_OPTIONS = [
  { value: "01", label: "Janvier" },
  { value: "02", label: "Février" },
  { value: "03", label: "Mars" },
  { value: "04", label: "Avril" },
  { value: "05", label: "Mai" },
  { value: "06", label: "Juin" },
  { value: "07", label: "Juillet" },
  { value: "08", label: "Août" },
  { value: "09", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
] as const;

export function EnterpriseMovementsWorkspace({
  title,
  movementTypes,
  defaultMovementType,
  categoryScope,
  invoiceLinkedRevenue = false,
}: Props) {
  const { user } = useAuth();
  const canManage = userCanManageEnterpriseFinance(user);
  const [categories, setCategories] = useState<MovementCategory[]>([]);
  const [movements, setMovements] = useState<EnterpriseMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EnterpriseMovement | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [view, setView] = useState<WorkspaceView>(
    invoiceLinkedRevenue ? "historique" : "gerer",
  );

  const [filterCategory, setFilterCategory] = useState("");
  const [filterYear, setFilterYear] = useState(() =>
    String(new Date().getFullYear()),
  );
  const [filterMonth, setFilterMonth] = useState(() =>
    String(new Date().getMonth() + 1).padStart(2, "0"),
  );
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const [page, setPage] = useState(1);

  const [movementType, setMovementType] = useState(defaultMovementType);
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryLabel, setNewCategoryLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [movementDate, setMovementDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [descriptionField, setDescriptionField] = useState("");
  const [reference, setReference] = useState("");
  const [justificatifFile, setJustificatifFile] = useState<File | null>(null);

  const activeCategories = useMemo(
    () =>
      categories
        .filter(
          (c) =>
            c.is_active
            && (!categoryScope || c.scope === categoryScope)
            && c.movement_type === movementType,
        )
        .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label)),
    [categories, categoryScope, movementType],
  );

  const categoryTotals = useMemo(() => {
    const totals = new Map<number, number>();
    for (const m of movements) {
      if (!m.category) continue;
      totals.set(m.category, (totals.get(m.category) ?? 0) + Math.abs(Number(m.signed_amount)));
    }
    return totals;
  }, [movements]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    years.add(String(new Date().getFullYear()));
    for (const m of movements) years.add(m.movement_date.slice(0, 4));
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return movements.filter((m) => {
      if (filterCategory === "none" && m.category) return false;
      if (
        filterCategory
        && filterCategory !== "none"
        && String(m.category) !== filterCategory
      ) {
        return false;
      }
      if (filterYear && m.movement_date.slice(0, 4) !== filterYear) return false;
      if (filterMonth && m.movement_date.slice(5, 7) !== filterMonth) return false;
      if (filterFrom && m.movement_date < filterFrom) return false;
      if (filterTo && m.movement_date > filterTo) return false;
      if (
        q
        && !`${m.description ?? ""} ${m.reference ?? ""} ${m.category_label ?? ""}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [movements, filterCategory, filterYear, filterMonth, filterFrom, filterTo, filterQuery]);

  const filteredTotal = useMemo(
    () =>
      filteredMovements.reduce(
        (sum, m) => sum + Math.abs(Number(m.signed_amount)),
        0,
      ),
    [filteredMovements],
  );

  const nowYear = String(new Date().getFullYear());
  const nowMonth = String(new Date().getMonth() + 1).padStart(2, "0");
  const hasActiveFilters = Boolean(
    filterCategory
    || filterYear !== nowYear
    || filterMonth !== nowMonth
    || filterFrom
    || filterTo
    || filterQuery.trim(),
  );

  const sortedFilteredMovements = useMemo(
    () =>
      [...filteredMovements].sort((a, b) =>
        b.movement_date.localeCompare(a.movement_date),
      ),
    [filteredMovements],
  );

  const PAGE_SIZE = 10;
  const pageCount = Math.max(1, Math.ceil(sortedFilteredMovements.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedMovements = useMemo(
    () =>
      sortedFilteredMovements.slice(
        (currentPage - 1) * PAGE_SIZE,
        currentPage * PAGE_SIZE,
      ),
    [sortedFilteredMovements, currentPage],
  );

  useEffect(() => {
    setPage(1);
  }, [filterCategory, filterYear, filterMonth, filterFrom, filterTo, filterQuery]);

  function resetFilters() {
    const now = new Date();
    setFilterCategory("");
    setFilterYear(String(now.getFullYear()));
    setFilterMonth(String(now.getMonth() + 1).padStart(2, "0"));
    setFilterFrom("");
    setFilterTo("");
    setFilterQuery("");
    setPage(1);
  }

  const currency = movements[0]?.currency ?? "XOF";

  const typeQuery = movementTypes.join(",");

  const loadCategories = useCallback(async () => {
    const url = categoryScope
      ? `/enterprise/categories/?scope=${categoryScope}&include_inactive=1`
      : "/enterprise/categories/";
    return apiRequest<MovementCategory[]>(url);
  }, [categoryScope]);

  const loadMovements = useCallback(async () => {
    return apiRequest<EnterpriseMovement[]>(
      `/enterprise/movements/?movement_type=${typeQuery}&limit=200`,
    );
  }, [typeQuery]);

  const reload = useCallback(async () => {
    const [cats, movs] = await Promise.all([loadCategories(), loadMovements()]);
    setCategories(cats);
    setMovements(movs);
  }, [loadCategories, loadMovements]);

  useEffect(() => {
    setLoading(true);
    reload()
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    if (activeCategories.length > 0 && !categoryId) {
      setCategoryId(String(activeCategories[0].id));
    }
  }, [activeCategories, categoryId]);

  async function handleAddCategory(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !categoryScope || !newCategoryLabel.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiRequest<MovementCategory>("/enterprise/categories/", {
        method: "POST",
        body: JSON.stringify({ label: newCategoryLabel.trim(), scope: categoryScope }),
      });
      setNewCategoryLabel("");
      await reload();
      setCategoryId(String(created.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Création de catégorie impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!amount || (categoryScope && !categoryId)) return;
    setBusy(true);
    setError(null);
    try {
      const created = await apiRequest<EnterpriseMovement>("/enterprise/movements/", {
        method: "POST",
        body: JSON.stringify({
          movement_type: movementType,
          category: categoryId ? Number(categoryId) : null,
          amount,
          movement_date: movementDate,
          description: descriptionField.trim(),
          reference: reference.trim(),
        }),
      });
      if (justificatifFile) {
        const fd = new FormData();
        fd.append("file", justificatifFile);
        fd.append("title", justificatifFile.name);
        await apiRequest(`/enterprise/movements/${created.id}/justificatifs/`, {
          method: "POST",
          body: fd,
        });
      }
      await apiRequest(`/enterprise/movements/${created.id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status: "APPROVED" }),
      });
      setAmount("");
      setDescriptionField("");
      setReference("");
      setJustificatifFile(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(m: EnterpriseMovement) {
    try {
      const full = await apiRequest<EnterpriseMovement>(`/enterprise/movements/${m.id}/`);
      setSelected(full);
      setUploadFile(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Détail indisponible.");
    }
  }

  async function uploadJustificatif(e: FormEvent) {
    e.preventDefault();
    if (!selected || !uploadFile) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("title", uploadFile.name);
      await apiRequest(`/enterprise/movements/${selected.id}/justificatifs/`, {
        method: "POST",
        body: fd,
      });
      await openDetail(selected);
      setUploadFile(null);
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Téléversement impossible.");
    } finally {
      setBusy(false);
    }
  }

  const scopeLabel =
    categoryScope === "REVENUE" ? "recette" : categoryScope === "EXPENSE" ? "dépense" : "écriture";

  if (loading) return <LoadingState />;

  return (
    <div className="mt-6 space-y-6">
      <nav
        className="border-b-2 border-[var(--sf-green)]"
        aria-label={`Sections ${title.toLowerCase()}`}
      >
        <div className="flex flex-wrap justify-center gap-0 overflow-x-auto">
          {(
            [
              { key: "gerer", label: "Gérer" },
              { key: "historique", label: "Historique" },
            ] as const
          ).map((tab) => {
            const active = view === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setView(tab.key)}
                aria-current={active ? "page" : undefined}
                className={`relative shrink-0 border-b-2 -mb-[2px] px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? "rounded-t-lg border-[var(--sf-green)] bg-[var(--sf-green)] text-[var(--sf-gold)] font-semibold"
                    : "rounded-t-md border-transparent text-[var(--sf-green)]/55 hover:border-[var(--sf-green)]/25 hover:bg-[var(--sf-cream)]/25 hover:text-[var(--sf-green-deep)]"
                }`}
              >
                {tab.label}
                {tab.key === "historique" ? (
                  <span className="ml-1.5 text-xs opacity-70">({movements.length})</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>

      {error ? <ErrorAlert message={error} /> : null}

      {invoiceLinkedRevenue ? (
        <div className="rounded-xl border border-[var(--sf-gold)]/35 bg-[var(--sf-cream)]/60 px-4 py-3 text-sm text-[var(--sf-green-deep)]">
          <p className="font-medium">Chiffre d&apos;affaires = factures validées</p>
          <p className="mt-1 text-[var(--sf-green)]/65">
            Les recettes d&apos;honoraires sont générées automatiquement lors de la
            validation d&apos;une facture. Elles alimentent le CA comptable.
          </p>
          <Link
            href="/factures"
            className="mt-2 inline-flex text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Ouvrir Factures →
          </Link>
        </div>
      ) : null}

      {view === "gerer" ? (
      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        {categoryScope ? (
          <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white lg:col-span-4">
            <div className="border-b border-[var(--sf-cream-dark)] px-4 py-3">
              <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                Catégories de {scopeLabel}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">
                {invoiceLinkedRevenue
                  ? "Catégories liées aux services facturés (répartition du CA)."
                  : `Créez autant de catégories que nécessaire, puis enregistrez chaque ${scopeLabel} avec la catégorie correspondante.`}
              </p>
            </div>

            {canManage && !invoiceLinkedRevenue ? (
              <form
                onSubmit={(e) => void handleAddCategory(e)}
                className="border-b border-[var(--sf-cream-dark)] px-4 py-3"
              >
                <label className="block text-xs font-medium text-[var(--sf-green)]/70">
                  Nouvelle catégorie
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    value={newCategoryLabel}
                    onChange={(e) => setNewCategoryLabel(e.target.value)}
                    placeholder={
                      categoryScope === "REVENUE"
                        ? "Ex. Honoraires mandat"
                        : "Ex. Marketing"
                    }
                    className="sf-input min-w-0 flex-1 text-sm"
                    minLength={2}
                    disabled={busy}
                  />
                  <button
                    type="submit"
                    disabled={busy || newCategoryLabel.trim().length < 2}
                    className="sf-btn-secondary shrink-0 text-xs"
                  >
                    Ajouter
                  </button>
                </div>
              </form>
            ) : null}

            <ul className="max-h-[420px] divide-y divide-[var(--sf-cream-dark)] overflow-y-auto">
              {activeCategories.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-[var(--sf-green)]/50">
                  Aucune catégorie — ajoutez-en une ci-dessus.
                </li>
              ) : (
                activeCategories.map((cat) => {
                  const total = categoryTotals.get(cat.id) ?? 0;
                  const selectedCat = categoryId === String(cat.id);
                  return (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() => setCategoryId(String(cat.id))}
                        className={`flex w-full items-start justify-between gap-2 px-4 py-3 text-left transition ${
                          selectedCat
                            ? "bg-[var(--sf-green)]/8"
                            : "hover:bg-[var(--sf-cream)]/40"
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-medium text-[var(--sf-green-deep)]">
                            {cat.label}
                          </span>
                          {cat.service_type_label ? (
                            <span className="mt-0.5 block text-[10px] text-[var(--sf-green)]/45">
                              {cat.service_type_label}
                            </span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block font-mono text-xs font-semibold text-[var(--sf-green-mid)]">
                            {total > 0
                              ? formatMoney(String(total), movements[0]?.currency ?? "XOF")
                              : "—"}
                          </span>
                          {selectedCat ? (
                            <span className="text-[10px] text-[var(--sf-green)]/45">Sélectionnée</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        ) : null}

        {canManage && !invoiceLinkedRevenue ? (
          <section
            className={`rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 ${
              categoryScope ? "lg:col-span-8" : "lg:col-span-12"
            }`}
          >
            <h3 className="font-semibold text-[var(--sf-green-deep)]">
              Enregistrer une {scopeLabel}
            </h3>
            <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={(e) => void handleCreate(e)}>
              {movementTypes.length > 1 ? (
                <select
                  className="sf-input w-full sm:col-span-2"
                  value={movementType}
                  disabled={busy}
                  onChange={(e) => {
                    setMovementType(e.target.value);
                    setCategoryId("");
                  }}
                >
                  {movementTypes.map((t) => (
                    <option key={t} value={t}>
                      {MOVEMENT_TYPE_LABELS[t] ?? t}
                    </option>
                  ))}
                </select>
              ) : null}

              {categoryScope ? (
                <label className="block sm:col-span-2">
                  <span className="text-xs font-medium text-[var(--sf-green)]/70">Catégorie *</span>
                  <select
                    className="sf-input mt-1 w-full"
                    value={categoryId}
                    required
                    disabled={busy || activeCategories.length === 0}
                    onChange={(e) => setCategoryId(e.target.value)}
                  >
                    <option value="">— Choisir une catégorie —</option>
                    {activeCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block">
                <span className="text-xs font-medium text-[var(--sf-green)]/70">Montant (XOF) *</span>
                <input
                  className="sf-input mt-1 w-full"
                  type="number"
                  min="0"
                  step="1"
                  value={amount}
                  required
                  disabled={busy}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-[var(--sf-green)]/70">Date *</span>
                <input
                  className="sf-input mt-1 w-full"
                  type="date"
                  value={movementDate}
                  required
                  disabled={busy}
                  onChange={(e) => setMovementDate(e.target.value)}
                />
              </label>
              <input
                className="sf-input w-full sm:col-span-2"
                placeholder="Référence facture / pièce"
                value={reference}
                disabled={busy}
                onChange={(e) => setReference(e.target.value)}
              />
              <textarea
                className="sf-input min-h-[72px] w-full sm:col-span-2"
                placeholder="Libellé détaillé"
                value={descriptionField}
                disabled={busy}
                onChange={(e) => setDescriptionField(e.target.value)}
              />
              <label className="block sm:col-span-2">
                <span className="text-xs font-medium text-[var(--sf-green)]/70">Justificatif</span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="mt-1 w-full text-sm"
                  disabled={busy}
                  onChange={(e) => setJustificatifFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  className="sf-btn-primary text-sm"
                  disabled={busy || (categoryScope && (!categoryId || activeCategories.length === 0))}
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </section>
        ) : invoiceLinkedRevenue ? (
          <section
            className={`rounded-xl border border-[var(--sf-cream-dark)] bg-white p-6 ${
              categoryScope ? "lg:col-span-8" : "lg:col-span-12"
            }`}
          >
            <h3 className="font-semibold text-[var(--sf-green-deep)]">
              Saisie des recettes
            </h3>
            <p className="mt-2 text-sm text-[var(--sf-green)]/65">
              Les recettes du chiffre d&apos;affaires se créent uniquement via la
              validation d&apos;une facture (automatique ou manuelle). Consultez
              l&apos;historique pour voir les mouvements générés.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/factures" className="sf-btn-primary px-4 py-2 text-sm">
                Composer / valider une facture
              </Link>
              <button
                type="button"
                className="sf-btn-secondary px-4 py-2 text-sm"
                onClick={() => setView("historique")}
              >
                Voir l&apos;historique
              </button>
            </div>
          </section>
        ) : null}
      </div>
      ) : null}

      {view === "historique" ? (
      <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white">
        <div className="border-b border-[var(--sf-cream-dark)] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
              Historique des écritures
              <span className="ml-1.5 font-normal text-[var(--sf-green)]/50">
                {filteredMovements.length}
                {hasActiveFilters ? ` / ${movements.length}` : ""}
              </span>
            </h3>
            {hasActiveFilters ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
                onClick={resetFilters}
              >
                Réinitialiser les filtres
              </button>
            ) : null}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            <label className="block sm:col-span-2 lg:col-span-2 xl:col-span-2">
              <span className="text-[11px] font-medium text-[var(--sf-green)]/60">
                Recherche
              </span>
              <input
                type="search"
                className="sf-input mt-1 w-full text-sm"
                placeholder="Libellé, référence, catégorie…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--sf-green)]/60">
                Catégorie
              </span>
              <select
                className="sf-input mt-1 w-full text-sm"
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
              >
                <option value="">Toutes</option>
                {activeCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
                <option value="none">Sans catégorie</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--sf-green)]/60">
                Année
              </span>
              <select
                className="sf-input mt-1 w-full text-sm"
                value={filterYear}
                onChange={(e) => setFilterYear(e.target.value)}
              >
                <option value="">Toutes</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--sf-green)]/60">
                Mois
              </span>
              <select
                className="sf-input mt-1 w-full text-sm"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
              >
                <option value="">Tous</option>
                {MONTH_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--sf-green)]/60">Du</span>
              <input
                type="date"
                className="sf-input mt-1 w-full text-sm"
                value={filterFrom}
                onChange={(e) => setFilterFrom(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--sf-green)]/60">Au</span>
              <input
                type="date"
                className="sf-input mt-1 w-full text-sm"
                value={filterTo}
                onChange={(e) => setFilterTo(e.target.value)}
              />
            </label>
          </div>
        </div>
        {movements.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--sf-green)]/55">
            Aucune écriture enregistrée — utilisez l&apos;onglet Gérer pour en ajouter.
          </p>
        ) : filteredMovements.length === 0 ? (
          <p className="p-6 text-center text-sm text-[var(--sf-green)]/55">
            Aucune écriture ne correspond aux filtres.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--sf-cream-dark)] text-[11px] uppercase tracking-wide text-[var(--sf-green)]/45">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Catégorie</th>
                  <th className="px-4 py-2.5 font-medium">Libellé</th>
                  <th className="px-4 py-2.5 font-medium">Justificatif</th>
                  <th className="px-4 py-2.5 text-right font-medium">Montant</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--sf-cream-dark)]">
                {pagedMovements.map((m) => (
                  <tr
                    key={m.id}
                    className="cursor-pointer transition hover:bg-[var(--sf-cream)]/30"
                    onClick={() => void openDetail(m)}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[var(--sf-green)]/60">
                      {formatDate(m.movement_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-[var(--sf-green)]/8 px-2.5 py-0.5 text-xs font-medium text-[var(--sf-green-deep)]">
                        {m.category_label || "Sans catégorie"}
                      </span>
                    </td>
                    <td className="max-w-[18rem] px-4 py-3">
                      <p className="truncate font-medium text-[var(--sf-green-deep)]">
                        {m.description || "—"}
                      </p>
                      {m.reference ? (
                        <p className="truncate text-[11px] text-[var(--sf-green)]/45">
                          Réf. {m.reference}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {m.justificatif_count > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                          {m.justificatif_count} pièce{m.justificatif_count > 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          Manquant
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-[var(--sf-green-mid)]">
                      {formatMoney(m.signed_amount, m.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        className="text-xs font-semibold text-[var(--sf-green-mid)] hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openDetail(m);
                        }}
                      >
                        Détail
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25">
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-[var(--sf-green-deep)]">
                    Total {hasActiveFilters ? "filtré" : ""} ({filteredMovements.length} écriture
                    {filteredMovements.length > 1 ? "s" : ""})
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-sm font-semibold tabular-nums text-[var(--sf-green-deep)]">
                    {formatMoney(String(filteredTotal), currency)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
            {pageCount > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--sf-cream-dark)] px-4 py-3">
                <p className="text-xs text-[var(--sf-green)]/55">
                  Page {currentPage} sur {pageCount} ·{" "}
                  {(currentPage - 1) * PAGE_SIZE + 1}–
                  {Math.min(currentPage * PAGE_SIZE, sortedFilteredMovements.length)} sur{" "}
                  {sortedFilteredMovements.length} écritures
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                    className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-1.5 text-xs font-medium text-[var(--sf-green)] transition hover:bg-[var(--sf-cream)]/40 disabled:cursor-default disabled:opacity-40"
                  >
                    ← Précédent
                  </button>
                  {Array.from({ length: pageCount }, (_, i) => i + 1)
                    .filter(
                      (p) =>
                        p === 1
                        || p === pageCount
                        || Math.abs(p - currentPage) <= 1,
                    )
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== p - 1 ? (
                          <span className="px-1 text-xs text-[var(--sf-green)]/40">…</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setPage(p)}
                          aria-current={p === currentPage ? "page" : undefined}
                          className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-xs font-medium transition ${
                            p === currentPage
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
                    disabled={currentPage >= pageCount}
                    onClick={() => setPage(currentPage + 1)}
                    className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-1.5 text-xs font-medium text-[var(--sf-green)] transition hover:bg-[var(--sf-cream)]/40 disabled:cursor-default disabled:opacity-40"
                  >
                    Suivant →
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>
      ) : null}

      {selected ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-[var(--sf-cream-dark)] px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-[var(--sf-green-deep)]">Détail</h3>
                <p className="text-sm text-[var(--sf-green)]/60">
                  {selected.category_label} · {formatDate(selected.movement_date)}
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-[var(--sf-green-mid)] hover:underline"
                onClick={() => setSelected(null)}
              >
                Fermer
              </button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              <p className="text-2xl font-semibold tabular-nums text-[var(--sf-green-deep)]">
                {formatMoney(selected.signed_amount, selected.currency)}
              </p>
              {selected.description ? <p>{selected.description}</p> : null}
              {selected.reference ? (
                <p className="text-xs text-[var(--sf-green)]/50">Réf. {selected.reference}</p>
              ) : null}
              <div>
                <h4 className="font-semibold text-[var(--sf-green-deep)]">Justificatifs</h4>
                {selected.justificatifs && selected.justificatifs.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {selected.justificatifs.map((j) => (
                      <li
                        key={j.id}
                        className="flex items-center justify-between rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2"
                      >
                        <span>{j.title || j.original_filename}</span>
                        {j.download_url ? (
                          <a
                            href={j.download_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-semibold text-[var(--sf-green-mid)] hover:underline"
                          >
                            Télécharger
                          </a>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-xs text-amber-700">Aucun justificatif joint.</p>
                )}
                {canManage ? (
                  <form className="mt-3 space-y-2" onSubmit={(e) => void uploadJustificatif(e)}>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="w-full text-sm"
                      disabled={busy}
                      onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    />
                    <button
                      type="submit"
                      className="sf-btn-secondary text-xs"
                      disabled={busy || !uploadFile}
                    >
                      Ajouter un justificatif
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
