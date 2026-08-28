"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { PendingTasksTicker } from "@/components/case/pending-tasks-ticker";
import { StatusBadge } from "@/components/status-badge";
import { useCaseDetail } from "@/providers/case-detail-provider";

const PORTAL_ID = "case-header-portal";

function resumeStepId(taskId: string | undefined): string {
  if (!taskId || taskId === "identification") return "donor";
  return taskId;
}

export function CaseHeaderPortal() {
  const { data } = useCaseDetail();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setTarget(document.getElementById(PORTAL_ID));
  }, [data]);

  if (!data || !target) return null;

  const tasks = data.onboarding?.pending_tasks ?? [];
  const hasTasks = tasks.length > 0;
  const firstTaskId = tasks[0]?.id;

  return createPortal(
    <div className="flex w-full min-w-0 flex-wrap items-center gap-x-4 gap-y-2 sm:gap-x-5">
      <div className="min-w-0 flex-1 basis-[min(100%,14rem)]">
        <p className="font-mono text-sm font-semibold tracking-wider text-[var(--sf-green-mid)] sm:text-base">
          {data.reference}
        </p>
        <h1 className="sf-display mt-0.5 truncate text-2xl font-semibold leading-tight tracking-tight text-[var(--sf-green-deep)] sm:text-3xl">
          {data.title}
        </h1>
      </div>

      <StatusBadge status={data.status} />

      {hasTasks ? (
        <>
          <PendingTasksTicker tasks={tasks} />
          <Link
            href={`/dossiers/${data.id}/enregistrement?step=${encodeURIComponent(resumeStepId(firstTaskId))}`}
            className={`shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-medium sm:text-sm ${
              data.status === "DRAFT"
                ? "sf-btn-gold"
                : "rounded-lg border border-red-200 bg-white text-red-900 hover:bg-red-50"
            }`}
          >
            {data.status === "DRAFT"
              ? "Compléter l'enregistrement"
              : "Compléter les tâches"}
          </Link>
        </>
      ) : null}
    </div>,
    target,
  );
}

export { PORTAL_ID };
