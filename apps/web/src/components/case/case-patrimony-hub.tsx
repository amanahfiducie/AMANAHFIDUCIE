"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AssetEventsPanel } from "@/components/case/asset-events-panel";
import { GlobalPatrimoineEvolutionChart } from "@/components/case/asset-evolution-charts";
import { CasePatrimonyAssetShell } from "@/components/case/case-patrimony-asset-shell";
import {
  MetaGrid,
  MetricCard,
  PatrimoinePanel,
  PatrimoineSection,
} from "@/components/case/patrimoine-layout";
import { PatrimoineSubNav } from "@/components/case/patrimoine-sub-nav";
import { EmptyState } from "@/components/ui/empty";
import { ErrorAlert } from "@/components/ui/error-alert";
import { Card } from "@/components/ui/card";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import {
  ASSET_TYPE_LABELS,
  formatDate,
  formatMoney,
  VALUATION_FREQUENCY_LABELS,
} from "@/lib/labels";
import { computeCasePatrimonyFromAssets } from "@/lib/case-patrimony";
import { userIsCaseReadOnly } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import {
  computeAssetFinancialSummary,
  computePatrimonyMetricsFromAssets,
} from "@/lib/case-patrimony-metrics";
import { useCaseDetail } from "@/providers/case-detail-provider";
import type { Asset, AssetEventType, PatrimonySummary } from "@/types/api";

function patrimonyNotesFromOnboarding(
  onboardingData: Record<string, unknown> | undefined,
): { objectives: string; remarks: string; observations: string } {
  const od = onboardingData ?? {};
  const pick = (key: string) =>
    typeof od[key] === "string" ? (od[key] as string).trim() : "";
  return {
    objectives: pick("patrimony_objectives"),
    remarks: pick("patrimony_remarks"),
    observations: pick("patrimony_observations"),
  };
}

function TextSection({
  title,
  body,
  emptyHint,
}: {
  title: string;
  body: string;
  emptyHint: string;
}) {
  return (
    <Card className="p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">{title}</h3>
      {body ? (
        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[var(--sf-green)]/75">
          {body}
        </p>
      ) : (
        <p className="mt-2 text-sm text-[var(--sf-green)]/45">{emptyHint}</p>
      )}
    </Card>
  );
}

function AssetListRow({
  asset,
  navBase,
  compact,
}: {
  asset: Asset;
  navBase: string;
  compact?: boolean;
}) {
  const href = `${navBase}/patrimoine/actifs/${asset.id}`;
  const typeLabel = ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type;
  const currency = asset.latest_currency ?? asset.currency;

  return (
    <Link
      href={href}
      className={`flex flex-wrap items-center justify-between gap-2 transition ${
        compact
          ? "px-4 py-3 hover:bg-[var(--sf-cream)]/40"
          : "rounded-lg border border-[var(--sf-cream-dark)] bg-white px-4 py-3 hover:border-[var(--sf-green)]/25 hover:shadow-sm"
      }`}
    >
      <div className="min-w-0">
        <p className="font-medium text-[var(--sf-green-deep)]">{asset.label}</p>
        <p className="text-xs text-[var(--sf-green)]/50">
          {typeLabel}
          {asset.valuation_overdue ? (
            <span className="ml-2 text-red-800">· Réévaluation en retard</span>
          ) : asset.valuation_next_due ? (
            <span className="ml-2 text-[var(--sf-green)]/40">
              · Prochaine rééval. {formatDate(asset.valuation_next_due)}
            </span>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-2 text-right">
        {asset.latest_value ? (
          <p className="font-mono text-sm text-emerald-900">
            {formatMoney(asset.latest_value, currency)}
          </p>
        ) : (
          <p className="text-xs text-[var(--sf-green)]/45">Non estimé</p>
        )}
        <span className="text-[var(--sf-green)]/35" aria-hidden>
          →
        </span>
      </div>
    </Link>
  );
}

export function CasePatrimoineResume() {
  const { user } = useAuth();
  const { caseId, data, navBase } = useCaseDetail();
  const canWrite = !userIsCaseReadOnly(user, data?.status);
  const [summary, setSummary] = useState<PatrimonySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<PatrimonySummary>(`/cases/${caseId}/patrimony-summary/`)
      .then(setSummary)
      .catch((err) =>
        setError(
          err instanceof ApiError ? err.message : "Impossible de charger le patrimoine.",
        ),
      )
      .finally(() => setLoading(false));
  }, [caseId]);

  const onboardingNotes = useMemo(
    () => patrimonyNotesFromOnboarding(data?.onboarding?.onboarding_data),
    [data?.onboarding?.onboarding_data],
  );

  const localEstimate = useMemo(
    () => (data ? computeCasePatrimonyFromAssets(data.assets) : null),
    [data],
  );

  const eventMetrics = useMemo(() => {
    if (!data) return { totalGains: 0, totalExpenses: 0, netBenefit: 0 };
    return computePatrimonyMetricsFromAssets(data.assets);
  }, [data]);

  if (!data) return null;
  if (loading) return <LoadingState />;
  if (error) return <ErrorAlert message={error} />;

  const activeAssets = data.assets.filter((a) => a.is_active !== false);
  const assetCount = summary?.asset_count ?? activeAssets.length;
  const totalValue = summary?.total_estimated_value ?? localEstimate?.total;
  const currency = summary?.currency ?? localEstimate?.currency ?? "XOF";

  const objectives = summary?.objectives || onboardingNotes.objectives;
  const remarks = summary?.remarks || onboardingNotes.remarks;
  const observations = summary?.observations || onboardingNotes.observations;

  const totalGains =
    summary?.total_gains != null
      ? Number(summary.total_gains)
      : eventMetrics.totalGains;
  const totalExpenses =
    summary?.total_expenses != null
      ? Number(summary.total_expenses)
      : eventMetrics.totalExpenses;
  const netBenefit =
    summary?.net_benefit != null
      ? Number(summary.net_benefit)
      : eventMetrics.netBenefit;

  const estimationDisplay =
    totalValue && Number(totalValue) > 0
      ? formatMoney(totalValue, currency)
      : "Non valorisé";
  const gainsDisplay = formatMoney(String(totalGains), currency);
  const expensesDisplay = formatMoney(String(totalExpenses), currency);
  const benefitDisplay = formatMoney(String(netBenefit), currency);
  const benefitAccent: "positive" | "negative" | "default" =
    netBenefit > 0 ? "positive" : netBenefit < 0 ? "negative" : "default";

  if (activeAssets.length === 0) {
    return (
      <>
        <PatrimoineSubNav caseId={data.id} />
        <EmptyState
          title="Aucun actif pour le moment"
          description="Enregistrez des biens depuis l’assistant d’enregistrement (étape Patrimoine) pour afficher l’estimation, l’évolution et les objectifs."
          action={
            canWrite ? (
              <Link
                href={`${navBase}/enregistrement?step=patrimoine`}
                className="mt-4 inline-flex rounded-lg bg-[var(--sf-green)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--sf-green-deep)]"
              >
                Ajouter un bien
              </Link>
            ) : undefined
          }
        />
      </>
    );
  }

  return (
    <>
      <PatrimoineSubNav caseId={data.id} />
      <div className="space-y-8">
        <PatrimoineSection
          title="Synthèse financière"
          description="Indicateurs consolidés du patrimoine du dossier."
        >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Estimation"
            value={estimationDisplay}
            hint={`${assetCount} actif${assetCount > 1 ? "s" : ""} · valorisations`}
          />
          <MetricCard
            label="CA"
            value={gainsDisplay}
            hint="Gains enregistrés (tous biens)"
          />
          <MetricCard
            label="Dépenses"
            value={expensesDisplay}
            hint="Dépenses fixes et variables"
          />
          <MetricCard
            label="Bénéfice"
            value={benefitDisplay}
            hint="CA − dépenses"
            accent={benefitAccent}
          />
        </div>
        </PatrimoineSection>

        <PatrimoineSection
          title="Contexte et évolution"
          description="Objectifs, observations et courbe patrimoniale globale."
        >
        <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <div className="flex flex-col gap-4 lg:col-span-1">
            <TextSection
              title="Objectifs à atteindre"
              body={objectives}
              emptyHint="Aucun objectif renseigné pour ce dossier."
            />
            <TextSection
              title="Observations"
              body={observations}
              emptyHint="Aucune observation consolidée."
            />
            <TextSection
              title="Remarques"
              body={remarks}
              emptyHint="Aucune remarque pour le moment."
            />
          </div>

          <Card className="flex flex-col p-4 sm:p-6 lg:col-span-2">
            <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
              Diagramme — évolution globale du patrimoine
            </h3>
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
              Courbe unique agrégée : somme des dernières valorisations connues par
              actif à chaque date
            </p>
            <GlobalPatrimoineEvolutionChart
              assets={activeAssets}
              className="mt-4 flex-1 min-h-[12rem] lg:min-h-[16rem]"
            />
          </Card>
        </div>
        </PatrimoineSection>

        <PatrimoineSection
          title="Actifs du dossier"
          description="Accédez au détail de chaque bien via le menu ou la liste ci-dessous."
        >
          <ul className="divide-y divide-[var(--sf-cream-dark)] overflow-hidden rounded-xl border border-[var(--sf-cream-dark)] bg-white">
            {activeAssets.map((asset) => (
              <li key={asset.id}>
                <AssetListRow asset={asset} navBase={navBase} compact />
              </li>
            ))}
          </ul>
        </PatrimoineSection>
      </div>
    </>
  );
}

export function CasePatrimoineAssetDetail({ assetId }: { assetId: string }) {
  const { data } = useCaseDetail();
  const id = Number(assetId);
  const asset = data?.assets.find((a) => a.id === id);

  const financials = useMemo(
    () => (asset ? computeAssetFinancialSummary(asset) : null),
    [asset],
  );

  return (
    <CasePatrimonyAssetShell assetId={assetId}>
      {asset && financials ? (
            <PatrimoineSection
              title="Synthèse de l’exercice"
              description={`Indicateurs calculés sur l’année ${financials.year} et les estimations enregistrées.`}
            >
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  label="Estimation"
                  value={
                    financials.estimationCurrent
                      ? formatMoney(financials.estimationCurrent, financials.currency)
                      : "Non valorisé"
                  }
                  hint={
                    financials.estimationPrevious
                      ? `Précédente : ${formatMoney(
                          financials.estimationPrevious.amount,
                          financials.currency,
                        )} (${formatDate(financials.estimationPrevious.date)})`
                      : "Dernière estimation en cours"
                  }
                />
                <MetricCard
                  label="CA"
                  value={formatMoney(String(financials.caYear), financials.currency)}
                  hint={
                    financials.estimationPrevious
                      ? `Réf. avant estimation actuelle : ${formatMoney(
                          financials.estimationPrevious.amount,
                          financials.currency,
                        )}`
                      : `Total gains · ${financials.year}`
                  }
                />
                <MetricCard
                  label="Dépenses"
                  value={formatMoney(String(financials.expensesYear), financials.currency)}
                  hint={`Année ${financials.year} en cours`}
                />
                <MetricCard
                  label="Bénéfice"
                  value={formatMoney(String(financials.benefitYear), financials.currency)}
                  hint={`CA − dépenses · ${financials.year}`}
                  accent={
                    financials.benefitYear > 0
                      ? "positive"
                      : financials.benefitYear < 0
                        ? "negative"
                        : "default"
                  }
                />
              </div>
            </PatrimoineSection>
      ) : null}

      {asset ? (
        <>
          <PatrimoineSection
            title="Fiche du bien"
            description="Description, suivi des réévaluations et évolution des valorisations."
          >
            <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
              <PatrimoinePanel className="lg:col-span-1">
                <div className="border-b border-[var(--sf-cream-dark)] px-4 py-3">
                  <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                    À propos
                  </h3>
                </div>
                <div className="space-y-4 p-4 sm:p-5">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--sf-green)]/75">
                    {asset.description || "Aucune description renseignée pour ce bien."}
                  </p>
                  <MetaGrid
                    items={[
                      {
                        label: "Réévaluation",
                        value:
                          VALUATION_FREQUENCY_LABELS[asset.valuation_frequency] ??
                          asset.valuation_frequency,
                      },
                      {
                        label: "Prochaine échéance",
                        value: asset.valuation_next_due
                          ? formatDate(asset.valuation_next_due)
                          : "—",
                        warn: asset.valuation_overdue,
                      },
                    ]}
                  />
                </div>
              </PatrimoinePanel>

              <PatrimoinePanel className="flex flex-col lg:col-span-2">
                <div className="border-b border-[var(--sf-cream-dark)] px-4 py-3">
                  <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                    Évolution patrimoniale
                  </h3>
                  <p className="text-xs text-[var(--sf-green)]/50">
                    Historique des valorisations enregistrées
                  </p>
                </div>
                <div className="flex flex-1 flex-col p-4 sm:p-5">
                  <GlobalPatrimoineEvolutionChart
                    assets={[asset]}
                    className="min-h-[14rem] flex-1 lg:min-h-[18rem]"
                  />
                </div>
              </PatrimoinePanel>
            </div>
          </PatrimoineSection>

          {(asset.valuations?.length ?? 0) > 0 || (asset.risks?.length ?? 0) > 0 ? (
            <PatrimoineSection title="Données complémentaires">
              <div className="grid gap-4 lg:grid-cols-2">
                {(asset.valuations?.length ?? 0) > 0 ? (
                  <PatrimoinePanel>
                    <div className="border-b border-[var(--sf-cream-dark)] px-4 py-3">
                      <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                        Valorisations
                      </h3>
                    </div>
                    <ul className="max-h-64 divide-y divide-[var(--sf-cream-dark)] overflow-auto">
                      {[...(asset.valuations ?? [])]
                        .sort((a, b) => b.valued_at.localeCompare(a.valued_at))
                        .map((v) => (
                          <li
                            key={v.id}
                            className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                          >
                            <span className="text-[var(--sf-green)]/70">
                              {formatDate(v.valued_at)}
                              {v.method ? (
                                <span className="block text-xs text-[var(--sf-green)]/45">
                                  {v.method}
                                </span>
                              ) : null}
                            </span>
                            <span className="shrink-0 font-mono font-medium text-emerald-900">
                              {formatMoney(v.value, v.currency)}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </PatrimoinePanel>
                ) : null}

                {(asset.risks?.length ?? 0) > 0 ? (
                  <PatrimoinePanel>
                    <div className="border-b border-[var(--sf-cream-dark)] px-4 py-3">
                      <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
                        Risques identifiés
                      </h3>
                    </div>
                    <ul className="max-h-64 divide-y divide-[var(--sf-cream-dark)] overflow-auto p-2">
                      {asset.risks!.map((r) => (
                        <li key={r.id} className="rounded-lg px-3 py-2.5 text-sm">
                          <p className="font-medium text-[var(--sf-green-deep)]">
                            {r.category}
                            <span className="text-[var(--sf-green)]/45"> · {r.risk_level}</span>
                          </p>
                          <p className="mt-1 text-[var(--sf-green)]/65">{r.description}</p>
                        </li>
                      ))}
                    </ul>
                  </PatrimoinePanel>
                ) : null}
              </div>
            </PatrimoineSection>
          ) : null}
        </>
      ) : null}
    </CasePatrimonyAssetShell>
  );
}

export function CasePatrimoineAssetEvents({
  assetId,
  eventType,
}: {
  assetId: string;
  eventType: AssetEventType;
}) {
  const { data, reload } = useCaseDetail();
  const asset = data?.assets.find((a) => a.id === Number(assetId));

  return (
    <CasePatrimonyAssetShell assetId={assetId}>
      {asset ? (
        <AssetEventsPanel
          assetId={asset.id}
          eventType={eventType}
          events={asset.events ?? []}
          onChanged={() => void reload()}
        />
      ) : null}
    </CasePatrimonyAssetShell>
  );
}
