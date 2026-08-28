"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { MonthlyTrendChart } from "@/components/comptable/enterprise-finance-charts";
import {
  buildGeneralSeriesFromCategories,
  PatrimonyEvolutionChart,
} from "@/components/investments/investment-charts";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { resolveHomePath } from "@/lib/auth-routing";
import {
  resolvePrimaryInternalRole,
  userCanAccessEnterpriseFinance,
  userCanAccessInvestments,
  userCanAccessLane,
  userCanCreateCase,
  userCanManageUsers,
  type PrimaryInternalRole,
} from "@/lib/role-access";
import { ApiError, apiRequest } from "@/lib/api";
import {
  CASE_STATUS_LABELS,
  formatDate,
  formatMoney,
  ROLE_LABELS,
} from "@/lib/labels";
import { VALIDATION_TYPE_LABELS } from "@/lib/validation-labels";
import { useAuth } from "@/providers/auth-provider";
import type {
  EnterpriseFinancialSummary,
  FiduciaryCaseListItem,
  InvestmentsGlobalDashboard,
  NotificationItem,
  ValidationRequest,
} from "@/types/api";

const ACTIVE_STATUSES = new Set([
  "ACTIVE",
  "UNDER_REVIEW",
  "LEGAL_REVIEW",
  "COMPLIANCE_REVIEW",
  "CLOSING",
]);

const MONTH_OPTIONS = [
  { value: "1", label: "Janvier" },
  { value: "2", label: "Février" },
  { value: "3", label: "Mars" },
  { value: "4", label: "Avril" },
  { value: "5", label: "Mai" },
  { value: "6", label: "Juin" },
  { value: "7", label: "Juillet" },
  { value: "8", label: "Août" },
  { value: "9", label: "Septembre" },
  { value: "10", label: "Octobre" },
  { value: "11", label: "Novembre" },
  { value: "12", label: "Décembre" },
];

function formatTodayLong(): string {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  return "Bonsoir";
}

function FolderIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
    </svg>
  );
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008z" />
    </svg>
  );
}

function TrendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8M15 7h6v6" />
    </svg>
  );
}

function CalculatorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="5" y="3" width="14" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h8M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01" />
    </svg>
  );
}

type QuickLinkItem = { href: string; label: string };

function quickLinksForUser(
  user: ReturnType<typeof useAuth>["user"],
  primary: PrimaryInternalRole | null,
): QuickLinkItem[] {
  const links: QuickLinkItem[] = [];
  if (userCanCreateCase(user)) {
    links.push({ href: "/dossiers/new", label: "Créer un dossier" });
  }
  links.push({ href: "/dossiers", label: "Parcourir les dossiers" });
  if (userCanAccessInvestments(user)) {
    links.push({
      href: "/investissements",
      label: "Finance & investissements",
    });
  }
  if (primary === "DIRECTION" || primary === "SUPER_ADMIN") {
    links.push(
      { href: "/validations", label: "Validations" },
      { href: "/factures", label: "Factures" },
    );
  }
  if (primary === "COMITE_CHARAIQUE") {
    links.push(
      { href: "/charia", label: "Tableau de bord charaïque" },
      { href: "/charia/circuits", label: "Circuits dossiers" },
      { href: "/charia/demandes", label: "Demandes CHARIA" },
      { href: "/charia/observations", label: "Observations" },
      { href: "/charia/partages", label: "Partages farāʾiḍ" },
    );
  } else if (primary === "SUPER_ADMIN" && userCanAccessLane(user, "charia")) {
    links.push({ href: "/charia", label: "Pôle charaïque" });
  }
  if (primary === "JURIDIQUE_CONFORMITE") {
    links.push(
      { href: "/juridique", label: "Tableau de bord juridique" },
      { href: "/juridique/circuits", label: "Circuits dossiers" },
      { href: "/juridique/demandes", label: "Demandes LEGAL" },
      { href: "/juridique/dossiers", label: "Dossiers en revue" },
    );
  } else if (primary === "SUPER_ADMIN" && userCanAccessLane(user, "juridique")) {
    links.push({ href: "/juridique", label: "Pôle juridique" });
  }
  if (primary === "COMPTABLE_FIDUCIAIRE") {
    links.push(
      { href: "/comptable/recettes", label: "Recettes" },
      { href: "/comptable/depenses", label: "Dépenses" },
      { href: "/comptable/mouvements", label: "Journal comptable" },
      { href: "/comptable/fiduciaire", label: "Fonds fiduciaires" },
    );
  } else if (primary === "SUPER_ADMIN" && userCanAccessLane(user, "comptable")) {
    links.push({ href: "/comptable", label: "Pôle comptabilité" });
  }
  if (primary === "AUDITEUR") {
    links.push({ href: "/audit/logs", label: "Journal d'audit" });
  } else if (primary === "SUPER_ADMIN" && userCanAccessLane(user, "audit")) {
    links.push({ href: "/audit", label: "Pôle audit" });
  }
  if (userCanManageUsers(user)) {
    links.push({ href: "/admin/utilisateurs", label: "Gestion des utilisateurs" });
  }
  return links;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [cases, setCases] = useState<FiduciaryCaseListItem[]>([]);
  const [queue, setQueue] = useState<ValidationRequest[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [investDashboard, setInvestDashboard] =
    useState<InvestmentsGlobalDashboard | null>(null);
  const [enterpriseSummary, setEnterpriseSummary] =
    useState<EnterpriseFinancialSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const [chartYear, setChartYear] = useState(currentYear);
  const [chartMonth, setChartMonth] = useState(""); // "" = tous les mois
  const [chartSummary, setChartSummary] =
    useState<EnterpriseFinancialSummary | null>(null);

  const primaryRole = useMemo(() => resolvePrimaryInternalRole(user), [user]);
  const canSeeInvestments = userCanAccessInvestments(user);
  const canSeeComptabilite = userCanAccessEnterpriseFinance(user);

  // Les rôles externes (juge, avocat/notaire, famille/client) ont leur portail dédié.
  // Comité charaïque et juridique travaillent dans leurs pôles, pas sur le dashboard général.
  useEffect(() => {
    if (!user) return;
    if (
      !primaryRole
      || primaryRole === "COMITE_CHARAIQUE"
      || primaryRole === "JURIDIQUE_CONFORMITE"
    ) {
      router.replace(resolveHomePath(user));
    }
  }, [user, primaryRole, router]);

  useEffect(() => {
    if (
      !user
      || !primaryRole
      || primaryRole === "COMITE_CHARAIQUE"
      || primaryRole === "JURIDIQUE_CONFORMITE"
    ) {
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [caseList, validations, notifs, invest, enterprise] = await Promise.all([
          apiRequest<FiduciaryCaseListItem[]>("/cases/"),
          apiRequest<ValidationRequest[]>("/validations/my-queue/").catch(
            () => [] as ValidationRequest[],
          ),
          apiRequest<NotificationItem[]>("/notifications/?unread=1&limit=5").catch(
            () => [] as NotificationItem[],
          ),
          canSeeInvestments
            ? apiRequest<InvestmentsGlobalDashboard>("/investments/dashboard/").catch(
                () => null,
              )
            : Promise.resolve(null),
          canSeeComptabilite
            ? apiRequest<EnterpriseFinancialSummary>("/enterprise/summary/").catch(
                () => null,
              )
            : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setCases(caseList);
        setQueue(validations);
        setNotifications(notifs);
        setInvestDashboard(invest);
        setEnterpriseSummary(enterprise);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger le tableau de bord.",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user, primaryRole, canSeeInvestments, canSeeComptabilite]);

  // Données comptables pour l'année sélectionnée dans le filtre des courbes.
  useEffect(() => {
    if (!canSeeComptabilite) return;
    if (chartYear === currentYear) {
      setChartSummary(null);
      return;
    }
    let cancelled = false;
    apiRequest<EnterpriseFinancialSummary>(`/enterprise/summary/?year=${chartYear}`)
      .then((s) => {
        if (!cancelled) setChartSummary(s);
      })
      .catch(() => {
        if (!cancelled) setChartSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [canSeeComptabilite, chartYear, currentYear]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const draft = cases.filter((c) => c.status === "DRAFT").length;
    const active = cases.filter((c) => ACTIVE_STATUSES.has(c.status)).length;
    const closed = cases.filter((c) => c.status === "CLOSED").length;
    const inReview = cases.filter((c) =>
      ["UNDER_REVIEW", "LEGAL_REVIEW", "COMPLIANCE_REVIEW"].includes(c.status),
    ).length;
    const newThisMonth = cases.filter((c) =>
      (c.created_at ?? "").startsWith(monthPrefix),
    ).length;
    return {
      total: cases.length,
      draft,
      active,
      closed,
      inReview,
      newThisMonth,
      validations: queue.length,
    };
  }, [cases, queue]);

  const validationTypeBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of queue) {
      counts[v.validation_type] = (counts[v.validation_type] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(
        ([type, count]) =>
          `${count} ${VALIDATION_TYPE_LABELS[type] ?? type}`,
      )
      .join(" · ");
  }, [queue]);

  const statusBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cases) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [cases]);

  const recentCases = useMemo(
    () => [...cases].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 6),
    [cases],
  );

  const quickLinks = useMemo(
    () => quickLinksForUser(user, primaryRole),
    [user, primaryRole],
  );

  const monthlyTrendData = useMemo(() => {
    const source = chartYear === currentYear ? enterpriseSummary : chartSummary;
    let rows = source?.performance.monthly_trends ?? [];
    if (chartMonth) {
      rows = rows.filter((row) => row.month === Number(chartMonth));
    }
    return rows.map((row) => ({
      label: row.label,
      revenue: Number(row.revenue) || 0,
      expense: Number(row.expense) || 0,
    }));
  }, [enterpriseSummary, chartSummary, chartYear, chartMonth, currentYear]);

  const filteredPatrimonySeries = useMemo(() => {
    const series = investDashboard?.patrimony_evolution_by_asset_class ?? [];
    const yearPrefix = String(chartYear);
    const monthPrefix = chartMonth
      ? `${yearPrefix}-${String(chartMonth).padStart(2, "0")}`
      : yearPrefix;

    // Filtrer uniquement les catégories ; l'ensemble est recalculé comme leur somme
    const categories = series
      .filter((s) => s.slug !== "general")
      .map((s) => ({
        ...s,
        points: s.points.filter((p) => p.date.startsWith(monthPrefix)),
      }))
      .filter((s) => s.points.length > 0);

    const general = buildGeneralSeriesFromCategories(categories);
    return general ? [...categories, general] : categories;
  }, [investDashboard, chartYear, chartMonth]);

  const chartYearOptions = useMemo(
    () => [currentYear, currentYear - 1, currentYear - 2],
    [currentYear],
  );

  if (!user || !primaryRole) {
    return <LoadingState label="Redirection vers votre espace…" />;
  }

  const displayName =
    user?.profile?.display_name ||
    [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
    user?.username;
  const roleLabel = user?.roles[0] ? ROLE_LABELS[user.roles[0]] ?? user.roles[0] : null;
  const canCreateCase = userCanCreateCase(user);
  const investStats = investDashboard?.stats ?? null;
  const investCurrency = investStats?.currency ?? "XOF";
  const hasEnvelope = Number(investStats?.total_planned_envelope ?? 0) > 0;
  const envelopeTotal = Number(investStats?.total_planned_envelope ?? 0) || 0;
  const investedTotal = Number(investStats?.total_invested ?? 0) || 0;
  const currentValueTotal = Number(investStats?.total_current_value ?? 0) || 0;
  const remainingTotal = hasEnvelope
    ? Number(
        investStats?.remaining_planned_envelope ??
          investStats?.uninvested_amount ??
          0,
      ) || 0
    : Number(investStats?.uninvested_amount ?? 0) || 0;
  const investorCount =
    investDashboard?.cases.filter(
      (c) =>
        (Number(c.planned_investment_amount) || 0) > 0 ||
        c.investment_count > 0,
    ).length ?? 0;
  const investedPercent =
    envelopeTotal > 0 ? (investedTotal / envelopeTotal) * 100 : null;
  const remainingPercent =
    envelopeTotal > 0 ? (remainingTotal / envelopeTotal) * 100 : null;
  const performancePercent =
    investedTotal > 0
      ? ((currentValueTotal - investedTotal) / investedTotal) * 100
      : null;

  const enterprisePerf = enterpriseSummary?.performance ?? null;
  const enterpriseCurrency = enterpriseSummary?.currency ?? "XOF";
  const enterpriseRevenue = Number(enterprisePerf?.chiffre_affaires ?? 0) || 0;
  const enterpriseExpenses = Number(enterprisePerf?.total_depenses ?? 0) || 0;
  const enterpriseNet = Number(enterprisePerf?.resultat_net ?? 0) || 0;
  const expensePercent =
    enterpriseRevenue > 0 ? (enterpriseExpenses / enterpriseRevenue) * 100 : null;
  const netMarginPercent =
    enterpriseRevenue > 0 ? (enterpriseNet / enterpriseRevenue) * 100 : null;

  const currentMonthNumber = new Date().getMonth() + 1;
  const trends = enterprisePerf?.monthly_trends ?? [];
  const currentMonthTrend =
    trends.find((t) => t.month === currentMonthNumber) ?? null;
  const previousMonthTrend =
    trends.find((t) => t.month === currentMonthNumber - 1) ?? null;

  function evolutionPercent(
    current: number,
    previous: number | null,
  ): number | null {
    if (previous == null || previous === 0) return null;
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  const monthRevenue = Number(currentMonthTrend?.revenue ?? 0) || 0;
  const monthExpense = Number(currentMonthTrend?.expense ?? 0) || 0;
  const monthNet = Number(currentMonthTrend?.net ?? 0) || 0;
  const revenueEvolution = evolutionPercent(
    monthRevenue,
    previousMonthTrend ? Number(previousMonthTrend.revenue) || 0 : null,
  );
  const expenseEvolution = evolutionPercent(
    monthExpense,
    previousMonthTrend ? Number(previousMonthTrend.expense) || 0 : null,
  );
  const netEvolution = evolutionPercent(
    monthNet,
    previousMonthTrend ? Number(previousMonthTrend.net) || 0 : null,
  );

  if (
    !primaryRole
    || primaryRole === "COMITE_CHARAIQUE"
    || primaryRole === "JURIDIQUE_CONFORMITE"
  ) {
    return <LoadingState label="Redirection vers votre espace…" />;
  }

  if (loading) return <LoadingState label="Chargement du tableau de bord…" />;

  return (
    <div className="space-y-8">
      {/* En-tête héro */}
      <section className="relative overflow-hidden rounded-2xl border border-[var(--sf-green)]/15 bg-gradient-to-br from-[var(--sf-green-deep)] via-[var(--sf-green)] to-[#163322] px-5 py-5 text-white shadow-lg sm:px-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='48' height='48' viewBox='0 0 48 48' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='%23c9a227'%3E%3Cpath d='M24 0l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: "40px 40px",
          }}
        />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-medium tracking-[0.18em] text-[var(--sf-gold-soft)] uppercase">
              {formatTodayLong()}
            </p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight sm:text-2xl">
              {greetingForNow()}
              {displayName ? `, ${displayName}` : ""}
              {roleLabel ? (
                <span className="ml-2 align-middle text-xs font-normal text-white/60">
                  {roleLabel}
                </span>
              ) : null}
            </h1>

            {stats.validations > 0 ? (
              <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/40 bg-amber-400/15 px-3 py-1.5 text-xs font-medium text-amber-100">
                <span aria-hidden>⚡</span>
                {stats.validations} validation{stats.validations > 1 ? "s" : ""}{" "}
                attend{stats.validations > 1 ? "ent" : ""} votre décision
                {validationTypeBreakdown ? ` — ${validationTypeBreakdown}` : ""}
              </p>
            ) : stats.draft > 0 ? (
              <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">
                <span aria-hidden>✎</span>
                {stats.draft} brouillon{stats.draft > 1 ? "s" : ""} à finaliser
              </p>
            ) : stats.inReview > 0 ? (
              <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/90">
                <span aria-hidden>⏳</span>
                {stats.inReview} dossier{stats.inReview > 1 ? "s" : ""} en revue
              </p>
            ) : (
              <p className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-100">
                <span aria-hidden>✓</span>
                Tout est à jour — aucune action urgente
              </p>
            )}

            <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-medium text-white/85 tabular-nums">
                {stats.active} dossier{stats.active > 1 ? "s" : ""} en activité
              </span>
              {stats.newThisMonth > 0 ? (
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-medium text-white/85 tabular-nums">
                  +{stats.newThisMonth} ce mois-ci
                </span>
              ) : null}
              {canSeeInvestments && investStats ? (
                <span className="rounded-full border border-[var(--sf-gold)]/30 bg-[var(--sf-gold)]/15 px-2.5 py-1 font-medium text-[var(--sf-gold-soft)] tabular-nums">
                  {formatMoney(investStats.total_current_value, investCurrency)} sous
                  gestion
                </span>
              ) : null}
              {canSeeComptabilite && enterpriseSummary ? (
                <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 font-medium text-white/85 tabular-nums">
                  Trésorerie{" "}
                  {formatMoney(enterpriseSummary.total_balance, enterpriseCurrency)}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {stats.validations > 0 && queue[0] ? (
              <Link
                href={`/dossiers/${queue[0].case}/validations`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-[var(--sf-green-deep)] shadow-md transition hover:brightness-105"
              >
                Traiter les validations
              </Link>
            ) : null}
            {canCreateCase ? (
              <Link
                href="/dossiers/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sf-gold)] px-4 py-2 text-xs font-semibold text-[var(--sf-green-deep)] shadow-md transition hover:brightness-105"
              >
                <span className="text-base leading-none">+</span>
                Nouveau dossier
              </Link>
            ) : null}
            <Link
              href="/dossiers"
              className="inline-flex items-center rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-xs font-medium backdrop-blur-sm transition hover:bg-white/15"
            >
              Tous les dossiers
            </Link>
          </div>
        </div>
      </section>

      {error ? <ErrorAlert message={error} /> : null}

      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={<FolderIcon className="h-6 w-6" />}
          label="Dossiers"
          value={stats.total}
          hint={
            stats.newThisMonth > 0
              ? `+${stats.newThisMonth} ce mois-ci · ${stats.closed} clôturé${stats.closed > 1 ? "s" : ""}`
              : `${stats.closed} clôturé${stats.closed > 1 ? "s" : ""} · portefeuille accessible`
          }
          accent="green"
          href="/dossiers"
        />
        <KpiCard
          icon={<CheckCircleIcon className="h-6 w-6" />}
          label="En activité"
          value={stats.active}
          hint={
            stats.inReview > 0
              ? `dont ${stats.inReview} en revue`
              : "Actifs et en revue"
          }
          accent="emerald"
          href="/dossiers"
          progressPercent={
            stats.total > 0 ? (stats.active / stats.total) * 100 : null
          }
          progressLabel="du portefeuille"
        />
        <KpiCard
          icon={<ClockIcon className="h-6 w-6" />}
          label="Brouillons"
          value={stats.draft}
          hint={stats.draft > 0 ? "À finaliser" : "Rien à finaliser"}
          accent="slate"
          href="/dossiers"
          progressPercent={
            stats.total > 0 ? (stats.draft / stats.total) * 100 : null
          }
          progressLabel="du portefeuille"
        />
        <KpiCard
          icon={<AlertIcon className="h-6 w-6" />}
          label="Validations"
          value={stats.validations}
          hint={
            stats.validations > 0
              ? validationTypeBreakdown || "En attente pour vos rôles"
              : "Aucune en attente pour vos rôles"
          }
          accent={stats.validations > 0 ? "amber" : "slate"}
          highlight={stats.validations > 0}
        />
      </div>

      {/* Finance & investissements — rôles autorisés uniquement */}
      {canSeeInvestments && investStats ? (
        <section className="rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex rounded-xl bg-[var(--sf-green)]/10 p-2 text-[var(--sf-green)]">
                <TrendIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-[var(--sf-green-deep)]">
                  Finance & investissements
                </h2>
                <p className="text-xs text-[var(--sf-green)]/50">
                  {investDashboard?.totals.investment_count ?? 0} position(s) ·{" "}
                  {investDashboard?.totals.case_count ?? 0} dossier(s) éligible(s)
                </p>
              </div>
            </div>
            <Link
              href="/investissements"
              className="text-sm font-medium text-[var(--sf-green-mid)] hover:text-[var(--sf-green)]"
            >
              Ouvrir →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMoneyStat
              label="Enveloppe totale"
              value={
                hasEnvelope
                  ? formatMoney(investStats.total_planned_envelope, investCurrency)
                  : "—"
              }
              hint={`${investorCount} investisseur${investorCount > 1 ? "s" : ""} (dossiers)`}
            />
            <MiniMoneyStat
              label="Capital investi"
              value={formatMoney(investStats.total_invested, investCurrency)}
              hint={
                investedPercent != null
                  ? `${investedPercent.toFixed(1)} % de l'enveloppe`
                  : `${investDashboard?.totals.investment_count ?? 0} position(s)`
              }
            />
            <MiniMoneyStat
              label="Valeur actuelle"
              value={formatMoney(investStats.total_current_value, investCurrency)}
              hint={
                performancePercent != null
                  ? `${performancePercent >= 0 ? "+" : ""}${performancePercent.toFixed(1)} % · Plus-value ${formatMoney(investStats.latent_gain, investCurrency)}`
                  : `Plus-value ${formatMoney(investStats.latent_gain, investCurrency)}`
              }
            />
            <MiniMoneyStat
              label="Reste à investir"
              value={
                hasEnvelope
                  ? formatMoney(
                      investStats.remaining_planned_envelope ??
                        investStats.uninvested_amount,
                      investCurrency,
                    )
                  : formatMoney(investStats.uninvested_amount, investCurrency)
              }
              hint={
                remainingPercent != null
                  ? `${remainingPercent.toFixed(1)} % de l'enveloppe`
                  : undefined
              }
            />
          </div>
        </section>
      ) : null}

      {/* Comptabilité SOFIGEPAM — rôles autorisés uniquement */}
      {canSeeComptabilite && enterpriseSummary && enterprisePerf ? (
        <section className="rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex rounded-xl bg-[var(--sf-gold)]/15 p-2 text-[#8a6d1c]">
                <CalculatorIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-[var(--sf-green-deep)]">
                  Comptabilité
                </h2>
                <p className="text-xs text-[var(--sf-green)]/50">
                  {enterprisePerf.period_label} · {enterprisePerf.movement_count}{" "}
                  mouvement{enterprisePerf.movement_count > 1 ? "s" : ""} approuvé
                  {enterprisePerf.movement_count > 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <Link
              href="/comptable"
              className="text-sm font-medium text-[var(--sf-green-mid)] hover:text-[var(--sf-green)]"
            >
              Ouvrir →
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMoneyStat
              label="Chiffre d'affaires"
              value={formatMoney(enterprisePerf.chiffre_affaires, enterpriseCurrency)}
              hint={`Exercice ${enterprisePerf.year} · factures validées`}
            />
            <MiniMoneyStat
              label="Dépenses"
              value={formatMoney(enterprisePerf.total_depenses, enterpriseCurrency)}
              hint={
                expensePercent != null
                  ? `${expensePercent.toFixed(1)} % du chiffre d'affaires`
                  : undefined
              }
            />
            <MiniMoneyStat
              label="Résultat net"
              value={formatMoney(enterprisePerf.resultat_net, enterpriseCurrency)}
              hint={
                netMarginPercent != null
                  ? `Marge nette ${netMarginPercent >= 0 ? "+" : ""}${netMarginPercent.toFixed(1)} %`
                  : undefined
              }
            />
            <MiniMoneyStat
              label="Trésorerie"
              value={formatMoney(enterpriseSummary.total_balance, enterpriseCurrency)}
              hint={`${enterpriseSummary.account_count} compte${enterpriseSummary.account_count > 1 ? "s" : ""}`}
            />
          </div>

          <div className="mt-4 border-t border-[var(--sf-cream-dark)] pt-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
              Mois en cours{currentMonthTrend ? ` — ${currentMonthTrend.label}` : ""}
              {previousMonthTrend
                ? ` · évolution vs ${previousMonthTrend.label}`
                : ""}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMoneyStat
                label="Recettes du mois"
                value={formatMoney(String(monthRevenue), enterpriseCurrency)}
                trend={revenueEvolution}
              />
              <MiniMoneyStat
                label="Dépenses du mois"
                value={formatMoney(String(monthExpense), enterpriseCurrency)}
                trend={expenseEvolution}
                trendPositiveIsGood={false}
              />
              <MiniMoneyStat
                label="Résultat du mois"
                value={formatMoney(String(monthNet), enterpriseCurrency)}
                trend={netEvolution}
              />
            </div>
          </div>
        </section>
      ) : null}

      {/* Courbes côte à côte : comptabilité & finance */}
      {(canSeeComptabilite && enterprisePerf) ||
      (canSeeInvestments && investDashboard) ? (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--sf-green-deep)]">
              Évolution comptabilité & finance
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5 text-xs text-[var(--sf-green)]/60">
                Année
                <select
                  value={chartYear}
                  onChange={(e) => setChartYear(Number(e.target.value))}
                  className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-2.5 py-1.5 text-xs text-[var(--sf-green-deep)]"
                >
                  {chartYearOptions.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-[var(--sf-green)]/60">
                Mois
                <select
                  value={chartMonth}
                  onChange={(e) => setChartMonth(e.target.value)}
                  className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-2.5 py-1.5 text-xs text-[var(--sf-green-deep)]"
                >
                  <option value="">Tous</option>
                  {MONTH_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {canSeeComptabilite && enterprisePerf ? (
              <MonthlyTrendChart
                title={`Comptabilité — ${chartMonth ? `${MONTH_OPTIONS[Number(chartMonth) - 1]?.label} ` : ""}${chartYear}`}
                subtitle="Recettes vs dépenses (mouvements approuvés)"
                data={monthlyTrendData}
                currency={enterpriseCurrency}
              />
            ) : null}
            {canSeeInvestments && investDashboard ? (
              <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                    Finance — évolution du patrimoine{" "}
                    {chartMonth
                      ? `(${MONTH_OPTIONS[Number(chartMonth) - 1]?.label} ${chartYear})`
                      : `(${chartYear})`}
                  </h3>
                  <p className="text-xs text-[var(--sf-green)]/50">
                    Estimations par classe d&apos;actif — l&apos;ensemble est la somme des
                    catégories
                  </p>
                </div>
                {filteredPatrimonySeries.length > 0 ? (
                  <PatrimonyEvolutionChart
                    series={filteredPatrimonySeries}
                    currency={investCurrency}
                  />
                ) : (
                  <p className="py-10 text-center text-sm text-[var(--sf-green)]/45">
                    Aucune donnée d&apos;investissement sur cette période
                  </p>
                )}
              </section>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Colonne gauche */}
        <div className="space-y-6 lg:col-span-2">
          {queue.length > 0 ? (
            <section className="rounded-2xl border border-amber-200/90 bg-gradient-to-b from-amber-50 to-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-amber-950">Validations à traiter</h2>
                <span className="rounded-full bg-amber-200/80 px-2.5 py-0.5 text-xs font-semibold text-amber-950">
                  {queue.length}
                </span>
              </div>
              <ul className="mt-4 space-y-2">
                {queue.slice(0, 5).map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/dossiers/${item.case}/validations`}
                      className="group block rounded-xl border border-amber-100 bg-white px-4 py-3 transition hover:border-amber-300 hover:shadow-sm"
                    >
                      <p className="text-sm font-medium text-[var(--sf-green-deep)] group-hover:text-[var(--sf-green-mid)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-amber-900/70">
                        {item.case_reference}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <section className="rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-[var(--sf-green-deep)]">Validations</h2>
              <p className="mt-2 text-sm text-[var(--sf-green)]/60">
                Aucune validation en attente pour vos rôles.
              </p>
            </section>
          )}

          {notifications.length > 0 ? (
            <section className="rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-[var(--sf-green-deep)]">Notifications</h2>
              <ul className="mt-4 space-y-2">
                {notifications.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-xl border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-[var(--sf-green-deep)]">{note.title}</p>
                    {note.body ? (
                      <p className="mt-0.5 text-xs text-[var(--sf-green)]/60">{note.body}</p>
                    ) : null}
                    {note.action_path ? (
                      <Link
                        href={note.action_path}
                        className="mt-2 inline-block text-xs font-medium text-[var(--sf-green-mid)]"
                        onClick={() =>
                          apiRequest(`/notifications/${note.id}/read/`, { method: "POST" })
                        }
                      >
                        Voir →
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {statusBreakdown.length > 0 ? (
            <section className="rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
              <h2 className="font-semibold text-[var(--sf-green-deep)]">Répartition par statut</h2>
              <ul className="mt-4 space-y-3">
                {statusBreakdown.map(([status, count]) => {
                  const pct = stats.total ? Math.round((count / stats.total) * 100) : 0;
                  return (
                    <li key={status}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[var(--sf-green)]/80">
                          {CASE_STATUS_LABELS[status] ?? status}
                        </span>
                        <span className="font-medium tabular-nums text-[var(--sf-green-deep)]">
                          {count}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--sf-cream)]">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--sf-green)] to-[var(--sf-green-mid)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="rounded-2xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">Accès rapide</h2>
            <div className="mt-3 grid gap-2">
              {quickLinks.map((link) => (
                <QuickLink key={link.href} href={link.href} label={link.label} />
              ))}
              {stats.closed > 0 ? (
                <p className="px-1 pt-1 text-xs text-[var(--sf-green)]/50">
                  {stats.closed} dossier{stats.closed > 1 ? "s" : ""} clôturé
                  {stats.closed > 1 ? "s" : ""}
                </p>
              ) : null}
            </div>
          </section>
        </div>

        {/* Dossiers récents */}
        <section className="lg:col-span-3">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold text-[var(--sf-green-deep)]">
              Dossiers récents
            </h2>
            <Link
              href="/dossiers"
              className="text-sm font-medium text-[var(--sf-green-mid)] hover:text-[var(--sf-green)]"
            >
              Voir tout →
            </Link>
          </div>

          {recentCases.length === 0 ? (
            <EmptyState
              title="Aucun dossier"
              description={
                canCreateCase
                  ? "Commencez par créer votre premier dossier fiduciaire."
                  : "Aucun dossier accessible avec vos rôles pour le moment."
              }
              action={
                canCreateCase ? (
                  <Link
                    href="/dossiers/new"
                    className="inline-flex rounded-xl bg-[var(--sf-green-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--sf-green)]"
                  >
                    Créer un dossier
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/80 text-xs font-medium tracking-wide text-[var(--sf-green)]/70 uppercase">
                      <th className="px-5 py-3.5">Référence</th>
                      <th className="px-5 py-3.5">Titre</th>
                      <th className="px-5 py-3.5">Statut</th>
                      <th className="hidden px-5 py-3.5 sm:table-cell">Mis à jour</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCases.map((c) => (
                      <tr
                        key={c.id}
                        className="group border-b border-[var(--sf-cream-dark)]/60 last:border-0 transition hover:bg-[var(--sf-cream)]/50"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/dossiers/${c.id}`}
                            className="font-mono text-sm font-medium text-[var(--sf-green-mid)] group-hover:text-[var(--sf-green)]"
                          >
                            {c.reference}
                          </Link>
                        </td>
                        <td className="max-w-[200px] truncate px-5 py-4 font-medium text-[var(--sf-green-deep)]">
                          {c.title}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={c.status} />
                        </td>
                        <td className="hidden px-5 py-4 text-[var(--sf-green)]/55 sm:table-cell">
                          {formatDate(c.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

type Accent = "green" | "emerald" | "amber" | "slate";

const ACCENT_STYLES: Record<Accent, { icon: string; ring: string; bar: string }> = {
  green: {
    icon: "bg-[var(--sf-green)]/10 text-[var(--sf-green)]",
    ring: "border-[var(--sf-green)]/10",
    bar: "bg-[var(--sf-green)]",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-700",
    ring: "border-emerald-100",
    bar: "bg-emerald-600",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700",
    ring: "border-amber-200",
    bar: "bg-amber-500",
  },
  slate: {
    icon: "bg-slate-100 text-slate-600",
    ring: "border-slate-100",
    bar: "bg-slate-400",
  },
};

function KpiCard({
  icon,
  label,
  value,
  hint,
  accent,
  highlight = false,
  href,
  progressPercent,
  progressLabel,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint: string;
  accent: Accent;
  highlight?: boolean;
  href?: string;
  /** Barre de progression (part du total, 0–100). */
  progressPercent?: number | null;
  progressLabel?: string;
}) {
  const styles = ACCENT_STYLES[accent];
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className={`inline-flex rounded-xl p-2.5 ${styles.icon}`}>{icon}</div>
        {href ? (
          <span
            className="text-sm text-[var(--sf-green)]/35 transition group-hover:translate-x-0.5 group-hover:text-[var(--sf-green)]"
            aria-hidden
          >
            →
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-[var(--sf-green-deep)]">
        {value}
      </p>
      <p className="mt-1 text-sm font-medium text-[var(--sf-green-deep)]">{label}</p>
      <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">{hint}</p>
      {progressPercent != null ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--sf-cream)]">
            <div
              className={`h-full rounded-full ${styles.bar}`}
              style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
            />
          </div>
          <p className="mt-1 text-[11px] tabular-nums text-[var(--sf-green)]/45">
            {progressPercent.toFixed(0)} %{progressLabel ? ` ${progressLabel}` : ""}
          </p>
        </div>
      ) : null}
    </>
  );

  const className = `group block rounded-2xl border bg-white p-5 shadow-sm transition hover:shadow-md ${styles.ring} ${
    highlight ? "ring-2 ring-amber-200/60" : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    );
  }
  return <div className={className}>{body}</div>;
}

function MiniMoneyStat({
  label,
  value,
  hint,
  trend,
  trendPositiveIsGood = true,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Évolution en % vs période précédente (null = non calculable). */
  trend?: number | null;
  /** false pour les dépenses : une hausse est affichée en rouge. */
  trendPositiveIsGood?: boolean;
}) {
  let trendNode: React.ReactNode = null;
  if (trend !== undefined) {
    if (trend == null) {
      trendNode = (
        <p className="mt-0.5 text-xs text-[var(--sf-green)]/45">
          Pas de comparaison possible
        </p>
      );
    } else {
      const up = trend >= 0;
      const good = up === trendPositiveIsGood;
      trendNode = (
        <p
          className={`mt-0.5 text-xs font-medium tabular-nums ${
            good ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {up ? "▲" : "▼"} {up ? "+" : ""}
          {trend.toFixed(1)} % vs mois précédent
        </p>
      );
    }
  }
  return (
    <div className="rounded-xl bg-[var(--sf-cream)]/40 px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/50">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums text-[var(--sf-green-deep)]">
        {value}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-[var(--sf-green)]/45">{hint}</p>
      ) : null}
      {trendNode}
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-xl border border-[var(--sf-cream-dark)] px-4 py-2.5 text-sm font-medium text-[var(--sf-green-deep)] transition hover:border-[var(--sf-green)]/20 hover:bg-[var(--sf-cream)]"
    >
      {label}
      <span className="text-[var(--sf-gold)]">→</span>
    </Link>
  );
}
