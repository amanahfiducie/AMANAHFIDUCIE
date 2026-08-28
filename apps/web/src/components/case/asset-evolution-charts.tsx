"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  ASSET_TYPE_LABELS,
  formatDate,
  formatMoney,
  VALUATION_FREQUENCY_LABELS,
} from "@/lib/labels";
import { computePatrimonyMetricsFromAssets } from "@/lib/case-patrimony-metrics";
import type { Asset, AssetEvent } from "@/types/api";

export type EvolutionPeriod = "12m" | "all";

const CHART_W = 640;
const CHART_H = 200;
const PAD_L = 52;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;

const UP_COLOR = "#15803d";
const DOWN_COLOR = "#dc2626";
const GAIN_COLOR = "#059669";
const EXPENSE_COLOR = "#dc2626";

export type DataPoint = { date: string; value: number };

/** Format compact pour l'axe des valeurs : 186 M / 1,2 Md / 850 k. */
function formatCompactValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md`;
  if (abs >= 1e6) return `${(value / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e3) return `${(value / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

function formatMonthTick(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function parseDate(iso: string): number {
  return new Date(iso + "T12:00:00").getTime();
}

function cutoff12MonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 12);
  return d.toISOString().slice(0, 10);
}

export function buildValuationSeries(asset: Asset): DataPoint[] {
  return [...(asset.valuations ?? [])]
    .sort((a, b) => a.valued_at.localeCompare(b.valued_at))
    .map((v) => ({ date: v.valued_at, value: Number(v.value) }))
    .filter((p) => !Number.isNaN(p.value));
}

/** Somme des dernières valorisations connues par actif à chaque date. */
export function buildGlobalPatrimonySeries(assets: Asset[]): DataPoint[] {
  const active = assets.filter((a) => a.is_active !== false);
  const byAsset = new Map<number, DataPoint[]>();
  for (const asset of active) {
    byAsset.set(asset.id, buildValuationSeries(asset));
  }

  const dateSet = new Set<string>();
  for (const series of byAsset.values()) {
    for (const p of series) dateSet.add(p.date);
  }
  const dates = [...dateSet].sort();
  const points: DataPoint[] = [];

  for (const date of dates) {
    let total = 0;
    let any = false;
    for (const asset of active) {
      const series = byAsset.get(asset.id) ?? [];
      let last: number | null = null;
      for (const p of series) {
        if (p.date <= date) last = p.value;
        else break;
      }
      if (last != null) {
        total += last;
        any = true;
      }
    }
    if (any) points.push({ date, value: total });
  }
  return points;
}

function filterSeriesForPeriod(series: DataPoint[], period: EvolutionPeriod): DataPoint[] {
  if (period === "all") return series;
  const cutoff = cutoff12MonthsAgo();
  return series.filter((p) => p.date >= cutoff);
}

/** Au moins deux valorisations distinctes pour tracer une évolution. */
function hasEvolution(points: DataPoint[]): boolean {
  return points.length >= 2;
}

function periodRange(period: EvolutionPeriod, points: DataPoint[]): { minT: number; maxT: number } {
  const today = new Date().toISOString().slice(0, 10);
  const todayT = parseDate(today);

  if (period === "12m") {
    return { minT: parseDate(cutoff12MonthsAgo()), maxT: todayT };
  }

  if (points.length === 0) {
    return { minT: todayT, maxT: todayT };
  }
  return {
    minT: parseDate(points[0].date),
    maxT: parseDate(points[points.length - 1].date),
  };
}

function EvolutionChart({
  points,
  period,
  currency = "XOF",
}: {
  points: DataPoint[];
  period: EvolutionPeriod;
  currency?: string;
}) {
  const { minT, maxT } = periodRange(period, points);
  const timeSpan = maxT - minT || 1;

  const values = points.map((p) => p.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const padding = (maxV - minV) * 0.1 || maxV * 0.02 || 1;
  const yMin = Math.max(0, minV - padding);
  const yMax = maxV + padding;
  const valueSpan = yMax - yMin || 1;

  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;

  const coords = points.map((p) => {
    const t = parseDate(p.date);
    const x = PAD_L + ((t - minT) / timeSpan) * innerW;
    const y = PAD_T + innerH - ((p.value - yMin) / valueSpan) * innerH;
    return { x, y, ...p };
  });

  // Segments colorés : vert si hausse, rouge si baisse
  const segments = coords.slice(1).map((c, i) => {
    const prev = coords[i];
    return {
      x1: prev.x,
      y1: prev.y,
      x2: c.x,
      y2: c.y,
      color: c.value >= prev.value ? UP_COLOR : DOWN_COLOR,
      key: `${prev.date}-${c.date}`,
    };
  });

  const area = [
    `${coords[0].x},${CHART_H - PAD_B}`,
    ...coords.map((c) => `${c.x},${c.y}`),
    `${coords[coords.length - 1].x},${CHART_H - PAD_B}`,
  ].join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const change = last.value - first.value;
  const changePercent = first.value !== 0 ? (change / first.value) * 100 : 0;
  const isUp = change >= 0;

  const yTicks = [0, 1, 2, 3].map((i) => {
    const value = yMin + ((yMax - yMin) * i) / 3;
    return { value, y: PAD_T + innerH - ((value - yMin) / valueSpan) * innerH };
  });
  const xTicks = [minT, minT + timeSpan / 2, maxT];

  const gradId = `spark-${period}-${points[0]?.date ?? "x"}`;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-lg font-semibold tabular-nums text-[var(--sf-green-deep)]">
          {formatMoney(String(last.value), currency)}
        </p>
        <p
          className={`text-xs font-semibold tabular-nums ${
            isUp ? "text-emerald-700" : "text-red-700"
          }`}
        >
          {isUp ? "▲" : "▼"} {isUp ? "+" : ""}
          {formatCompactValue(change)} ({isUp ? "+" : ""}
          {changePercent.toFixed(1)} %) sur la période
        </p>
      </div>
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-40 w-full max-w-full sm:h-48"
        role="img"
        aria-label={
          period === "12m"
            ? "Courbe d'évolution sur les 12 derniers mois"
            : "Courbe d'évolution depuis le début"
        }
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor={isUp ? UP_COLOR : DOWN_COLOR}
              stopOpacity="0.16"
            />
            <stop
              offset="100%"
              stopColor={isUp ? UP_COLOR : DOWN_COLOR}
              stopOpacity="0.02"
            />
          </linearGradient>
        </defs>
        {/* Quadrillage + valeurs de l'axe Y */}
        {yTicks.map((tick, i) => (
          <g key={`y-${i}`}>
            <line
              x1={PAD_L}
              x2={CHART_W - PAD_R}
              y1={tick.y}
              y2={tick.y}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text
              x={PAD_L - 6}
              y={tick.y + 3}
              textAnchor="end"
              className="fill-[var(--sf-green)]/50"
              fontSize="9"
            >
              {formatCompactValue(tick.value)}
            </text>
          </g>
        ))}
        <polygon points={area} fill={`url(#${gradId})`} />
        {segments.map((s) => (
          <line
            key={s.key}
            x1={s.x1}
            y1={s.y1}
            x2={s.x2}
            y2={s.y2}
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ))}
        {coords.map((c, i) => {
          const prev = coords[i - 1];
          const color = !prev
            ? UP_COLOR
            : c.value >= prev.value
              ? UP_COLOR
              : DOWN_COLOR;
          return (
            <circle
              key={`${c.date}-${i}`}
              cx={c.x}
              cy={c.y}
              r="3.5"
              fill={color}
              stroke="white"
              strokeWidth="1.5"
            >
              <title>
                {formatDate(c.date)} : {formatMoney(String(c.value), currency)}
              </title>
            </circle>
          );
        })}
        {/* Valeur au dernier point */}
        {(() => {
          const c = coords[coords.length - 1];
          const nearRightEdge = c.x > CHART_W - PAD_R - 70;
          return (
            <text
              x={nearRightEdge ? c.x - 8 : c.x + 8}
              y={c.y - 8}
              textAnchor={nearRightEdge ? "end" : "start"}
              fill={isUp ? UP_COLOR : DOWN_COLOR}
              fontSize="11"
              fontWeight="700"
            >
              {formatCompactValue(c.value)}
            </text>
          );
        })()}
        {/* Repères de dates */}
        {xTicks.map((ts, i) => (
          <text
            key={`x-${i}`}
            x={PAD_L + ((ts - minT) / timeSpan) * innerW}
            y={CHART_H - 8}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
            className="fill-[var(--sf-green)]/45"
            fontSize="10"
          >
            {formatMonthTick(ts)}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function PeriodFilter({
  value,
  onChange,
}: {
  value: EvolutionPeriod;
  onChange: (v: EvolutionPeriod) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-[var(--sf-cream-dark)] bg-white p-0.5 text-xs"
      role="tablist"
      aria-label="Période d'affichage des courbes"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === "12m"}
        onClick={() => onChange("12m")}
        className={`rounded-md px-3 py-1.5 font-medium transition ${
          value === "12m"
            ? "bg-[var(--sf-green)] text-white shadow-sm"
            : "text-[var(--sf-green)]/65 hover:text-[var(--sf-green-deep)]"
        }`}
      >
        12 derniers mois
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "all"}
        onClick={() => onChange("all")}
        className={`rounded-md px-3 py-1.5 font-medium transition ${
          value === "all"
            ? "bg-[var(--sf-green)] text-white shadow-sm"
            : "text-[var(--sf-green)]/65 hover:text-[var(--sf-green-deep)]"
        }`}
      >
        Depuis le début
      </button>
    </div>
  );
}

function NoEvolutionMessage({ period }: { period: EvolutionPeriod }) {
  return (
    <div className="flex min-h-[7rem] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--sf-cream-dark)] bg-white/60 px-4 py-5 text-center">
      <p className="text-sm font-medium text-[var(--sf-green-deep)]">
        Pas d&apos;évolution pour le moment
      </p>
      <p className="mt-1 max-w-xs text-xs text-[var(--sf-green)]/50">
        {period === "12m"
          ? "Aucune progression sur les 12 derniers mois (il faut au moins deux valorisations sur cette période)."
          : "Il faut au moins deux valorisations enregistrées pour afficher une courbe depuis le début."}
      </p>
    </div>
  );
}

function AssetEvolutionCard({
  asset,
  patrimoineHref,
  period,
}: {
  asset: Asset;
  patrimoineHref: string;
  period: EvolutionPeriod;
}) {
  const allSeries = useMemo(() => buildValuationSeries(asset), [asset]);
  const series = useMemo(
    () => filterSeriesForPeriod(allSeries, period),
    [allSeries, period],
  );
  const latest = allSeries[allSeries.length - 1];
  const freqLabel =
    VALUATION_FREQUENCY_LABELS[asset.valuation_frequency] ?? asset.valuation_frequency;
  const showChart = hasEvolution(series);

  return (
    <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--sf-green-deep)]">
            {asset.label}
          </p>
          <p className="text-xs text-[var(--sf-green)]/50">
            {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
            {latest ? ` · ${formatMoney(String(latest.value), asset.currency)}` : ""}
            {allSeries.length > 0 ? (
              <span className="text-[var(--sf-green)]/40">
                {" "}
                · {allSeries.length} valorisation{allSeries.length > 1 ? "s" : ""}
              </span>
            ) : null}
          </p>
        </div>
        {asset.valuation_next_due ? (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
              asset.valuation_overdue
                ? "bg-red-100 text-red-800"
                : "bg-amber-50 text-amber-900"
            }`}
          >
            {asset.valuation_overdue ? "En retard · " : "Rééval. · "}
            {formatDate(asset.valuation_next_due)}
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        {showChart ? (
          <EvolutionChart points={series} period={period} currency={asset.currency} />
        ) : (
          <NoEvolutionMessage period={period} />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[10px] text-[var(--sf-green)]/45">
        <span>Fréquence : {freqLabel}</span>
        <Link
          href={`${patrimoineHref}/actifs/${asset.id}`}
          className="font-medium text-[var(--sf-green-mid)] hover:underline"
        >
          Voir le bien →
        </Link>
      </div>
    </div>
  );
}

export function GlobalPatrimoineEvolutionChart({
  assets,
  className = "",
}: {
  assets: Asset[];
  className?: string;
}) {
  const [period, setPeriod] = useState<EvolutionPeriod>("12m");
  const allSeries = useMemo(() => buildGlobalPatrimonySeries(assets), [assets]);
  const series = useMemo(
    () => filterSeriesForPeriod(allSeries, period),
    [allSeries, period],
  );
  const showChart = hasEvolution(series);
  const activeAssets = assets.filter((a) => a.is_active !== false);
  const single = activeAssets.length === 1;
  const currency = activeAssets[0]?.currency ?? "XOF";

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        <p className="text-[10px] text-[var(--sf-green)]/45">
          {single
            ? period === "12m"
              ? "Ce bien · 12 mois"
              : "Ce bien · historique"
            : period === "12m"
              ? "Patrimoine total · 12 mois"
              : "Patrimoine total · historique"}
        </p>
      </div>
      <div className="mt-3">
        {showChart ? (
          <EvolutionChart points={series} period={period} currency={currency} />
        ) : (
          <NoEvolutionMessage period={period} />
        )}
      </div>
    </div>
  );
}

export function AssetEvolutionCharts({
  assets,
  caseId,
}: {
  assets: Asset[];
  caseId: number;
}) {
  const [period, setPeriod] = useState<EvolutionPeriod>("12m");
  const patrimoineHref = `/dossiers/${caseId}/patrimoine`;
  const active = assets.filter((a) => a.is_active !== false);

  if (active.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/20 px-4 py-6 text-center">
        <p className="text-sm font-medium text-[var(--sf-green-deep)]">
          Aucun actif pour le moment
        </p>
        <p className="mt-1 text-xs text-[var(--sf-green)]/50">
          Les courbes d&apos;évolution apparaîtront lorsque vous aurez enregistré des actifs
          et plusieurs valorisations dans le temps.
        </p>
        <Link
          href={`/dossiers/${caseId}/enregistrement?step=patrimoine`}
          className="mt-3 inline-flex text-xs font-medium text-[var(--sf-green-mid)] hover:underline"
        >
          Ajouter un actif →
        </Link>
      </div>
    );
  }

  const overdueCount = active.filter((a) => a.valuation_overdue).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        <p className="text-[10px] text-[var(--sf-green)]/45">
          {period === "12m"
            ? "Fenêtre glissante sur 12 mois"
            : "Toutes les valorisations enregistrées"}
        </p>
      </div>

      {overdueCount > 0 ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-900">
          {overdueCount} actif{overdueCount > 1 ? "s" : ""} en attente de réévaluation.
        </p>
      ) : null}

      <div className="space-y-3">
        {active.map((asset) => (
          <AssetEvolutionCard
            key={asset.id}
            asset={asset}
            patrimoineHref={patrimoineHref}
            period={period}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Courbe d'évolution à partir de points API (ex. portail client externe).
 */
export function PatrimonyEvolutionPointsChart({
  points,
  currency = "XOF",
  className = "",
}: {
  points: { date: string; value: string | number }[];
  currency?: string;
  className?: string;
}) {
  const [period, setPeriod] = useState<EvolutionPeriod>("12m");
  const allSeries = useMemo<DataPoint[]>(
    () =>
      points
        .map((p) => ({ date: p.date, value: Number(p.value) }))
        .filter((p) => p.date && !Number.isNaN(p.value))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [points],
  );
  const series = useMemo(
    () => filterSeriesForPeriod(allSeries, period),
    [allSeries, period],
  );
  const showChart = hasEvolution(series);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        <p className="text-[10px] text-[var(--sf-green)]/45">
          {period === "12m"
            ? "Patrimoine total · 12 mois"
            : "Patrimoine total · historique"}
        </p>
      </div>
      <div className="mt-3">
        {showChart ? (
          <EvolutionChart points={series} period={period} currency={currency} />
        ) : (
          <NoEvolutionMessage period={period} />
        )}
      </div>
    </div>
  );
}

export type MonthlyCashflowPoint = {
  month: string;
  gains: number;
  expenses: number;
};

function formatMonthLabel(monthKey: string): string {
  const [y, m] = monthKey.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function buildMonthlyCashflowSeries(
  events: AssetEvent[] | undefined,
  period: EvolutionPeriod,
): MonthlyCashflowPoint[] {
  const cutoffMonth =
    period === "12m" ? cutoff12MonthsAgo().slice(0, 7) : null;
  const byMonth = new Map<string, { gains: number; expenses: number }>();

  for (const event of events ?? []) {
    if (
      event.status !== "ACTIVE" ||
      !event.event_date ||
      !event.amount ||
      (event.event_type !== "GAIN" && event.event_type !== "EXPENSE")
    ) {
      continue;
    }
    const month = event.event_date.slice(0, 7);
    if (cutoffMonth && month < cutoffMonth) continue;
    const amount = Number(event.amount);
    if (Number.isNaN(amount)) continue;
    const bucket = byMonth.get(month) ?? { gains: 0, expenses: 0 };
    if (event.event_type === "GAIN") bucket.gains += amount;
    else bucket.expenses += amount;
    byMonth.set(month, bucket);
  }

  return [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, values]) => ({ month, ...values }));
}

function hasCashflowData(points: MonthlyCashflowPoint[]): boolean {
  return points.some((p) => p.gains > 0 || p.expenses > 0);
}

function NoCashflowMessage({ period }: { period: EvolutionPeriod }) {
  return (
    <div className="flex min-h-[7rem] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--sf-cream-dark)] bg-white/60 px-4 py-5 text-center">
      <p className="text-sm font-medium text-[var(--sf-green-deep)]">
        Aucune recette ni dépense enregistrée
      </p>
      <p className="mt-1 max-w-xs text-xs text-[var(--sf-green)]/50">
        {period === "12m"
          ? "Aucun mouvement sur les 12 derniers mois pour ce bien."
          : "Les courbes apparaîtront lorsque des recettes ou dépenses seront enregistrées."}
      </p>
    </div>
  );
}

function DualCashflowChart({
  points,
  currency = "XOF",
}: {
  points: MonthlyCashflowPoint[];
  currency?: string;
}) {
  const maxValue = Math.max(...points.flatMap((p) => [p.gains, p.expenses]), 1);
  const padding = maxValue * 0.08 || 1;
  const yMax = maxValue + padding;
  const innerW = CHART_W - PAD_L - PAD_R;
  const innerH = CHART_H - PAD_T - PAD_B;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  function coord(index: number, value: number) {
    const x =
      points.length > 1
        ? PAD_L + index * step
        : PAD_L + innerW / 2;
    const y = PAD_T + innerH - (value / yMax) * innerH;
    return { x, y };
  }

  function polyline(values: number[]) {
    return values
      .map((value, index) => {
        const { x, y } = coord(index, value);
        return `${x},${y}`;
      })
      .join(" ");
  }

  const gainCoords = points.map((p, i) => ({ ...coord(i, p.gains), value: p.gains }));
  const expenseCoords = points.map((p, i) => ({
    ...coord(i, p.expenses),
    value: p.expenses,
  }));

  const totalGains = points.reduce((sum, p) => sum + p.gains, 0);
  const totalExpenses = points.reduce((sum, p) => sum + p.expenses, 0);
  const net = totalGains - totalExpenses;

  const yTicks = [0, 1, 2, 3].map((i) => {
    const value = (yMax * i) / 3;
    return { value, y: PAD_T + innerH - (value / yMax) * innerH };
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap gap-4 text-xs">
          <span className="font-semibold text-emerald-700">
            Recettes {formatMoney(String(totalGains), currency)}
          </span>
          <span className="font-semibold text-red-700">
            Dépenses {formatMoney(String(totalExpenses), currency)}
          </span>
          <span
            className={`font-semibold ${net >= 0 ? "text-emerald-800" : "text-red-800"}`}
          >
            Solde {net >= 0 ? "+" : ""}
            {formatMoney(String(net), currency)}
          </span>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap gap-4 text-[10px] text-[var(--sf-green)]/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-[#059669]" />
          Recettes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-[#dc2626]" />
          Dépenses
        </span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-40 w-full max-w-full sm:h-48"
        role="img"
        aria-label="Évolution mensuelle des recettes et dépenses"
      >
        {yTicks.map((tick, i) => (
          <g key={`y-${i}`}>
            <line
              x1={PAD_L}
              x2={CHART_W - PAD_R}
              y1={tick.y}
              y2={tick.y}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text
              x={PAD_L - 6}
              y={tick.y + 3}
              textAnchor="end"
              className="fill-[var(--sf-green)]/50"
              fontSize="9"
            >
              {formatCompactValue(tick.value)}
            </text>
          </g>
        ))}

        {points.length > 1 ? (
          <>
            <polyline
              points={polyline(points.map((p) => p.gains))}
              fill="none"
              stroke={GAIN_COLOR}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={polyline(points.map((p) => p.expenses))}
              fill="none"
              stroke={EXPENSE_COLOR}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : null}

        {gainCoords.map((c, i) => (
          <circle
            key={`gain-${points[i].month}`}
            cx={c.x}
            cy={c.y}
            r="4"
            fill={GAIN_COLOR}
            stroke="white"
            strokeWidth="1.5"
          >
            <title>
              {formatMonthLabel(points[i].month)} — Recettes :{" "}
              {formatMoney(String(c.value), currency)}
            </title>
          </circle>
        ))}
        {expenseCoords.map((c, i) => (
          <circle
            key={`exp-${points[i].month}`}
            cx={c.x}
            cy={c.y}
            r="4"
            fill={EXPENSE_COLOR}
            stroke="white"
            strokeWidth="1.5"
          >
            <title>
              {formatMonthLabel(points[i].month)} — Dépenses :{" "}
              {formatMoney(String(c.value), currency)}
            </title>
          </circle>
        ))}

        {points.map((p, i) => {
          const { x } = coord(i, 0);
          return (
            <text
              key={`x-${p.month}`}
              x={x}
              y={CHART_H - 8}
              textAnchor={
                i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"
              }
              className="fill-[var(--sf-green)]/45"
              fontSize="10"
            >
              {formatMonthLabel(p.month)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function AssetCashflowCard({
  asset,
  period,
  navBase,
}: {
  asset: Asset;
  period: EvolutionPeriod;
  navBase: string;
}) {
  const series = useMemo(
    () => buildMonthlyCashflowSeries(asset.events, period),
    [asset.events, period],
  );
  const showChart = hasCashflowData(series);
  const metrics = useMemo(
    () => computePatrimonyMetricsFromAssets([asset]),
    [asset],
  );

  return (
    <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--sf-green-deep)]">
            {asset.label}
          </p>
          <p className="text-xs text-[var(--sf-green)]/50">
            {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
            {asset.latest_value
              ? ` · ${formatMoney(asset.latest_value, asset.currency)}`
              : ""}
          </p>
        </div>
        {showChart ? (
          <p className="shrink-0 text-[10px] text-[var(--sf-green)]/45">
            {series.length} mois · {metrics.totalGains > 0 || metrics.totalExpenses > 0
              ? "recettes & dépenses"
              : ""}
          </p>
        ) : null}
      </div>

      <div className="mt-3">
        {showChart ? (
          <DualCashflowChart points={series} currency={asset.currency} />
        ) : (
          <NoCashflowMessage period={period} />
        )}
      </div>

      <div className="mt-2 flex justify-end text-[10px] text-[var(--sf-green)]/45">
        <Link
          href={`${navBase}/patrimoine/actifs/${asset.id}`}
          className="font-medium text-[var(--sf-green-mid)] hover:underline"
        >
          Voir le bien →
        </Link>
      </div>
    </div>
  );
}

/** Portail client : une courbe recettes/dépenses par bien. */
export function ClientAssetCashflowCharts({
  assets,
  navBase,
}: {
  assets: Asset[];
  navBase: string;
}) {
  const [period, setPeriod] = useState<EvolutionPeriod>("12m");
  const active = assets.filter((a) => a.is_active !== false);

  if (active.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[var(--sf-cream-dark)] bg-white/60 px-4 py-6 text-center">
        <p className="text-sm font-medium text-[var(--sf-green-deep)]">
          Aucun bien enregistré
        </p>
        <p className="mt-1 text-xs text-[var(--sf-green)]/50">
          Les courbes de recettes et dépenses apparaîtront lorsque des actifs seront
          renseignés dans le dossier.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodFilter value={period} onChange={setPeriod} />
        <p className="text-[10px] text-[var(--sf-green)]/45">
          {period === "12m"
            ? "Recettes et dépenses · 12 mois"
            : "Recettes et dépenses · historique"}
        </p>
      </div>

      <div className="space-y-3">
        {active.map((asset) => (
          <AssetCashflowCard
            key={asset.id}
            asset={asset}
            period={period}
            navBase={navBase}
          />
        ))}
      </div>
    </div>
  );
}
