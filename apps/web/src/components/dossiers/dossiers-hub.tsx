"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { PageHeader } from "@/components/ui/page-header";
import { ApiError, apiRequest } from "@/lib/api";
import {
  CASE_STATUS_LABELS,
  CASE_TYPE_LABELS,
  formatRelativeDate,
} from "@/lib/labels";
import { caseIsLocked, userCanCreateCase, userCanWriteCase } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import type { FiduciaryCaseListItem } from "@/types/api";

const ACTIVE_STATUSES = new Set([
  "ACTIVE",
  "UNDER_REVIEW",
  "LEGAL_REVIEW",
  "COMPLIANCE_REVIEW",
  "CLOSING",
]);

const REVIEW_STATUSES = new Set([
  "UNDER_REVIEW",
  "LEGAL_REVIEW",
  "COMPLIANCE_REVIEW",
]);

type SortKey = "updated" | "created" | "title" | "reference";
type ViewMode = "cards" | "table";

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
      />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accentClass,
  onClick,
  active,
}: {
  label: string;
  value: number;
  hint: string;
  accentClass: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition sm:p-5 ${
        active
          ? "border-[var(--sf-green-mid)]/40 ring-2 ring-[var(--sf-green-mid)]/15"
          : "border-[var(--sf-cream-dark)] hover:shadow-md"
      } ${onClick ? "cursor-pointer" : ""}`}
    >
      <p
        className={`text-2xl font-semibold tabular-nums tracking-tight text-[var(--sf-green-deep)] sm:text-3xl ${accentClass}`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--sf-green-deep)]">{label}</p>
      <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">{hint}</p>
    </Tag>
  );
}

function CaseTypePill({ caseType }: { caseType?: string }) {
  if (!caseType) {
    return (
      <span className="inline-flex rounded-full bg-[var(--sf-cream)] px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
        Type non défini
      </span>
    );
  }
  return (
    <span className="inline-flex max-w-full truncate rounded-full bg-[var(--sf-green)]/8 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--sf-green-mid)]">
      {CASE_TYPE_LABELS[caseType] ?? caseType}
    </span>
  );
}

function CaseCounts({ item }: { item: FiduciaryCaseListItem }) {
  const parts: string[] = [];
  const donors = item.donors_count ?? 0;
  const beneficiaries = item.beneficiaries_count ?? 0;
  const mandates = item.mandates_count ?? 0;
  if (donors > 0) parts.push(`${donors} donateur${donors > 1 ? "s" : ""}`);
  if (beneficiaries > 0) {
    parts.push(`${beneficiaries} bénéficiaire${beneficiaries > 1 ? "s" : ""}`);
  }
  if (mandates > 0) parts.push(`${mandates} mandat${mandates > 1 ? "s" : ""}`);
  if (parts.length === 0) return null;
  return (
    <p className="text-xs text-[var(--sf-green)]/50">{parts.join(" · ")}</p>
  );
}

function DraftProgress({ item, canWrite }: { item: FiduciaryCaseListItem; canWrite: boolean }) {
  if (item.status !== "DRAFT") return null;
  const stepLabel =
    item.onboarding_step_label ??
    (item.onboarding_step ? `Étape : ${item.onboarding_step}` : "Enregistrement à démarrer");
  const resumeStep = item.onboarding_step || "identification";
  return (
    <div className="mt-3 rounded-lg border border-amber-200/70 bg-amber-50/60 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800/70">
        Enregistrement en cours
      </p>
      <p className="mt-0.5 text-sm font-medium text-amber-950">{stepLabel}</p>
      {canWrite ? (
        <Link
          href={`/dossiers/${item.id}/enregistrement?step=${encodeURIComponent(resumeStep)}`}
          className="mt-2 inline-flex text-xs font-semibold text-[var(--sf-green-mid)] hover:text-[var(--sf-green)]"
          onClick={(e) => e.stopPropagation()}
        >
          Poursuivre l&apos;enregistrement →
        </Link>
      ) : null}
    </div>
  );
}

function CaseCard({ item, canWrite }: { item: FiduciaryCaseListItem; canWrite: boolean }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm transition hover:border-[var(--sf-green)]/15 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/dossiers/${item.id}`}
          className="font-mono text-sm font-semibold text-[var(--sf-green-mid)] hover:text-[var(--sf-green)]"
        >
          {item.reference}
        </Link>
        <StatusBadge status={item.status} />
      </div>

      <Link href={`/dossiers/${item.id}`} className="mt-3 block min-h-[2.75rem] flex-1">
        <h3 className="line-clamp-2 text-base font-semibold leading-snug text-[var(--sf-green-deep)] hover:text-[var(--sf-green)]">
          {item.title}
        </h3>
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CaseTypePill caseType={item.case_type} />
      </div>

      <div className="mt-3 space-y-1 border-t border-[var(--sf-cream-dark)]/80 pt-3">
        {item.primary_donor_name ? (
          <p className="text-sm text-[var(--sf-green-deep)]">
            <span className="text-[var(--sf-green)]/50">Donateur · </span>
            {item.primary_donor_name}
          </p>
        ) : item.status === "DRAFT" ? (
          <p className="text-sm text-[var(--sf-green)]/45">Donateur non renseigné</p>
        ) : null}
        <CaseCounts item={item} />
      </div>

      <DraftProgress item={item} canWrite={canWrite} />

      <footer className="mt-4 flex flex-wrap items-end justify-between gap-2 border-t border-[var(--sf-cream-dark)]/60 pt-3">
        <div className="text-xs text-[var(--sf-green)]/50">
          <p title={item.updated_at}>
            Modifié {formatRelativeDate(item.updated_at)}
          </p>
          <p className="mt-0.5">Par {item.created_by_username}</p>
        </div>
        <Link
          href={`/dossiers/${item.id}`}
          className="shrink-0 rounded-lg border border-[var(--sf-green)]/15 px-3 py-1.5 text-xs font-medium text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]"
        >
          Ouvrir
        </Link>
      </footer>
    </article>
  );
}

export function DossiersHub() {
  const { user } = useAuth();
  const canCreateCase = userCanCreateCase(user);
  const canWriteCase = userCanWriteCase(user);
  const [cases, setCases] = useState<FiduciaryCaseListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("updated");
  const [view, setView] = useState<ViewMode>("cards");

  useEffect(() => {
    apiRequest<FiduciaryCaseListItem[]>("/cases/")
      .then(setCases)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger les dossiers.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const draft = cases.filter((c) => c.status === "DRAFT").length;
    const active = cases.filter((c) => ACTIVE_STATUSES.has(c.status)).length;
    const inReview = cases.filter((c) => REVIEW_STATUSES.has(c.status)).length;
    const closed = cases.filter((c) => c.status === "CLOSED").length;
    return { total: cases.length, draft, active, inReview, closed };
  }, [cases]);

  const statusOptions = useMemo(() => {
    const set = new Set(cases.map((c) => c.status));
    return Array.from(set).sort();
  }, [cases]);

  const typeOptions = useMemo(() => {
    const set = new Set(
      cases.map((c) => c.case_type).filter((t): t is string => Boolean(t)),
    );
    return Array.from(set).sort();
  }, [cases]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = cases.filter((c) => {
      if (statusFilter === "__active__") {
        if (!ACTIVE_STATUSES.has(c.status)) return false;
      } else if (statusFilter === "__in_review__") {
        if (!REVIEW_STATUSES.has(c.status)) return false;
      } else if (statusFilter !== "all" && c.status !== statusFilter) {
        return false;
      }
      if (typeFilter !== "all" && c.case_type !== typeFilter) return false;
      if (!q) return true;
      return (
        c.reference.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.created_by_username.toLowerCase().includes(q) ||
        (c.primary_donor_name?.toLowerCase().includes(q) ?? false) ||
        (c.assigned_to_username?.toLowerCase().includes(q) ?? false)
      );
    });

    return [...list].sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title, "fr");
      if (sort === "reference") return a.reference.localeCompare(b.reference, "fr");
      if (sort === "created") return b.created_at.localeCompare(a.created_at);
      return b.updated_at.localeCompare(a.updated_at);
    });
  }, [cases, search, statusFilter, typeFilter, sort]);

  const draftsNeedingWork = useMemo(
    () => cases.filter((c) => c.status === "DRAFT" && c.onboarding_step).length,
    [cases],
  );

  if (loading) return <LoadingState label="Chargement des dossiers…" />;

  return (
    <>
      <PageHeader
        badge="Gestion fiduciaire"
        title="Dossiers fiduciaires"
        description="Vue d'ensemble de votre portefeuille : statuts, enregistrements en cours et accès rapide à chaque dossier."
        action={
          canCreateCase ? (
            <ButtonLink href="/dossiers/new" variant="gold">
              + Nouveau dossier
            </ButtonLink>
          ) : undefined
        }
      />

      {error ? <ErrorAlert message={error} /> : null}

      {cases.length > 0 ? (
        <>
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <KpiCard
              label="Total"
              value={stats.total}
              hint="Dossiers dans votre périmètre"
              accentClass=""
              onClick={() => setStatusFilter("all")}
              active={statusFilter === "all"}
            />
            <KpiCard
              label="Brouillons"
              value={stats.draft}
              hint={
                draftsNeedingWork > 0
                  ? `${draftsNeedingWork} enregistrement${draftsNeedingWork > 1 ? "s" : ""} en cours`
                  : "À finaliser ou soumettre"
              }
              accentClass=""
              onClick={() => setStatusFilter("DRAFT")}
              active={statusFilter === "DRAFT"}
            />
            <KpiCard
              label="Actifs"
              value={stats.active}
              hint="Gestion en cours"
              accentClass="text-emerald-700"
              onClick={() => setStatusFilter("__active__")}
              active={statusFilter === "__active__"}
            />
            <KpiCard
              label="En revue"
              value={stats.inReview}
              hint="Juridique ou conformité"
              accentClass="text-amber-700"
              onClick={() => setStatusFilter("__in_review__")}
              active={statusFilter === "__in_review__"}
            />
            <KpiCard
              label="Clôturés"
              value={stats.closed}
              hint="Dossiers archivés"
              accentClass="text-slate-500"
              onClick={() => setStatusFilter("CLOSED")}
              active={statusFilter === "CLOSED"}
            />
          </div>

          <Card className="mb-6 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
              <div className="flex-1">
                <label htmlFor="dossiers-search" className="mb-1.5 block text-xs font-medium text-[var(--sf-green)]/60">
                  Rechercher
                </label>
                <input
                  id="dossiers-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Référence, titre, donateur, auteur…"
                  className="sf-input"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3 lg:w-[28rem]">
                <div>
                  <label htmlFor="dossiers-status" className="mb-1.5 block text-xs font-medium text-[var(--sf-green)]/60">
                    Statut
                  </label>
                  <select
                    id="dossiers-status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="sf-input"
                  >
                    <option value="all">Tous</option>
                    {statusOptions.map((s) => (
                      <option key={s} value={s}>
                        {CASE_STATUS_LABELS[s] ?? s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="dossiers-type" className="mb-1.5 block text-xs font-medium text-[var(--sf-green)]/60">
                    Type
                  </label>
                  <select
                    id="dossiers-type"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="sf-input"
                  >
                    <option value="all">Tous les types</option>
                    {typeOptions.map((t) => (
                      <option key={t} value={t}>
                        {CASE_TYPE_LABELS[t] ?? t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="dossiers-sort" className="mb-1.5 block text-xs font-medium text-[var(--sf-green)]/60">
                    Tri
                  </label>
                  <select
                    id="dossiers-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="sf-input"
                  >
                    <option value="updated">Dernière modification</option>
                    <option value="created">Plus récents</option>
                    <option value="title">Titre (A → Z)</option>
                    <option value="reference">Référence</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--sf-cream-dark)] pt-4">
              <p className="text-sm text-[var(--sf-green)]/55">
                <span className="font-medium text-[var(--sf-green-deep)]">{filtered.length}</span>
                {" "}
                dossier{filtered.length !== 1 ? "s" : ""} affiché
                {filtered.length !== 1 ? "s" : ""}
                {statusFilter !== "all" ? (
                  <span>
                    {" "}
                    · filtre :{" "}
                    {statusFilter === "__active__"
                      ? "Actifs"
                      : statusFilter === "__in_review__"
                        ? "En revue"
                        : CASE_STATUS_LABELS[statusFilter] ?? statusFilter}
                  </span>
                ) : null}
              </p>
              <div className="flex rounded-lg border border-[var(--sf-cream-dark)] p-0.5">
                <button
                  type="button"
                  onClick={() => setView("cards")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    view === "cards"
                      ? "bg-[var(--sf-green-deep)] text-white"
                      : "text-[var(--sf-green)]/60 hover:text-[var(--sf-green-deep)]"
                  }`}
                >
                  Cartes
                </button>
                <button
                  type="button"
                  onClick={() => setView("table")}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                    view === "table"
                      ? "bg-[var(--sf-green-deep)] text-white"
                      : "text-[var(--sf-green)]/60 hover:text-[var(--sf-green-deep)]"
                  }`}
                >
                  Tableau
                </button>
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {!error && cases.length === 0 ? (
        <EmptyState
          title="Aucun dossier"
          description="Créez votre premier dossier fiduciaire pour commencer la gestion patrimoniale."
          action={
            canCreateCase ? (
              <ButtonLink href="/dossiers/new" variant="primary">
                Créer un dossier
              </ButtonLink>
            ) : undefined
          }
        />
      ) : null}

      {filtered.length > 0 && view === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <CaseCard
              key={c.id}
              item={c}
              canWrite={canWriteCase && !caseIsLocked(c.status)}
            />
          ))}
        </div>
      ) : null}

      {filtered.length > 0 && view === "table" ? (
        <div className="sf-table-wrap overflow-x-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
          <table className="sf-table w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Titre</th>
                <th>Type</th>
                <th>Donateur</th>
                <th>Statut</th>
                <th>Enregistrement</th>
                <th>Modifié</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="group">
                  <td>
                    <Link
                      href={`/dossiers/${c.id}`}
                      className="font-mono text-sm font-medium text-[var(--sf-green-mid)] group-hover:text-[var(--sf-green)]"
                    >
                      {c.reference}
                    </Link>
                  </td>
                  <td className="max-w-[200px]">
                    <p className="truncate font-medium text-[var(--sf-green-deep)]">{c.title}</p>
                    <p className="truncate text-xs text-[var(--sf-green)]/45">
                      {c.created_by_username}
                    </p>
                  </td>
                  <td className="text-xs text-[var(--sf-green)]/55">
                    {c.case_type ? CASE_TYPE_LABELS[c.case_type] ?? c.case_type : "—"}
                  </td>
                  <td className="text-sm text-[var(--sf-green-deep)]">
                    {c.primary_donor_name ?? "—"}
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="text-xs text-[var(--sf-green)]/55">
                    {c.status === "DRAFT" && canWriteCase && !caseIsLocked(c.status) ? (
                      <Link
                        href={`/dossiers/${c.id}/enregistrement?step=${encodeURIComponent(c.onboarding_step || "identification")}`}
                        className="font-medium text-[var(--sf-green-mid)] hover:text-[var(--sf-green)]"
                      >
                        {c.onboarding_step_label ?? "Poursuivre →"}
                      </Link>
                    ) : c.status === "DRAFT" ? (
                      c.onboarding_step_label ?? "En cours"
                    ) : c.onboarding_completed_at ? (
                      "Terminé"
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-[var(--sf-green)]/55" title={c.updated_at}>
                    {formatRelativeDate(c.updated_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {cases.length > 0 && filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-10 text-center">
          <FolderIcon className="h-10 w-10 text-[var(--sf-green)]/25" />
          <p className="text-sm text-[var(--sf-green)]/60">
            Aucun dossier ne correspond à vos critères.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setTypeFilter("all");
            }}
            className="sf-btn-secondary text-sm"
          >
            Réinitialiser les filtres
          </button>
        </Card>
      ) : null}
    </>
  );
}
