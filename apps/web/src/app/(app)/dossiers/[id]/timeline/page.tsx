"use client";

import { EmptyState } from "@/components/ui/empty";
import { useCaseDetail } from "@/providers/case-detail-provider";
import { formatDate } from "@/lib/labels";

export default function CaseTimelinePage() {
  const { data } = useCaseDetail();
  if (!data) return null;

  if (data.timeline_events.length === 0) {
    return (
      <EmptyState
        title="Timeline vide"
        description="Les événements du dossier s’afficheront au fil des actions métier."
      />
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-emerald-800/20 pl-6">
      {data.timeline_events.map((ev) => (
        <li key={ev.id} className="relative">
          <span className="absolute -left-[1.62rem] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-800" />
          <div className="rounded-lg border border-[#1a2e1f]/10 bg-white px-4 py-3 text-sm">
            <p className="font-medium text-[#1a2e1f]/90">{ev.message}</p>
            <p className="mt-1 text-xs text-[#1a2e1f]/55">
              {formatDate(ev.created_at)}
              {ev.actor_username ? ` · ${ev.actor_username}` : ""}
              {ev.event_type ? ` · ${ev.event_type}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
