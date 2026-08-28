"use client";

import { useEffect, useId, useRef, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import { CASE_TYPE_LABELS } from "@/lib/labels";
import { usePortalCases } from "@/providers/portal-cases-provider";

type SwitcherVariant = "header" | "sidebar" | "banner";

function SwapIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 3h5v5" />
      <path d="M8 21H3v-5" />
      <path d="M21 3 14 10" />
      <path d="M3 21l7-7" />
    </svg>
  );
}

/**
 * Sélecteur de dossier pour les clients externes liés à plusieurs dossiers.
 */
export function PortalCaseSwitcher({
  variant = "header",
}: {
  variant?: SwitcherVariant;
}) {
  const { cases, activeCase, selectCase, loading } = usePortalCases();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (loading || cases.length === 0) return null;

  const multi = cases.length > 1;
  const isSidebar = variant === "sidebar";
  const isBanner = variant === "banner";

  if (!multi) {
    const only = cases[0];
    if (isSidebar) {
      return (
        <div className="rounded-xl border border-white/15 bg-white/8 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
            Dossier actif
          </p>
          <p className="mt-0.5 font-mono text-xs text-[var(--sf-gold)]">{only.reference}</p>
          <p className="mt-0.5 truncate text-sm font-medium text-white">{only.title}</p>
        </div>
      );
    }
    return (
      <div className="flex min-w-0 max-w-[min(320px,50vw)] items-center gap-2 rounded-xl border border-[var(--sf-cream-dark)] bg-white px-3 py-1.5">
        <span className="truncate font-mono text-xs text-[var(--sf-green-mid)]">
          {only.reference}
        </span>
        <span className="truncate text-xs text-[var(--sf-green)]/50">{only.title}</span>
      </div>
    );
  }

  const label = activeCase
    ? `${activeCase.reference} — ${activeCase.title}`
    : "Choisir un dossier";

  const triggerClass = isSidebar
    ? "flex w-full items-center gap-2.5 rounded-xl border-2 border-[var(--sf-gold)]/70 bg-white/10 px-3 py-2.5 text-left shadow-[0_0_0_1px_rgba(255,255,255,0.06)] transition hover:border-[var(--sf-gold)] hover:bg-white/14 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-gold)]/50"
    : isBanner
      ? "flex w-full max-w-3xl items-center gap-3 rounded-xl border-2 border-[var(--sf-gold)] bg-white px-4 py-3 text-left shadow-md transition hover:border-[var(--sf-green)]/35 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-green-mid)]/40"
      : "flex min-w-[min(280px,42vw)] items-center gap-2 rounded-xl border-2 border-[var(--sf-gold)] bg-gradient-to-r from-[var(--sf-cream)]/90 to-white px-3 py-2 text-left shadow-sm transition hover:border-[var(--sf-green)]/40 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sf-green-mid)]/40";

  const iconWrapClass = isSidebar
    ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sf-gold)]/20 text-[var(--sf-gold)]"
    : "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--sf-green)]/10 text-[var(--sf-green-deep)]";

  const eyebrowClass = isSidebar
    ? "block text-[10px] font-bold uppercase tracking-wider text-[var(--sf-gold)]"
    : "block text-[10px] font-bold uppercase tracking-wider text-[var(--sf-green-mid)]";

  const valueClass = isSidebar
    ? "block truncate text-sm font-semibold text-white"
    : "block truncate text-sm font-semibold text-[var(--sf-green-deep)]";

  const hintClass = isSidebar
    ? "block text-[11px] text-white/55"
    : "block text-[11px] text-[var(--sf-green)]/55";

  const chevronClass = isSidebar
    ? `shrink-0 text-[var(--sf-gold)] transition-transform ${open ? "rotate-180" : ""}`
    : `shrink-0 text-[var(--sf-green)] transition-transform ${open ? "rotate-180" : ""}`;

  return (
    <div
      ref={rootRef}
      className={`relative min-w-0 ${isBanner ? "w-full" : ""}`}
    >
      {isBanner ? (
        <p className="mb-2 text-xs font-medium text-[var(--sf-green-deep)]">
          Vous avez accès à{" "}
          <strong>{cases.length} dossiers</strong> — cliquez ci-dessous pour
          changer de dossier :
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClass}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        title={label}
      >
        <span className={iconWrapClass} aria-hidden>
          <SwapIcon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={eyebrowClass}>
            {isSidebar || isBanner ? "Changer de dossier" : `Dossier actif · ${cases.length}`}
          </span>
          <span className={valueClass}>
            {activeCase ? (
              <>
                <span className={isSidebar ? "font-mono text-[var(--sf-gold)]" : "font-mono text-[var(--sf-green-mid)]"}>
                  {activeCase.reference}
                </span>
                {!isBanner ? (
                  <>
                    <span className={isSidebar ? "text-white/35" : "text-[var(--sf-green)]/35"}>
                      {" "}
                      ·{" "}
                    </span>
                    {activeCase.title}
                  </>
                ) : null}
              </>
            ) : (
              "Choisir un dossier"
            )}
          </span>
          {!isBanner ? (
            <span className={hintClass}>
              Cliquez pour voir vos {cases.length} dossiers
            </span>
          ) : (
            <span className={hintClass}>
              {activeCase?.title ?? "Sélectionnez un dossier dans la liste"}
            </span>
          )}
        </span>
        <span className={chevronClass} aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          className={`absolute z-50 mt-2 max-h-[min(360px,70vh)] overflow-auto rounded-xl border border-[var(--sf-cream-dark)] bg-white py-1 shadow-xl ring-1 ring-black/5 ${
            isSidebar
              ? "left-0 w-full min-w-[260px]"
              : isBanner
                ? "left-0 w-full min-w-[min(480px,calc(100vw-2rem))]"
                : "right-0 w-[min(360px,calc(100vw-2rem))]"
          }`}
        >
          <li className="border-b border-[var(--sf-cream-dark)] px-3 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--sf-green)]/45">
              Vos dossiers ({cases.length})
            </p>
          </li>
          {cases.map((c) => {
            const selected = c.id === activeCase?.id;
            return (
              <li key={c.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    selectCase(c.id);
                  }}
                  className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition hover:bg-[var(--sf-cream)] ${
                    selected
                      ? "bg-[var(--sf-cream)] ring-1 ring-inset ring-[var(--sf-gold)]/50"
                      : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs text-[var(--sf-green)]/55">
                      {c.reference}
                      {c.case_type
                        ? ` · ${CASE_TYPE_LABELS[c.case_type] || c.case_type}`
                        : ""}
                    </p>
                    <p className="truncate text-sm font-medium text-[var(--sf-green-deep)]">
                      {c.title}
                    </p>
                  </div>
                  {selected ? (
                    <span className="shrink-0 rounded-full bg-[var(--sf-gold)]/20 px-2 py-0.5 text-[10px] font-semibold text-[var(--sf-green-deep)]">
                      Actif
                    </span>
                  ) : (
                    <StatusBadge status={c.status} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
