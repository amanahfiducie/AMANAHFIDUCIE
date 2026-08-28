"use client";

import { useEffect, useId, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";

import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, fetchApiBlob } from "@/lib/api";

if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
}

const HEADER_APPROX_PX = 52;
const MODAL_PADDING_PX = 12;
const DOCUMENT_SCALE = 1;

type AssetEventPdfPreviewModalProps = {
  open: boolean;
  assetId: number;
  eventId: number | null;
  title?: string;
  onClose: () => void;
};

export function AssetEventPdfPreviewModal({
  open,
  assetId,
  eventId,
  title = "Justificatif PDF",
  onClose,
}: AssetEventPdfPreviewModalProps) {
  const titleId = useId();
  const pagesRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contentSize, setContentSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    if (!open || eventId == null) {
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
        const blob = await fetchApiBlob(
          `/assets/${assetId}/events/${eventId}/justification-preview/`,
        );
        if (cancelled) return;
        const data = await blob.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data }).promise;
        if (cancelled || !container) return;

        let maxW = 0;
        let totalH = 0;
        const gap = 12;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: DOCUMENT_SCALE });
          maxW = Math.max(maxW, viewport.width);
          totalH += viewport.height + (i < pdf.numPages ? gap : 0);

          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;
          await page.render({ canvasContext: ctx, viewport }).promise;
          container.appendChild(canvas);
        }

        if (!cancelled) {
          setContentSize({ width: maxW, height: totalH });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message
              : "Impossible d’afficher le justificatif PDF.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, assetId, eventId]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/50 p-3 sm:p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="mx-auto flex h-full max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[var(--sf-cream-dark)] bg-white shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--sf-cream-dark)] px-4 py-3"
          style={{ minHeight: HEADER_APPROX_PX }}
        >
          <h2
            id={titleId}
            className="truncate text-sm font-semibold text-[var(--sf-green-deep)]"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="sf-btn-secondary shrink-0 text-sm"
          >
            Fermer
          </button>
        </div>

        <div
          className="min-h-0 flex-1 overflow-auto bg-[var(--sf-cream)]/30 p-4"
          style={{ padding: MODAL_PADDING_PX }}
        >
          {loading ? (
            <p className="text-center text-sm text-[var(--sf-green)]/55">Chargement du PDF…</p>
          ) : null}
          {error ? <ErrorAlert message={error} /> : null}
          <div
            ref={pagesRef}
            className="mx-auto flex flex-col items-center gap-3"
            style={
              contentSize
                ? { width: contentSize.width, minHeight: contentSize.height }
                : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
