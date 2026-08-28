"use client";

import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

export function PatrimoineSection({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-l-4 border-[var(--sf-green)] pl-4">
        <div>
          <h2 className="text-base font-semibold text-[var(--sf-green-deep)]">{title}</h2>
          {description ? (
            <p className="mt-0.5 max-w-2xl text-sm text-[var(--sf-green)]/55">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  accent,
  compact,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "default" | "positive" | "negative";
  compact?: boolean;
}) {
  const valueClass =
    accent === "positive"
      ? "text-emerald-800"
      : accent === "negative"
        ? "text-red-800"
        : "text-[var(--sf-green-deep)]";

  return (
    <div
      className={`rounded-xl border border-[var(--sf-cream-dark)] bg-white shadow-sm ${
        compact ? "p-3.5" : "p-4 sm:p-5"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--sf-green)]/45">
        {label}
      </p>
      <p
        className={`mt-1.5 font-semibold tracking-tight text-[var(--sf-green-deep)] ${
          compact ? "text-xl" : "text-2xl sm:text-[1.65rem]"
        } ${valueClass}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug text-[var(--sf-green)]/45">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function MetaGrid({
  items,
}: {
  items: { label: string; value: ReactNode; warn?: boolean }[];
}) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-lg bg-[var(--sf-cream)]/35 px-3 py-2.5"
        >
          <dt className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
            {item.label}
          </dt>
          <dd
            className={`mt-1 text-sm font-medium ${
              item.warn ? "text-red-800" : "text-[var(--sf-green-deep)]"
            }`}
          >
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function PatrimoinePanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <Card className={`overflow-hidden border-[var(--sf-cream-dark)] p-0 ${className}`}>
      {children}
    </Card>
  );
}
