import { CASE_STATUS_LABELS } from "@/lib/labels";

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  UNDER_REVIEW: "bg-amber-50 text-amber-800",
  LEGAL_REVIEW: "bg-violet-50 text-violet-800",
  COMPLIANCE_REVIEW: "bg-violet-50 text-violet-800",
  ACTIVE: "bg-emerald-50 text-emerald-800",
  SUSPENDED: "bg-orange-50 text-orange-800",
  CLOSING: "bg-blue-50 text-blue-800",
  CLOSED: "bg-slate-200 text-slate-600",
  REJECTED: "bg-red-50 text-red-800",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700"
      }`}
    >
      {CASE_STATUS_LABELS[status] ?? status}
    </span>
  );
}
