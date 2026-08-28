"use client";

import { useId, useRef } from "react";

import { CaseReportDocument } from "@/components/case/case-report-document";
import { printReportHtml } from "@/lib/print-report-html";
import type { ReportSnapshot } from "@/types/api";

type Props = {
  open: boolean;
  title?: string;
  snap: ReportSnapshot | null;
  onClose: () => void;
  /** Ouvre directement le dialogue d'impression à l'ouverture. */
  autoPrint?: boolean;
};

/**
 * Aperçu PDF A4 — même rendu HTML que l'aperçu écran (source unique).
 */
export function ReportPdfPreviewModal({
  open,
  title = "Aperçu PDF A4",
  snap,
  onClose,
}: Props) {
  const titleId = useId();
  const printRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  function handlePrint() {
    const node = printRef.current;
    if (!node) return;
    printReportHtml(node, title);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-[var(--sf-green-deep)]/55 p-2 sm:p-4 print:hidden"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto flex h-full max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)] shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--sf-cream-dark)] bg-white px-4 py-3">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-sm font-semibold text-[var(--sf-green-deep)]"
            >
              {title}
            </h2>
            <p className="mt-0.5 text-[11px] text-[var(--sf-green)]/50">
              Même contenu que l&apos;aperçu — sans le menu de l&apos;application
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="sf-btn-primary text-sm"
              disabled={!snap}
            >
              Imprimer / PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="sf-btn-secondary text-sm"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[var(--sf-cream)] p-3 sm:p-5">
          {!snap ? (
            <p className="py-16 text-center text-sm text-[var(--sf-green)]/55">
              Aucun contenu de rapport à afficher. Régénérez le rapport.
            </p>
          ) : (
            <div className="mx-auto w-full max-w-[210mm]">
              <div
                ref={printRef}
                className="rounded-sm border border-[var(--sf-cream-dark)] bg-white px-4 py-5 shadow-sm sm:px-6 sm:py-6"
              >
                <CaseReportDocument
                  snap={snap}
                  className="space-y-5"
                  showLetterhead
                  documentTitle={title}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
