"use client";

import { useEffect, useId, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";

import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError } from "@/lib/api";
import { getDocumentPreviewUrl } from "@/lib/documents";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

const HEADER_APPROX_PX = 52;
const MODAL_PADDING_PX = 12;

/** Échelle 1:1 — dimensions PDF réelles (points → pixels CSS). */
const DOCUMENT_SCALE = 1;

type DocumentPreviewModalProps = {
  open: boolean;
  documentId: number | null;
  title?: string;
  onClose: () => void;
};

export function DocumentPreviewModal({
  open,
  documentId,
  title = "Document",
  onClose,
}: DocumentPreviewModalProps) {
  const titleId = useId();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open || documentId == null) {
      setError(null);
      setContentSize(null);
      if (pagesRef.current) pagesRef.current.innerHTML = "";
      return;
    }

    let cancelled = false;
    const container = pagesRef.current;

    setLoading(true);
    setError(null);
    setContentSize(null);
    if (container) container.innerHTML = "";

    void (async () => {
      try {
        const { url } = await getDocumentPreviewUrl(documentId);
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`Impossible de charger le fichier (${res.status}).`);
        }
        const blob = await res.blob();
        if (cancelled || !container) return;

        const buffer = await blob.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buffer }).promise;
        if (cancelled) return;

        const scale = DOCUMENT_SCALE;
        const pageGap = 8;
        let totalHeight = 0;
        let renderWidth = 0;

        for (let i = 1; i <= pdf.numPages; i++) {
          if (cancelled) return;
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "block bg-white shadow-sm";
          canvas.style.width = `${viewport.width}px`;
          canvas.style.height = `${viewport.height}px`;
          if (pdf.numPages > 1 && i < pdf.numPages) {
            canvas.style.marginBottom = `${pageGap}px`;
          }

          await page.render({ canvasContext: ctx, viewport }).promise;
          container.appendChild(canvas);

          renderWidth = Math.max(renderWidth, viewport.width);
          totalHeight += viewport.height + (i < pdf.numPages ? pageGap : 0);
        }

        if (!cancelled) {
          setContentSize({ width: renderWidth, height: totalHeight });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Impossible de charger l'aperçu du document.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
  }, [open, documentId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[94vh] max-w-[96vw] flex-col overflow-hidden rounded-lg border border-[var(--sf-cream-dark)] bg-white shadow-2xl"
        style={
          contentSize
            ? {
                width: `min(${Math.ceil(contentSize.width) + MODAL_PADDING_PX * 2}px, 96vw)`,
              }
            : { width: "min(420px, 96vw)" }
        }
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--sf-cream-dark)] px-3 py-2">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="truncate text-sm font-semibold text-[var(--sf-green-deep)]"
            >
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-[var(--sf-cream-dark)] px-2.5 py-1 text-xs font-medium text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]/50"
          >
            Fermer
          </button>
        </header>

        <div
          className="overflow-auto bg-neutral-200/80 p-3"
          style={{
            maxHeight: `calc(94vh - ${HEADER_APPROX_PX}px)`,
            minHeight: loading ? 200 : undefined,
          }}
        >
          {loading ? (
            <p className="flex min-h-[160px] items-center justify-center text-sm text-[var(--sf-green)]/50">
              Chargement de l&apos;aperçu…
            </p>
          ) : null}
          {error ? <ErrorAlert message={error} /> : null}
          <div
            ref={pagesRef}
            className="mx-auto w-fit"
            style={
              contentSize
                ? {
                    width: `${contentSize.width}px`,
                    minHeight: loading ? undefined : `${contentSize.height}px`,
                  }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
