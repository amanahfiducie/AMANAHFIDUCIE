"use client";

import type { ReactNode } from "react";

import { useMemo, useState } from "react";

import type { ValuationEvolutionChart } from "@/types/api";
import { formatMoney, formatMoneyNumber } from "@/lib/labels";
import {
  assetClassColor,
  assetClassColorMuted,
  sortAssetClassSlugs,
} from "@/lib/investment-labels";

export type ChartSlice = {
  label: string;
  amount?: string;
  percent: number;
  code?: string;
  color?: string;
};

const SLICE_COLORS = [
  "#1a4d2e", // vert profond
  "#b8860b", // or antique
  "#0e7490", // cyan
  "#9a3412", // cuivre
  "#3f6212", // olive
  "#1d4ed8", // bleu
  "#a16207", // ambre
  "#115e59", // sarcelle
  "#7c2d12", // brun
  "#365314", // vert chartreuse
  "#0369a1", // bleu ciel
  "#854d0e", // bronze
];

export function sliceColor(index: number): string {
  return SLICE_COLORS[index % SLICE_COLORS.length];
}

/** Montant avec unité F CFA en plus petit. */
export function MoneyAmount({
  amount,
  colorClass = "text-emerald-900",
  size = "lg",
}: {
  amount: string;
  colorClass?: string;
  size?: "lg" | "md" | "sm";
}) {
  const num = Number(amount);
  const formatted = formatMoneyNumber(amount);
  const showUnit = !Number.isNaN(num);
  const amountClass =
    size === "lg"
      ? "text-2xl font-semibold"
      : size === "md"
        ? "text-lg font-semibold"
        : "text-sm font-semibold";

  return (
    <span className={`inline-flex items-baseline gap-1 tabular-nums ${colorClass}`}>
      <span className={amountClass}>{formatted}</span>
      {showUnit ? (
        <span className="text-[10px] font-medium tracking-wide opacity-70">F CFA</span>
      ) : null}
    </span>
  );
}

/** Carte KPI — alignée sur le tableau de bord comptable. */
export function DashboardKpi({
  label,
  value,
  moneyAmount,
  hint,
  accent,
}: {
  label: string;
  value?: string;
  moneyAmount?: string;
  hint?: string;
  accent?: "default" | "gold" | "muted";
}) {
  const valueClass =
    accent === "gold"
      ? "text-[var(--sf-gold)]"
      : accent === "muted"
        ? "text-[var(--sf-green)]/70"
        : "text-emerald-900";

  return (
    <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm">
      <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--sf-green)]/55">
        {label}
      </p>
      <div className="mt-1.5">
        {moneyAmount != null ? (
          <MoneyAmount amount={moneyAmount} colorClass={valueClass} size="md" />
        ) : (
          <p className={`text-lg font-semibold tabular-nums ${valueClass}`}>{value}</p>
        )}
      </div>
      {hint ? <p className="mt-1 text-[11px] text-[var(--sf-green)]/50">{hint}</p> : null}
    </div>
  );
}

/** Panneau tableau de bord — titre, sous-titre, contenu. */
export function DashboardPanel({
  title,
  subtitle,
  action,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-sm ${className}`}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/55">{subtitle}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function DonutChart({
  slices,
  size = 200,
  currency = "XOF",
  centerLabel,
  centerHint,
  hideLegend = false,
}: {
  slices: ChartSlice[];
  size?: number;
  currency?: string;
  centerLabel?: string;
  centerHint?: string;
  hideLegend?: boolean;
}) {
  const normalized = useMemo(() => {
    const withAmount = slices.filter(
      (slice) => slice.amount != null && Number(slice.amount) > 0,
    );
    const total = withAmount.reduce(
      (sum, slice) => sum + Number(slice.amount),
      0,
    );
    if (total <= 0) {
      return slices.filter((slice) => slice.percent > 0);
    }
    return withAmount.map((slice) => ({
      ...slice,
      percent: (Number(slice.amount) / total) * 100,
    }));
  }, [slices]);

  const filtered = normalized.filter((slice) => slice.percent > 0);
  const radius = size / 2 - 8;
  const innerRadius = radius * 0.55;
  const cx = size / 2;
  const cy = size / 2;
  const isFullRing = filtered.length === 1;

  const arcs = useMemo(() => {
    function resolveColor(slice: ChartSlice, index: number): string {
      if (slice.color) return slice.color;
      if (slice.code) return assetClassColor(slice.code, index);
      return sliceColor(index);
    }

    if (isFullRing) {
      const slice = filtered[0];
      return [
        {
          path: "",
          fullRing: true,
          color: resolveColor(slice, 0),
          slice,
        },
      ];
    }

    let startAngle = -Math.PI / 2;
    return filtered.map((slice, index) => {
      const angle = (slice.percent / 100) * Math.PI * 2;
      const endAngle = startAngle + angle;
      const largeArc = angle > Math.PI ? 1 : 0;

      const x1 = cx + radius * Math.cos(startAngle);
      const y1 = cy + radius * Math.sin(startAngle);
      const x2 = cx + radius * Math.cos(endAngle);
      const y2 = cy + radius * Math.sin(endAngle);
      const ix1 = cx + innerRadius * Math.cos(endAngle);
      const iy1 = cy + innerRadius * Math.sin(endAngle);
      const ix2 = cx + innerRadius * Math.cos(startAngle);
      const iy2 = cy + innerRadius * Math.sin(startAngle);

      const path = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix1} ${iy1}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix2} ${iy2}`,
        "Z",
      ].join(" ");

      startAngle = endAngle;
      return { path, fullRing: false, color: resolveColor(slice, index), slice };
    });
  }, [filtered, cx, cy, radius, innerRadius, isFullRing]);

  if (filtered.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-[var(--sf-green)]/45">
        Aucune donnée à afficher
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="relative shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((arc, i) =>
            arc.fullRing ? (
              <g key={i}>
                <circle cx={cx} cy={cy} r={radius} fill={arc.color} />
                <circle cx={cx} cy={cy} r={innerRadius} fill="#fff" />
                <title>
                  {arc.slice.label}: {arc.slice.percent.toFixed(1)} %
                  {arc.slice.amount
                    ? ` (${formatMoney(arc.slice.amount, currency)})`
                    : ""}
                </title>
              </g>
            ) : (
              <path
                key={i}
                d={arc.path}
                fill={arc.color}
                stroke="#fff"
                strokeWidth="1.5"
              >
                <title>
                  {arc.slice.label}: {arc.slice.percent.toFixed(1)} %
                  {arc.slice.amount
                    ? ` (${formatMoney(arc.slice.amount, currency)})`
                    : ""}
                </title>
              </path>
            ),
          )}
        </svg>
        {centerLabel ? (
          <div
            className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
            aria-hidden
          >
            {centerHint ? (
              <span className="text-[10px] uppercase tracking-wide text-[var(--sf-green)]/45">
                {centerHint}
              </span>
            ) : null}
            {(() => {
              // Sépare le montant de la devise pour l'afficher sur deux lignes
              const match = centerLabel.match(/^([\d\s\u00A0\u202F.,-]+)\s*(\D.*)$/);
              if (match) {
                return (
                  <>
                    <span className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--sf-green-deep)]">
                      {match[1].trim()}
                    </span>
                    <span className="text-[11px] font-medium text-[var(--sf-green)]/60">
                      {match[2].trim()}
                    </span>
                  </>
                );
              }
              return (
                <span className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--sf-green-deep)]">
                  {centerLabel}
                </span>
              );
            })()}
          </div>
        ) : null}
      </div>
      {hideLegend ? null : (
        <ul className="min-w-0 flex-1 space-y-2.5 text-xs">
          {filtered.map((slice, index) => (
            <li key={slice.code ?? slice.label} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{
                  backgroundColor:
                    slice.color
                    ?? (slice.code
                      ? assetClassColor(slice.code, index)
                      : sliceColor(index)),
                }}
              />
              <span className="min-w-0 flex-1 truncate font-medium text-[var(--sf-green-deep)]">
                {slice.label}
              </span>
              <span className="shrink-0 text-right tabular-nums text-[var(--sf-green)]/65">
                {slice.amount ? (
                  <>
                    {formatMoney(slice.amount, currency)}
                    <span className="ml-1 text-[var(--sf-green)]/45">
                      ({slice.percent.toFixed(1)} %)
                    </span>
                  </>
                ) : (
                  `${slice.percent.toFixed(1)} %`
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export type AllocationSegment = {
  slug: string;
  label: string;
  /** Part cible de l'enveloppe (%) */
  target: number;
  /** Montant cible (XOF) */
  targetAmount: number;
  /** Montant déjà investi dans cette classe (XOF) */
  investedAmount: number;
  /** Montant restant à investir pour atteindre la cible (XOF) */
  remainingAmount: number;
};

/** Une ligne par classe d'actif : investi vs reste (montant + %). */
export function AllocationStackedBar({
  segments,
  currency = "XOF",
}: {
  segments: AllocationSegment[];
  currency?: string;
}) {
  const ordered = useMemo(() => {
    const filtered = segments.filter(
      (s) => s.target > 0 || s.investedAmount > 0,
    );
    const bySlug = new Map(filtered.map((s) => [s.slug, s]));
    return sortAssetClassSlugs(filtered.map((s) => s.slug))
      .map((slug) => bySlug.get(slug))
      .filter((s): s is AllocationSegment => s != null);
  }, [segments]);

  if (ordered.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--sf-green)]/45">
        Aucune allocation cible définie
      </p>
    );
  }

  return (
    <ul className="space-y-4" aria-label="Allocation par classe d'actif">
      {ordered.map((seg) => {
        const color = assetClassColor(seg.slug);
        const muted = assetClassColorMuted(seg.slug);
        const investedPctOfTarget =
          seg.targetAmount > 0
            ? Math.min((seg.investedAmount / seg.targetAmount) * 100, 100)
            : seg.investedAmount > 0
              ? 100
              : 0;
        const remainingPctOfTarget =
          seg.targetAmount > 0
            ? Math.max(
                100 - (seg.investedAmount / seg.targetAmount) * 100,
                0,
              )
            : 0;
        const barFill = Math.min(Math.max(investedPctOfTarget, 0), 100);
        const overInvested =
          seg.targetAmount > 0 && seg.investedAmount > seg.targetAmount;

        return (
          <li
            key={seg.slug}
            className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/20 px-3.5 py-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-sm font-semibold text-[var(--sf-green-deep)]">
                  {seg.label}
                </span>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-[var(--sf-green)]/55">
                Cible {seg.target.toFixed(0)} %
                {seg.targetAmount > 0 ? (
                  <>
                    {" · "}
                    {formatMoney(String(seg.targetAmount), currency)}
                  </>
                ) : null}
              </span>
            </div>

            <div
              className="mt-2.5 flex h-2.5 w-full overflow-hidden rounded-full"
              role="img"
              aria-label={`${seg.label} : ${investedPctOfTarget.toFixed(1)} % investi`}
              style={{ backgroundColor: muted }}
            >
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${barFill}%`,
                  backgroundColor: color,
                  boxShadow: overInvested ? `inset 0 0 0 1px ${color}` : undefined,
                }}
              />
            </div>

            <div className="mt-2.5 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="flex items-center gap-1.5 text-[var(--sf-green)]/50">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  Investi
                </p>
                <p className="mt-0.5 font-medium tabular-nums" style={{ color }}>
                  {formatMoney(String(seg.investedAmount), currency)}
                </p>
                <p className="tabular-nums text-[var(--sf-green)]/55">
                  {investedPctOfTarget.toFixed(1)} %
                  {overInvested ? " (au-delà)" : " de la cible"}
                </p>
              </div>
              <div className="text-right">
                <p className="flex items-center justify-end gap-1.5 text-[var(--sf-green)]/50">
                  Reste à investir
                  <span
                    className="inline-block h-1.5 w-3 rounded-sm"
                    style={{ backgroundColor: muted }}
                  />
                </p>
                <p className="mt-0.5 font-medium tabular-nums text-[var(--sf-green-deep)]">
                  {formatMoney(String(seg.remainingAmount), currency)}
                </p>
                <p className="tabular-nums text-[var(--sf-green)]/55">
                  {remainingPctOfTarget.toFixed(1)} % de la cible
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SemiCircleGauge({
  investedPercent,
  investedAmount,
  availableAmount,
  currency = "XOF",
}: {
  investedPercent: number;
  investedAmount: string;
  availableAmount: string;
  currency?: string;
}) {
  const pct = Math.min(Math.max(investedPercent, 0), 100);
  const width = 280;
  const height = 150;
  const cx = width / 2;
  const cy = height - 10;
  const radius = 110;
  const startAngle = Math.PI;
  const endAngle = 0;
  const investedAngle = startAngle - (pct / 100) * Math.PI;

  const bgPath = describeArc(cx, cy, radius, startAngle, endAngle);
  const fgPath = describeArc(cx, cy, radius, startAngle, investedAngle);

  return (
    <div className="space-y-4">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto">
        <path d={bgPath} fill="none" stroke="#e8efe9" strokeWidth="18" strokeLinecap="round" />
        <path d={fgPath} fill="none" stroke="#1a4d2e" strokeWidth="18" strokeLinecap="round" />
        <text
          x={cx}
          y={cy - 18}
          textAnchor="middle"
          className="fill-emerald-900 text-2xl font-semibold"
        >
          {pct.toFixed(0)} %
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" className="fill-[#1a2e1f]/55 text-xs">
          investi
        </text>
      </svg>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="rounded-lg bg-emerald-50 px-3 py-2.5">
          <p className="text-[var(--sf-green)]/55">Investi</p>
          <p className="mt-0.5 font-semibold tabular-nums text-emerald-900">
            {formatMoney(investedAmount, currency)}
          </p>
        </div>
        <div className="rounded-lg bg-[var(--sf-cream)]/50 px-3 py-2.5">
          <p className="text-[var(--sf-green)]/55">Disponible (estim.)</p>
          <p className="mt-0.5 font-semibold tabular-nums text-[var(--sf-green-deep)]">
            {formatMoney(availableAmount, currency)}
          </p>
        </div>
      </div>
    </div>
  );
}

function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
): string {
  // Axe Y inversé en SVG : on soustrait le sinus pour dessiner sur la moitié haute.
  const x1 = cx + radius * Math.cos(startAngle);
  const y1 = cy - radius * Math.sin(startAngle);
  const x2 = cx + radius * Math.cos(endAngle);
  const y2 = cy - radius * Math.sin(endAngle);
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const sweep = endAngle < startAngle ? 1 : 0;
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} ${sweep} ${x2} ${y2}`;
}

export type EvolutionPoint = { date: string; value: string | number; label?: string };

export type EvolutionSeries = {
  slug: string;
  label: string;
  points: EvolutionPoint[];
};

/** Format compact pour les axes : 166,2 M / 1,2 Md / 850 k. */
function formatCompactValue(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md`;
  if (abs >= 1e6) return `${(value / 1e6).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  if (abs >= 1e3) return `${(value / 1e3).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  return value.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

/** Reconstruit la courbe « Ensemble » comme somme des catégories (avec report). */
export function buildGeneralSeriesFromCategories(
  categorySeries: EvolutionSeries[],
): EvolutionSeries | null {
  const categories = categorySeries.filter((s) => s.slug !== "general" && s.points.length > 0);
  if (categories.length === 0) return null;

  const allDates = Array.from(
    new Set(categories.flatMap((s) => s.points.map((p) => p.date))),
  ).sort();

  const bySlug = new Map(
    categories.map((s) => [
      s.slug,
      new Map(s.points.map((p) => [p.date, Number(p.value)])),
    ]),
  );
  const lastKnown = new Map(categories.map((s) => [s.slug, 0]));

  const points: EvolutionPoint[] = allDates.map((date) => {
    let total = 0;
    for (const [slug, values] of bySlug) {
      if (values.has(date)) {
        lastKnown.set(slug, values.get(date) ?? 0);
      }
      total += lastKnown.get(slug) ?? 0;
    }
    return {
      date,
      value: String(total),
      label: "Somme des catégories",
    };
  });

  return {
    slug: "general",
    label: "Ensemble du patrimoine",
    points,
  };
}

export function PatrimonyEvolutionChart({
  series,
  assetClassFilter = "",
  onAssetClassFilterChange,
  assetClasses,
  currency = "XOF",
}: {
  series: EvolutionSeries[];
  assetClassFilter?: string;
  onAssetClassFilterChange?: (slug: string) => void;
  assetClasses?: { slug: string; label: string }[];
  currency?: string;
}) {
  const visibleSeries = useMemo(() => {
    if (!assetClassFilter) return series;
    const categories = series.filter((s) => s.slug === assetClassFilter);
    const general = buildGeneralSeriesFromCategories(categories);
    return general ? [...categories, general] : categories;
  }, [series, assetClassFilter]);

  const width = 640;
  const height = 220;
  const padL = 52;
  const padR = 8;
  const padT = 16;
  const padB = 32;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const filterControl =
    assetClasses && assetClasses.length > 0 ? (
      <label className="flex items-center gap-2 text-xs">
        <span className="text-[var(--sf-green)]/55">Classe d&apos;actif</span>
        <select
          value={assetClassFilter}
          onChange={(e) => onAssetClassFilterChange?.(e.target.value)}
          className="rounded-md border border-[var(--sf-cream-dark)] bg-white px-2 py-1.5 text-xs text-[var(--sf-green-deep)]"
        >
          <option value="">Toutes les classes</option>
          {assetClasses.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  const chart = useMemo(() => {
    const plotted = visibleSeries
      .map((item, seriesIndex) => {
        const numericPoints = item.points
          .map((p) => ({
            ...p,
            value: Number(p.value),
            ts: Date.parse(p.date),
          }))
          .filter((p) => !Number.isNaN(p.value) && !Number.isNaN(p.ts))
          .sort((a, b) => a.ts - b.ts);
        if (numericPoints.length === 0) return null;
        const isGeneral = item.slug === "general";
        const color = isGeneral
          ? "#0f172a"
          : assetClassColor(item.slug, seriesIndex);
        return { ...item, numericPoints, color, isGeneral };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);

    const canDrawLine = plotted.some((s) => s.numericPoints.length >= 2);
    if (!canDrawLine) return null;

    const allValues = plotted.flatMap((s) => s.numericPoints.map((p) => p.value));
    const allTs = plotted.flatMap((s) => s.numericPoints.map((p) => p.ts));
    const minV = Math.min(...allValues);
    const maxV = Math.max(...allValues);
    const padding = (maxV - minV) * 0.08 || maxV * 0.02 || 1;
    const yMin = Math.max(0, minV - padding);
    const yMax = maxV + padding;
    const spanV = yMax - yMin || 1;
    const windowStart = Math.min(...allTs);
    const windowEnd = Math.max(...allTs);
    const spanMs = Math.max(windowEnd - windowStart, 1);

    const xAt = (ts: number) => padL + ((ts - windowStart) / spanMs) * innerW;
    const yAt = (value: number) => padT + innerH - ((value - yMin) / spanV) * innerH;

    const paths = plotted.map((s) => {
      const coords = s.numericPoints.map((p) => ({
        x: xAt(p.ts),
        y: yAt(p.value),
        ...p,
      }));
      const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`).join(" ");
      return { ...s, coords, linePath };
    });

    // Ticks de dates (début / milieu / fin)
    const tickDates = [windowStart, windowStart + spanMs / 2, windowEnd];
    const formatTick = (ts: number) => {
      const d = new Date(ts);
      return d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    };

    // Repères de valeurs (axe Y)
    const yTicks = [0, 1, 2, 3].map((i) => {
      const value = yMin + ((yMax - yMin) * i) / 3;
      return { value, y: yAt(value) };
    });

    const general = paths.find((s) => s.isGeneral);
    const endValue = general
      ? general.coords[general.coords.length - 1]?.value
      : paths[0]?.coords[paths[0].coords.length - 1]?.value;

    return { paths, tickDates, formatTick, yTicks, endValue, windowStart, windowEnd };
  }, [visibleSeries, innerW, innerH]);

  if (!chart) {
    return (
      <div className="space-y-3">
        {filterControl}
        <p className="py-10 text-center text-sm text-[var(--sf-green)]/45">
          Pas assez d&apos;estimations pour tracer l&apos;évolution
        </p>
      </div>
    );
  }

  const { paths, tickDates, formatTick, yTicks, endValue } = chart;
  // Dessiner les catégories d'abord, la courbe générale par-dessus
  const orderedPaths = [
    ...paths.filter((s) => !s.isGeneral),
    ...paths.filter((s) => s.isGeneral),
  ];

  return (
    <div className="space-y-3">
      {filterControl}
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} className="max-w-full">
        {/* Quadrillage + valeurs de l'axe Y */}
        {yTicks.map((tick, i) => (
          <g key={`y-${i}`}>
            <line
              x1={padL}
              x2={width - padR}
              y1={tick.y}
              y2={tick.y}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text
              x={padL - 6}
              y={tick.y + 3}
              textAnchor="end"
              className="fill-[var(--sf-green)]/50"
              fontSize="9"
            >
              {formatCompactValue(tick.value)}
            </text>
          </g>
        ))}
        {orderedPaths.map((s) =>
          s.coords.length >= 2 ? (
            <path
              key={s.slug}
              d={s.linePath}
              fill="none"
              stroke={s.color}
              strokeWidth={s.isGeneral ? 3 : 2}
              opacity={s.isGeneral ? 1 : 0.85}
            />
          ) : null,
        )}
        {orderedPaths.map((s) =>
          s.coords.map((c, i) => (
            <circle
              key={`${s.slug}-${i}`}
              cx={c.x}
              cy={c.y}
              r={s.isGeneral ? 3.5 : 2.5}
              fill={s.color}
            >
              <title>
                {s.label} — {c.label ?? c.date}: {formatMoney(String(c.value), currency)}
              </title>
            </circle>
          )),
        )}
        {/* Valeur au bout de chaque courbe */}
        {orderedPaths.map((s) => {
          const last = s.coords[s.coords.length - 1];
          if (!last) return null;
          const nearRightEdge = last.x > width - padR - 60;
          return (
            <text
              key={`end-${s.slug}`}
              x={nearRightEdge ? last.x - 6 : last.x + 6}
              y={last.y - 6}
              textAnchor={nearRightEdge ? "end" : "start"}
              fill={s.color}
              fontSize={s.isGeneral ? "11" : "9"}
              fontWeight={s.isGeneral ? "700" : "500"}
            >
              {formatCompactValue(last.value)}
            </text>
          );
        })}
        {tickDates.map((ts, i) => (
          <text
            key={`tick-${i}`}
            x={padL + ((ts - chart.windowStart) / Math.max(chart.windowEnd - chart.windowStart, 1)) * innerW}
            y={height - 8}
            textAnchor={i === 0 ? "start" : i === tickDates.length - 1 ? "end" : "middle"}
            className="fill-[var(--sf-green)]/45"
            fontSize="10"
          >
            {formatTick(ts)}
          </text>
        ))}
      </svg>
      {/* Légende avec la dernière valeur de chaque courbe */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[var(--sf-green)]/60">
        {orderedPaths.map((s) => {
          const last = s.coords[s.coords.length - 1];
          return (
            <li key={s.slug} className="flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: s.color }}
              />
              <span className={s.isGeneral ? "font-semibold text-[var(--sf-green-deep)]" : ""}>
                {s.label}
              </span>
              {last ? (
                <span
                  className={`tabular-nums ${
                    s.isGeneral
                      ? "font-semibold text-[var(--sf-green-deep)]"
                      : "text-[var(--sf-green)]/75"
                  }`}
                >
                  · {formatMoney(String(last.value), currency)}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      {endValue != null ? (
        <p className="text-right text-[10px] font-medium tabular-nums text-emerald-900">
          Dernière valeur ensemble : {formatMoney(String(endValue), currency)}
        </p>
      ) : null}
    </div>
  );
}

/** Courbe d'évolution sur 12 mois — relie les dates d'estimation. */
export function InvestmentValuationChart({
  data,
  currency = "XOF",
}: {
  data?: ValuationEvolutionChart | null;
  currency?: string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    if (!data?.points?.length) return null;

    const windowStart = parseChartDate(data.window_start);
    const windowEnd = parseChartDate(data.window_end);
    const spanMs = Math.max(windowEnd - windowStart, 1);

    const rawPoints = data.points
      .map((p) => ({
        ...p,
        value: Number(p.value),
        ts: parseChartDate(p.date),
      }))
      .filter((p) => !Number.isNaN(p.value) && !Number.isNaN(p.ts))
      .sort((a, b) => a.ts - b.ts);

    if (rawPoints.length === 0) return null;

    const width = 640;
    const height = 220;
    const padL = 56;
    const padR = 16;
    const padT = 20;
    const padB = 36;
    const innerW = width - padL - padR;
    const innerH = height - padT - padB;

    const xAt = (ts: number) => padL + ((ts - windowStart) / spanMs) * innerW;

    const values = rawPoints.map((p) => p.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    const padding = (maxV - minV) * 0.08 || maxV * 0.02 || 1;
    const yMin = minV - padding;
    const yMax = maxV + padding;
    const spanV = yMax - yMin || 1;

    const yAt = (value: number) => padT + innerH - ((value - yMin) / spanV) * innerH;

    const coords = rawPoints.map((p) => ({
      x: xAt(p.ts),
      y: yAt(p.value),
      date: p.date,
      value: p.value,
      label: p.label,
    }));

    const linePath = coords
      .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x} ${c.y}`)
      .join(" ");

    const areaPath =
      coords.length >= 2
        ? `${linePath} L ${coords[coords.length - 1].x} ${padT + innerH} L ${coords[0].x} ${
            padT + innerH
          } Z`
        : "";

    const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
      const value = yMin + spanV * (1 - ratio);
      const y = padT + innerH * ratio;
      return { y, value };
    });

    const monthTicks: Array<{ x: number; label: string }> = [];
    const cursor = new Date(data.window_start + "T12:00:00");
    const end = new Date(data.window_end + "T12:00:00");
    cursor.setDate(1);
    while (cursor <= end) {
      const ts = cursor.getTime();
      if (ts >= windowStart && ts <= windowEnd) {
        monthTicks.push({
          x: xAt(ts),
          label: cursor.toLocaleDateString("fr-FR", {
            month: "short",
            year: "2-digit",
          }),
        });
      }
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const markers = coords;

    const segments = coords.slice(1).map((point, index) => {
      const from = coords[index];
      return {
        path: `M ${from.x} ${from.y} L ${point.x} ${point.y}`,
        isUp: point.value >= from.value,
      };
    });

    const isUp = rawPoints[rawPoints.length - 1].value >= rawPoints[0].value;

    return {
      width,
      height,
      padL,
      padT,
      innerW,
      innerH,
      linePath,
      areaPath,
      gridLines,
      monthTicks,
      markers,
      coords,
      segments,
      isUp,
    };
  }, [data]);

  if (!data) {
    return (
      <p className="py-10 text-center text-sm text-[var(--sf-green)]/45">
        Aucune donnée d&apos;évolution.
      </p>
    );
  }

  const change = Number(data.change_percent);
  const isUp = chart?.isUp ?? change >= 0;
  const trendColor = isUp ? "#059669" : "#dc2626";
  const trendTextClass = isUp ? "text-emerald-700" : "text-red-700";
  const areaGradientId = isUp ? "valuation-area-fill-up" : "valuation-area-fill-down";
  const active =
    hoverIndex !== null && chart?.markers[hoverIndex]
      ? chart.markers[hoverIndex]
      : chart?.markers[chart.markers.length - 1];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--sf-cream-dark)] pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
            {data.from_activity_start
              ? "Évolution depuis le début"
              : `Valeur sur ${data.window_months} mois`}
          </p>
          <p className={`mt-1 text-2xl font-semibold tabular-nums ${trendTextClass}`}>
            {formatMoney(active ? String(active.value) : data.end_value, currency)}
          </p>
          {active ? (
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">
              {formatChartDate(active.date)}
              {active.label ? ` · ${active.label}` : ""}
            </p>
          ) : null}
        </div>
        <div className="text-right">
          <span
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${
              isUp
                ? "bg-emerald-50 text-emerald-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {isUp ? "+" : ""}
            {change.toLocaleString("fr-FR", {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
            %
          </span>
          <p className="mt-1 text-[10px] text-[var(--sf-green)]/45">
            {formatChartDate(data.window_start)} → {formatChartDate(data.window_end)}
          </p>
        </div>
      </div>

      {!chart ? (
        <p className="py-10 text-center text-sm text-[var(--sf-green)]/45">
          Aucune estimation sur les 12 derniers mois.
        </p>
      ) : chart.coords.length === 1 ? (
        <div className="space-y-4 py-2">
          <div className="flex justify-center">
            <svg width="100%" viewBox={`0 0 ${chart.width} ${chart.height}`} className="max-w-full">
              <circle
                cx={chart.padL + chart.innerW / 2}
                cy={chart.padT + chart.innerH / 2}
                r="6"
                fill={trendColor}
                stroke="white"
                strokeWidth="2"
              />
            </svg>
          </div>
          <p className="text-center text-xs text-[var(--sf-green)]/45">
            Enregistrez une deuxième estimation pour tracer la courbe d&apos;évolution.
          </p>
        </div>
      ) : (
        <div className="relative">
          <svg
            width="100%"
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            className="max-w-full"
            role="img"
            aria-label="Évolution de la valeur sur 12 mois"
          >
            <defs>
              <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trendColor} stopOpacity="0.22" />
                <stop offset="100%" stopColor={trendColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>

            {chart.gridLines.map((line) => (
              <g key={line.y}>
                <line
                  x1={chart.padL}
                  y1={line.y}
                  x2={chart.padL + chart.innerW}
                  y2={line.y}
                  stroke="var(--sf-cream-dark)"
                  strokeWidth="1"
                />
                <text
                  x={chart.padL - 8}
                  y={line.y + 4}
                  textAnchor="end"
                  className="fill-[var(--sf-green)]/40"
                  fontSize="9"
                >
                  {formatCompactMoney(line.value, currency)}
                </text>
              </g>
            ))}

            <path d={chart.areaPath} fill={`url(#${areaGradientId})`} />
            {chart.segments.length > 0 ? (
              chart.segments.map((segment, index) => (
                <path
                  key={`segment-${index}`}
                  d={segment.path}
                  fill="none"
                  stroke={segment.isUp ? "#059669" : "#dc2626"}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))
            ) : (
              <path
                d={chart.linePath}
                fill="none"
                stroke={trendColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {chart.monthTicks.map((tick) => (
              <g key={tick.label + tick.x}>
                <line
                  x1={tick.x}
                  y1={chart.padT + chart.innerH}
                  x2={tick.x}
                  y2={chart.padT + chart.innerH + 4}
                  stroke="var(--sf-cream-dark)"
                  strokeWidth="1"
                />
                <text
                  x={tick.x}
                  y={chart.height - 10}
                  textAnchor="middle"
                  className="fill-[var(--sf-green)]/45"
                  fontSize="9"
                >
                  {tick.label}
                </text>
              </g>
            ))}

            {chart.markers.map((marker, index) => {
              const segmentUp =
                index === 0
                  ? isUp
                  : marker.value >= chart.markers[index - 1].value;
              const markerColor = segmentUp ? "#059669" : "#dc2626";

              return (
              <g key={`${marker.date}-${index}`}>
                {hoverIndex === index ? (
                  <line
                    x1={marker.x}
                    y1={chart.padT}
                    x2={marker.x}
                    y2={chart.padT + chart.innerH}
                    stroke={markerColor}
                    strokeWidth="1"
                    strokeDasharray="3 3"
                    opacity="0.35"
                  />
                ) : null}
                <circle
                  cx={marker.x}
                  cy={marker.y}
                  r={hoverIndex === index ? 5 : 3.5}
                  fill={hoverIndex === index ? "white" : markerColor}
                  stroke={markerColor}
                  strokeWidth="2"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoverIndex(index)}
                  onMouseLeave={() => setHoverIndex(null)}
                >
                  <title>
                    {marker.label ?? "Valeur"} — {formatChartDate(marker.date)}:{" "}
                    {formatMoney(String(marker.value), currency)}
                  </title>
                </circle>
              </g>
            );
            })}
          </svg>
        </div>
      )}
    </div>
  );
}

function parseChartDate(iso: string): number {
  return new Date(`${iso}T12:00:00`).getTime();
}

function formatChartDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    month: "short",
    year: "2-digit",
  });
}

function formatCompactMoney(value: number, currency: string): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md`;
  }
  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} M`;
  }
  if (abs >= 1_000) {
    return `${(value / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k`;
  }
  return formatMoney(String(value), currency);
}
