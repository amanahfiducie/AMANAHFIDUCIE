"use client";

import { formatMoney } from "@/lib/labels";

export type ChartDatum = {
  label: string;
  value: number;
  color?: string;
};

/** Teintes distinctes (pas une échelle monochrome) pour différencier les catégories. */
export const REVENUE_CATEGORY_COLORS = [
  "#0f766e", // teal
  "#1d4ed8", // blue
  "#a16207", // amber
  "#7c3aed", // violet
  "#15803d", // green
  "#0e7490", // cyan
  "#b45309", // orange
  "#4338ca", // indigo
];

export const EXPENSE_CATEGORY_COLORS = [
  "#b91c1c", // red
  "#c2410c", // orange
  "#a16207", // amber
  "#0369a1", // sky
  "#7c3aed", // violet
  "#be185d", // rose
  "#0f766e", // teal
  "#4338ca", // indigo
];

const DEFAULT_REVENUE_COLORS = REVENUE_CATEGORY_COLORS;
const DEFAULT_EXPENSE_COLORS = EXPENSE_CATEGORY_COLORS;

function compactMoney(value: number, currency: string): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  }
  return formatMoney(String(value), currency).replace(/\s?FCFA$/, "");
}

type HorizontalBarChartProps = {
  title: string;
  subtitle?: string;
  data: ChartDatum[];
  currency: string;
  emptyLabel?: string;
  palette?: string[];
};

export function HorizontalBarChart({
  title,
  subtitle,
  data,
  currency,
  emptyLabel = "Aucune donnée sur la période.",
  palette = DEFAULT_REVENUE_COLORS,
}: HorizontalBarChartProps) {
  const filtered = data.filter((d) => d.value > 0);
  const max = Math.max(...filtered.map((d) => d.value), 1);
  const total = filtered.reduce((sum, d) => sum + d.value, 0);

  return (
    <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">{subtitle}</p>
          ) : null}
        </div>
        {total > 0 ? (
          <p className="text-xs font-medium text-[var(--sf-green)]/60">
            Total {formatMoney(String(total), currency)}
          </p>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--sf-green)]/45">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((row, index) => {
            const pct = Math.max(4, (row.value / max) * 100);
            const share = total > 0 ? Math.round((row.value / total) * 100) : 0;
            const color = row.color ?? palette[index % palette.length];
            return (
              <li key={row.label}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="truncate font-medium text-[var(--sf-green-deep)]">
                    {row.label}
                  </span>
                  <span className="shrink-0 tabular-nums text-[var(--sf-green)]/65">
                    {formatMoney(String(row.value), currency)}
                    <span className="ml-1 text-[var(--sf-green)]/40">({share} %)</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-[var(--sf-cream)]/80">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${pct}%`, backgroundColor: color }}
                    role="presentation"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export type MonthlyTrendPoint = {
  label: string;
  revenue: number;
  expense: number;
};

type MonthlyTrendChartProps = {
  title: string;
  subtitle?: string;
  data: MonthlyTrendPoint[];
  currency: string;
};

export function MonthlyTrendChart({
  title,
  subtitle,
  data,
  currency,
}: MonthlyTrendChartProps) {
  const max = Math.max(...data.flatMap((d) => [d.revenue, d.expense]), 1);
  const chartH = 160;
  const chartW = 640;
  const padX = 24;
  const padY = 16;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;
  const step = data.length > 1 ? innerW / (data.length - 1) : innerW;
  const barW = Math.min(18, step * 0.35);

  function y(value: number) {
    return padY + innerH - (value / max) * innerH;
  }

  const hasData = data.some((d) => d.revenue > 0 || d.expense > 0);

  return (
    <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">{subtitle}</p>
        ) : null}
      </div>

      {!hasData ? (
        <p className="py-8 text-center text-sm text-[var(--sf-green)]/45">
          Aucun mouvement approuvé sur l&apos;exercice.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-xs text-[var(--sf-green)]/60">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
              Recettes
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-red-500" />
              Dépenses
            </span>
          </div>
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH + 28}`}
              className="w-full min-w-[480px]"
              role="img"
              aria-label={title}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const yLine = padY + innerH * (1 - t);
                return (
                  <g key={t}>
                    <line
                      x1={padX}
                      x2={chartW - padX}
                      y1={yLine}
                      y2={yLine}
                      stroke="var(--sf-cream-dark)"
                      strokeWidth={1}
                    />
                    <text
                      x={padX - 6}
                      y={yLine + 3}
                      textAnchor="end"
                      className="fill-[var(--sf-green)]/35 text-[9px]"
                    >
                      {compactMoney(max * t, currency)}
                    </text>
                  </g>
                );
              })}
              {data.map((point, index) => {
                const cx = padX + index * step;
                const revH = innerH * (point.revenue / max);
                const expH = innerH * (point.expense / max);
                return (
                  <g key={point.label}>
                    <rect
                      x={cx - barW - 2}
                      y={padY + innerH - revH}
                      width={barW}
                      height={revH || 0}
                      rx={3}
                      fill="#059669"
                      opacity={point.revenue > 0 ? 0.9 : 0}
                    />
                    <rect
                      x={cx + 2}
                      y={padY + innerH - expH}
                      width={barW}
                      height={expH || 0}
                      rx={3}
                      fill="#dc2626"
                      opacity={point.expense > 0 ? 0.85 : 0}
                    />
                    <text
                      x={cx}
                      y={chartH + 18}
                      textAnchor="middle"
                      className="fill-[var(--sf-green)]/55 text-[10px]"
                    >
                      {point.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}
    </section>
  );
}

export type CategoryTrendSeries = {
  label: string;
  values: number[];
};

const TREND_MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

type CategoryTrendChartProps = {
  title: string;
  subtitle?: string;
  series: CategoryTrendSeries[];
  currency: string;
  palette?: string[];
};

export function CategoryTrendChart({
  title,
  subtitle,
  series,
  currency,
  palette = DEFAULT_REVENUE_COLORS,
}: CategoryTrendChartProps) {
  const visible = series.filter((s) => s.values.some((v) => v > 0));
  const max = Math.max(...visible.flatMap((s) => s.values), 1);

  const chartW = 640;
  const chartH = 200;
  const padX = 44;
  const padY = 16;
  const innerW = chartW - padX * 2;
  const innerH = chartH - padY * 2;
  const step = innerW / 11;

  function x(monthIndex: number) {
    return padX + monthIndex * step;
  }
  function y(value: number) {
    return padY + innerH - (value / max) * innerH;
  }

  return (
    <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">{title}</h3>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">{subtitle}</p>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--sf-green)]/45">
          Aucune donnée sur la période.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-[var(--sf-green)]/65">
            {visible.map((s, index) => (
              <span key={s.label} className="inline-flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: palette[index % palette.length] }}
                />
                {s.label}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <svg
              viewBox={`0 0 ${chartW} ${chartH + 24}`}
              className="w-full min-w-[480px]"
              role="img"
              aria-label={title}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((t) => {
                const yLine = padY + innerH * (1 - t);
                return (
                  <g key={t}>
                    <line
                      x1={padX}
                      x2={chartW - padX}
                      y1={yLine}
                      y2={yLine}
                      stroke="var(--sf-cream-dark)"
                      strokeWidth={1}
                    />
                    <text
                      x={padX - 6}
                      y={yLine + 3}
                      textAnchor="end"
                      className="fill-[var(--sf-green)]/35 text-[9px]"
                    >
                      {compactMoney(max * t, currency)}
                    </text>
                  </g>
                );
              })}

              {TREND_MONTH_LABELS.map((label, index) => (
                <text
                  key={label}
                  x={x(index)}
                  y={chartH + 14}
                  textAnchor="middle"
                  className="fill-[var(--sf-green)]/55 text-[10px]"
                >
                  {label}
                </text>
              ))}

              {visible.map((s, index) => {
                const color = palette[index % palette.length];
                const path = s.values
                  .map(
                    (v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`,
                  )
                  .join(" ");
                return (
                  <g key={s.label}>
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {s.values.map((v, i) =>
                      v > 0 ? (
                        <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill={color}>
                          <title>
                            {s.label} — {TREND_MONTH_LABELS[i]} :{" "}
                            {formatMoney(String(v), currency)}
                          </title>
                        </circle>
                      ) : null,
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        </>
      )}
    </section>
  );
}

type ResultGaugeProps = {
  revenue: number;
  expense: number;
  net: number;
  currency: string;
};

export function ResultGauge({ revenue, expense, net, currency }: ResultGaugeProps) {
  const total = revenue + expense || 1;
  const revenuePct = Math.round((revenue / total) * 100);
  const expensePct = 100 - revenuePct;
  const positive = net >= 0;

  return (
    <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">Structure recettes / dépenses</h3>
      <div className="mt-4 flex h-4 overflow-hidden rounded-full">
        <div
          className="bg-emerald-600 transition-all"
          style={{ width: `${revenuePct}%` }}
          title={`Recettes ${revenuePct}%`}
        />
        <div
          className="bg-red-500 transition-all"
          style={{ width: `${expensePct}%` }}
          title={`Dépenses ${expensePct}%`}
        />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--sf-green)]/45">Recettes</p>
          <p className="font-semibold text-emerald-800">{formatMoney(String(revenue), currency)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--sf-green)]/45">Dépenses</p>
          <p className="font-semibold text-red-800">{formatMoney(String(expense), currency)}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[var(--sf-green)]/45">Résultat</p>
          <p className={`font-semibold ${positive ? "text-emerald-800" : "text-red-800"}`}>
            {formatMoney(String(net), currency)}
          </p>
        </div>
      </div>
    </section>
  );
}
