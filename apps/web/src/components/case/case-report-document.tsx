"use client";

import { useMemo } from "react";

import {
  AllocationStackedBar,
  DashboardKpi,
  DashboardPanel,
  DonutChart,
  PatrimonyEvolutionChart,
  SemiCircleGauge,
  type ChartSlice,
} from "@/components/investments/investment-charts";
import { ReportSuccessionTrees } from "@/components/case/report-succession-trees";
import { DocumentLetterhead } from "@/components/documents/document-letterhead";
import {
  ASSET_CLASS_SLUG_LABELS,
  assetClassColor,
  NON_INVESTED_COLOR,
} from "@/lib/investment-labels";
import { ASSET_TYPE_LABELS, formatMoney } from "@/lib/labels";
import {
  getReportServiceProfile,
  KPI_LABELS,
  type ReportServiceProfile,
} from "@/lib/report-service-profiles";
import type { ReportSnapshot } from "@/types/api";

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  INCOME: "Recette",
  EXPENSE: "Dépense",
  FEE: "Honoraire",
  DISTRIBUTION: "Distribution",
  TRANSFER: "Virement",
  ADJUSTMENT: "Ajustement",
};

function formatReportDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sf-green)]/50">
        {label}
      </p>
      <p className="mt-1 text-base font-semibold tabular-nums text-[var(--sf-green-deep)] sm:text-lg">
        {value}
      </p>
    </div>
  );
}

type Props = {
  snap: ReportSnapshot;
  className?: string;
  showAssetList?: boolean;
  /** En-tête officiel Amanah Fiducie (logo, claim, QR). */
  showLetterhead?: boolean;
  /** Titre du document sous l'en-tête. */
  documentTitle?: string;
};

/**
 * Corps du rapport — source unique aperçu écran / aperçu PDF A4.
 * Mise en page pleine largeur pour que graphiques et tableaux s'affichent correctement.
 */
export function CaseReportDocument({
  snap,
  className = "space-y-6",
  showAssetList = true,
  showLetterhead = true,
  documentTitle,
}: Props) {
  const profile: ReportServiceProfile = useMemo(() => {
    if (snap.service) return getReportServiceProfile(snap.case?.case_type, snap.service);
    return getReportServiceProfile(snap.case?.case_type);
  }, [snap]);

  const sections = profile.sections;
  const currency = snap.kpis?.currency || "XOF";
  const kpis = snap.kpis;
  const investedPct = Number(kpis?.invested_percent || 0);

  const targetSlices: ChartSlice[] = useMemo(() => {
    const targets =
      snap.investments?.policy?.patrimony_category?.allocation_targets || {};
    const planned = Number(snap.investments?.policy?.planned_investment_amount || 0);
    return Object.entries(targets)
      .filter(([, p]) => Number(p) > 0)
      .map(([slug, percent]) => ({
        label: ASSET_CLASS_SLUG_LABELS[slug] ?? slug,
        percent: Number(percent),
        amount:
          planned > 0 ? String((planned * Number(percent)) / 100) : undefined,
        color: assetClassColor(slug),
        code: slug,
      }));
  }, [snap]);

  const investedSlices: ChartSlice[] = useMemo(() => {
    const rows = snap.investments?.allocation_rows || [];
    const available = Number(
      snap.investments?.charts?.invested_vs_available?.available_amount || 0,
    );
    const slices: ChartSlice[] = rows
      .filter((r) => Number(r.invested_amount) > 0)
      .map((r) => ({
        label: ASSET_CLASS_SLUG_LABELS[r.slug] ?? r.slug,
        amount: r.invested_amount,
        percent: 0,
        color: assetClassColor(r.slug),
        code: r.slug,
      }));
    if (available > 0) {
      slices.push({
        label: "Non investi",
        amount: String(available),
        percent: 0,
        color: NON_INVESTED_COLOR,
        code: "non-investi",
      });
    }
    return slices;
  }, [snap]);

  const patrimonySlices: ChartSlice[] = useMemo(() => {
    return (snap.patrimony?.by_type_slices || []).map((s) => ({
      label: ASSET_TYPE_LABELS[s.code] ?? s.label,
      amount: s.amount,
      percent: s.percent,
      code: s.code,
    }));
  }, [snap]);

  const allocationSegments = useMemo(() => {
    return (snap.investments?.allocation_rows || []).map((r) => ({
      slug: r.slug,
      label: ASSET_CLASS_SLUG_LABELS[r.slug] ?? r.slug,
      target: r.target_percent,
      targetAmount: Number(r.target_amount) || 0,
      investedAmount: Number(r.invested_amount) || 0,
      remainingAmount: Number(r.remaining_amount) || 0,
    }));
  }, [snap]);

  const evolutionSeries = useMemo(() => {
    const points = snap.investments?.charts?.patrimony_evolution || [];
    if (!points.length) return [];
    return [
      {
        slug: "general",
        label: "Ensemble du patrimoine investi",
        points: points.map((p) => ({
          date: p.date,
          value: p.value,
        })),
      },
    ];
  }, [snap]);

  function kpiValue(
    key: string,
  ): { money?: string; value?: string; hint?: string } | null {
    if (!kpis) return null;
    switch (key) {
      case "patrimony_total":
        return { money: kpis.patrimony_total || "0" };
      case "liquidities":
        return { money: kpis.liquidities || "0" };
      case "invested_amount":
        return {
          money: kpis.invested_amount || "0",
          hint: `${investedPct} % de l'enveloppe`,
        };
      case "annual_yield_percent":
        return {
          value:
            kpis.annual_yield_percent != null
              ? `${Number(kpis.annual_yield_percent).toFixed(1)} %`
              : "—",
        };
      case "period_net_flow":
        return { money: kpis.period_net_flow || "0" };
      case "period_patrimony_net":
        return { money: kpis.period_patrimony_net || "0" };
      case "minors_count":
        return { value: String(kpis.minors_count ?? 0) };
      case "heirs_count":
        return { value: String(kpis.heirs_count ?? 0) };
      case "beneficiaries_count":
        return { value: String(kpis.beneficiaries_count ?? 0) };
      case "zakatable_wealth":
        return { money: kpis.zakatable_wealth || "0" };
      case "zakat_due":
        return { money: kpis.zakat_due || "0" };
      case "faraid_share_total":
        return {
          value:
            kpis.faraid_share_total != null
              ? `${(Number(kpis.faraid_share_total) * 100).toFixed(1)} %`
              : "—",
        };
      default:
        return null;
    }
  }

  const assets = snap.patrimony?.assets || [];
  const listBiens =
    showAssetList &&
    sections.patrimony &&
    assets.length > 0 &&
    (snap.case?.case_type === "TUTELLE_CANTONNEMENT" ||
      snap.case?.case_type === "MANDAT_FIDUCIAIRE" ||
      Boolean(sections.minors_focus));

  const movements = snap.finance?.period_flows?.movements || [];

  return (
    <div className={`min-w-0 ${className}`}>
      {showLetterhead ? <DocumentLetterhead className="mb-5" /> : null}
      {documentTitle ? (
        <div className="mb-5 border-b border-[var(--sf-cream-dark)] pb-3">
          <p className="text-base font-semibold leading-snug text-[var(--sf-green-deep)]">
            {documentTitle}
          </p>
        </div>
      ) : null}

      {/* En-tête service */}
      <div className="overflow-hidden rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/45">
          Service
        </p>
        <p className="mt-1 text-base font-semibold text-[var(--sf-green-deep)]">
          {profile.report_name}
        </p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--sf-green)]/60">
          {profile.subtitle}
        </p>
        <div className="mt-4 grid gap-1 border-t border-[var(--sf-cream-dark)]/80 pt-4 text-sm">
          <p className="font-semibold text-[var(--sf-green-deep)]">
            {snap.case?.reference} — {snap.case?.title}
          </p>
          <p className="text-[var(--sf-green)]/55">
            {snap.case?.case_type_label} · {snap.case?.status_label}
            {snap.case?.assigned_to_name
              ? ` · Chargé : ${snap.case.assigned_to_name}`
              : null}
          </p>
          <p className="text-[var(--sf-green)]/70">
            Période : <strong>{snap.period?.label}</strong>
            {snap.period?.start && snap.period?.end
              ? ` (${formatReportDate(snap.period.start)} → ${formatReportDate(snap.period.end)})`
              : null}
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {profile.kpis.map((key) => {
          const displayed = kpiValue(key);
          if (!displayed) return null;
          return (
            <DashboardKpi
              key={key}
              label={KPI_LABELS[key] || key}
              moneyAmount={displayed.money}
              value={displayed.value}
              hint={displayed.hint}
            />
          );
        })}
      </div>

      {sections.waqf && snap.waqf ? (
        <DashboardPanel title="Waqf" subtitle={snap.waqf.waqf_type_label}>
          <p className="text-sm text-[var(--sf-green-deep)]">
            <strong>Objet :</strong> {snap.waqf.waqf_object || "—"}
          </p>
          <p className="mt-2 text-sm text-[var(--sf-green)]/70">
            <strong>Répartition :</strong>{" "}
            {snap.waqf.waqf_distribution_rules || "—"}
          </p>
        </DashboardPanel>
      ) : null}

      {sections.zakat && snap.zakat ? (
        <DashboardPanel title="Zakat" subtitle="Assiettes et montants dus">
          {snap.zakat.latest ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <MetricCard label="Année" value={String(snap.zakat.latest.year)} />
              <MetricCard
                label="Assiette"
                value={formatMoney(snap.zakat.latest.zakatable_wealth, currency)}
              />
              <MetricCard
                label="Zakat due"
                value={formatMoney(snap.zakat.latest.zakat_due, currency)}
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--sf-green)]/45">Aucune évaluation zakat.</p>
          )}
        </DashboardPanel>
      ) : null}

      {sections.genealogy ? (
        snap.genealogy ? (
          <div className="min-w-0 overflow-x-auto">
            <ReportSuccessionTrees genealogy={snap.genealogy} />
          </div>
        ) : (
          <DashboardPanel title="Arbres généalogiques">
            <p className="text-sm text-[var(--sf-green)]/55">
              Arbres absents de ce brouillon. Régénérez le rapport.
            </p>
          </DashboardPanel>
        )
      ) : null}

      {sections.faraid && snap.faraid ? (
        <DashboardPanel
          title="Farāʾiḍ"
          subtitle={`${snap.faraid.heirs_count} héritier(s)`}
        >
          {snap.faraid.review ? (
            <p className="mb-3 text-sm text-[var(--sf-green)]/70">
              Revue : {snap.faraid.review.status_label}
              {snap.faraid.review.net_estate
                ? ` · patrimoine net ${formatMoney(snap.faraid.review.net_estate, currency)}`
                : null}
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-lg border border-[var(--sf-cream-dark)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--sf-cream)]/70 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/55">
                  <th className="px-3 py-2.5">Héritier</th>
                  <th className="px-3 py-2.5">Lien</th>
                  <th className="px-3 py-2.5 text-right">Part</th>
                </tr>
              </thead>
              <tbody>
                {snap.faraid.heirs.slice(0, 20).map((h, i) => (
                  <tr
                    key={`${h.full_name}-${i}`}
                    className="border-t border-[var(--sf-cream-dark)]/70"
                  >
                    <td className="px-3 py-2.5 font-medium text-[var(--sf-green-deep)]">
                      {h.full_name}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--sf-green)]/60">
                      {h.relationship_label || "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-[var(--sf-green-deep)]">
                      {h.share_percent.toFixed(2)} %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
      ) : null}

      {/* Finance — synthèse seule */}
      {sections.finance && snap.finance ? (
        <DashboardPanel
          title="Finance — période"
          subtitle="Recettes, dépenses et solde fiduciaire"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Recettes"
              value={formatMoney(
                snap.finance.period_flows?.income_total || "0",
                currency,
              )}
            />
            <MetricCard
              label="Dépenses"
              value={formatMoney(
                snap.finance.period_flows?.expense_total || "0",
                currency,
              )}
            />
            <MetricCard
              label="Net"
              value={formatMoney(
                snap.finance.period_flows?.net_flow || "0",
                currency,
              )}
            />
            <MetricCard
              label="Solde comptes"
              value={formatMoney(snap.finance.total_balance || "0", currency)}
            />
          </div>
          <p className="mt-3 text-xs text-[var(--sf-green)]/50">
            {snap.finance.account_count ?? 0} compte(s) ·{" "}
            {snap.finance.period_flows?.movement_count ?? 0} mouvement(s) sur la
            période
          </p>
        </DashboardPanel>
      ) : null}

      {/* Mouvements — tableau séparé */}
      {sections.finance && movements.length > 0 ? (
        <DashboardPanel
          title="Mouvements de la période"
          subtitle={`${snap.finance?.period_flows?.movement_count ?? movements.length} opération(s)`}
        >
          <div className="overflow-x-auto rounded-lg border border-[var(--sf-cream-dark)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--sf-cream)]/70 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/55">
                  <th className="whitespace-nowrap px-3 py-2.5">Date</th>
                  <th className="px-3 py-2.5">Libellé</th>
                  <th className="whitespace-nowrap px-3 py-2.5">Type</th>
                  <th className="whitespace-nowrap px-3 py-2.5 text-right">Montant</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-[var(--sf-cream-dark)]/70 align-top"
                  >
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-[var(--sf-green)]/65">
                      {formatReportDate(m.date)}
                    </td>
                    <td className="max-w-[28rem] px-3 py-2.5 leading-snug text-[var(--sf-green-deep)]">
                      {m.label || m.category || "—"}
                      {m.account ? (
                        <span className="mt-0.5 block text-[11px] text-[var(--sf-green)]/45">
                          {m.account}
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <span className="inline-flex rounded-md bg-[var(--sf-cream)] px-2 py-0.5 text-xs font-medium text-[var(--sf-green-deep)]">
                        {MOVEMENT_TYPE_LABELS[m.type] || m.type || "—"}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-[var(--sf-green-deep)]">
                      {formatMoney(m.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
      ) : null}

      {/* Patrimoine */}
      {sections.patrimony && snap.patrimony ? (
        <DashboardPanel
          title="Patrimoine"
          subtitle="Répartition et résultat sur la période"
        >
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <MetricCard
              label="Gains période"
              value={formatMoney(
                snap.patrimony.period_events?.period_gains || "0",
                currency,
              )}
            />
            <MetricCard
              label="Dépenses période"
              value={formatMoney(
                snap.patrimony.period_events?.period_expenses || "0",
                currency,
              )}
            />
            <MetricCard
              label="Net patrimonial"
              value={formatMoney(
                snap.patrimony.period_events?.period_net || "0",
                currency,
              )}
            />
          </div>
          {patrimonySlices.length > 0 ? (
            <div className="min-w-0 overflow-x-auto">
              <DonutChart
                slices={patrimonySlices}
                size={180}
                currency={currency}
                centerLabel={String(snap.patrimony.asset_count ?? 0)}
                centerHint="Actifs"
              />
            </div>
          ) : (
            <p className="text-sm text-[var(--sf-green)]/45">Aucun actif valorisé.</p>
          )}
        </DashboardPanel>
      ) : null}

      {listBiens ? (
        <DashboardPanel
          title={
            snap.case?.case_type === "TUTELLE_CANTONNEMENT"
              ? "Biens cantonnés"
              : "Inventaire des biens"
          }
          subtitle={`${assets.length} bien(s) enregistré(s)`}
        >
          <div className="overflow-x-auto rounded-lg border border-[var(--sf-cream-dark)]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--sf-cream)]/70 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/55">
                  <th className="px-3 py-2.5">Désignation</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-right">Valeur</th>
                </tr>
              </thead>
              <tbody>
                {assets.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-[var(--sf-cream-dark)]/70"
                  >
                    <td className="px-3 py-2.5 font-medium text-[var(--sf-green-deep)]">
                      {a.label}
                    </td>
                    <td className="px-3 py-2.5 text-[var(--sf-green)]/60">
                      {ASSET_TYPE_LABELS[a.asset_type] || a.asset_type}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[var(--sf-green-deep)]">
                      {formatMoney(a.latest_value || "0", a.currency || currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DashboardPanel>
      ) : null}

      {/* Investissements — panneaux séparés pour éviter l'écrasement */}
      {sections.investments && snap.investments ? (
        <>
          <DashboardPanel
            title="Investi / non investi"
            subtitle={
              snap.investments.policy?.patrimony_category?.code
                ? `Type ${snap.investments.policy.patrimony_category.code}`
                : "Positions actuelles"
            }
          >
            <div className="mx-auto max-w-md">
              <SemiCircleGauge
                investedPercent={investedPct}
                investedAmount={kpis?.invested_amount || "0"}
                availableAmount={kpis?.available_amount || "0"}
                currency={currency}
              />
            </div>
          </DashboardPanel>

          {targetSlices.length > 0 || investedSlices.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {targetSlices.length > 0 ? (
                <DashboardPanel title="Répartition cible" subtitle="Allocation prévue">
                  <div className="min-w-0 overflow-x-auto">
                    <DonutChart
                      slices={targetSlices}
                      size={180}
                      currency={currency}
                      centerLabel={
                        snap.investments.policy?.patrimony_category?.code || "—"
                      }
                      centerHint="Type"
                    />
                  </div>
                </DashboardPanel>
              ) : null}
              {investedSlices.length > 0 ? (
                <DashboardPanel
                  title="Positions investies"
                  subtitle="Répartition actuelle"
                >
                  <div className="min-w-0 overflow-x-auto">
                    <DonutChart
                      slices={investedSlices}
                      size={180}
                      currency={currency}
                      centerLabel={`${Math.round(investedPct)} %`}
                      centerHint="Investi"
                    />
                  </div>
                </DashboardPanel>
              ) : null}
            </div>
          ) : null}

          <DashboardPanel
            title="Allocation par classe"
            subtitle="Investi vs reste à investir"
          >
            {allocationSegments.length > 0 ? (
              <div className="min-w-0">
                <AllocationStackedBar
                  segments={allocationSegments}
                  currency={currency}
                />
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-[var(--sf-green)]/45">
                Aucune allocation cible.
              </p>
            )}
          </DashboardPanel>
        </>
      ) : null}

      {sections.investments && evolutionSeries.length > 0 ? (
        <DashboardPanel
          title="Évolution du patrimoine investi"
          subtitle="Historique des valorisations"
        >
          <div className="min-w-0 overflow-x-auto">
            <PatrimonyEvolutionChart series={evolutionSeries} currency={currency} />
          </div>
        </DashboardPanel>
      ) : null}

      {(sections.people || sections.mandates) ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.people ? (
            <DashboardPanel
              title={profile.people_label}
              subtitle={profile.donor_label}
            >
              <p className="text-sm text-[var(--sf-green-deep)]">
                {snap.people?.donors_count ?? 0} {profile.donor_label.toLowerCase()} ·{" "}
                {snap.people?.beneficiaries_count ?? 0}{" "}
                {profile.people_label.toLowerCase()}
                {sections.minors_focus
                  ? ` · ${snap.people?.minors_count ?? 0} mineur(s)`
                  : null}
                {sections.mandates
                  ? ` · ${snap.people?.mandates_count ?? 0} mandat(s)`
                  : null}
              </p>
              {(snap.people?.beneficiaries || []).length > 0 ? (
                <div className="mt-3 overflow-x-auto rounded-lg border border-[var(--sf-cream-dark)]">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[var(--sf-cream)]/70 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/55">
                        <th className="px-3 py-2">Nom</th>
                        <th className="px-3 py-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(snap.people?.beneficiaries || []).slice(0, 20).map((b, i) => (
                        <tr
                          key={`${b.name}-${i}`}
                          className="border-t border-[var(--sf-cream-dark)]/70"
                        >
                          <td className="px-3 py-2 text-[var(--sf-green-deep)]">
                            {b.name}
                          </td>
                          <td className="px-3 py-2 text-[var(--sf-green)]/60">
                            {b.is_minor ? "Mineur" : "Majeur"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </DashboardPanel>
          ) : null}

          {sections.mandates ? (
            <DashboardPanel title={profile.mandate_label} subtitle="Cadre juridique">
              {(snap.people?.mandates || []).length === 0 ? (
                <p className="text-sm text-[var(--sf-green)]/45">Aucun mandat.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-[var(--sf-cream-dark)]">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-[var(--sf-cream)]/70 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--sf-green)]/55">
                        <th className="px-3 py-2">Titre</th>
                        <th className="px-3 py-2">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(snap.people?.mandates || []).map((m, i) => (
                        <tr
                          key={`${m.title}-${i}`}
                          className="border-t border-[var(--sf-cream-dark)]/70"
                        >
                          <td className="px-3 py-2 text-[var(--sf-green-deep)]">
                            {m.title}
                          </td>
                          <td className="px-3 py-2 text-[var(--sf-green)]/60">
                            {m.status || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DashboardPanel>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
