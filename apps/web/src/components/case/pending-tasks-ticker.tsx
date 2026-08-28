"use client";

import { useEffect, useMemo, useState } from "react";

const SLIDE_MS = 3000;
const LINE_H = "1.5rem";

export type PendingTaskItem = {
  id: string;
  label: string;
  status: "completed" | "skipped" | "pending";
};

export function PendingTasksTicker({
  tasks,
  className = "",
}: {
  tasks: PendingTaskItem[];
  className?: string;
}) {
  const [slide, setSlide] = useState(0);

  const slides = useMemo(() => {
    const skippedCount = tasks.filter((t) => t.status === "skipped").length;
    const pendingCount = tasks.filter((t) => t.status === "pending").length;
    const summaryText =
      tasks.length === 1
        ? "1 étape à compléter"
        : `${tasks.length} étapes à compléter`;

    return [
      ...tasks.map((task) => ({ kind: "task" as const, task })),
      {
        kind: "summary" as const,
        text: summaryText,
        skippedCount,
        pendingCount,
      },
    ];
  }, [tasks]);

  const totalSlides = slides.length;

  useEffect(() => {
    if (tasks.length === 0) return;
    setSlide(0);
  }, [tasks]);

  useEffect(() => {
    if (totalSlides === 0) return;
    const timer = window.setInterval(() => {
      setSlide((prev) => (prev + 1) % totalSlides);
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [totalSlides]);

  if (tasks.length === 0) return null;

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${className}`}
      aria-live="polite"
      aria-atomic
    >
      <span className="hidden shrink-0 text-[10px] font-semibold uppercase tracking-wide text-red-800/55 sm:inline">
        Tâches
      </span>
      <div
        className="relative min-w-[10rem] max-w-[min(20rem,36vw)] overflow-hidden rounded-md border border-red-200/60 bg-red-50/90 px-2"
        style={{ height: LINE_H }}
      >
        <div
          className="transition-transform duration-[650ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ transform: `translateY(calc(-${slide} * ${LINE_H}))` }}
        >
          {slides.map((item, index) => (
            <div
              key={item.kind === "task" ? item.task.id : "summary"}
              className="flex h-6 items-center gap-1.5 text-xs leading-none text-red-950"
              style={{ height: LINE_H }}
              aria-hidden={index !== slide}
            >
              {item.kind === "summary" ? (
                <span className="truncate font-semibold">{item.text}</span>
              ) : (
                <>
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                      item.task.status === "skipped"
                        ? "bg-red-600 text-white"
                        : "bg-amber-500 text-white"
                    }`}
                    aria-hidden
                  >
                    !
                  </span>
                  <span className="truncate font-medium">{item.task.label}</span>
                  <span className="hidden shrink-0 text-red-800/50 md:inline">
                    {item.task.status === "skipped" ? "reportée" : "à faire"}
                  </span>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
