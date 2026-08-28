import type { FaraidHeirDecisionStatus, FaraidSettlementActionType } from "@/types/api";

export const FARAID_DECISION_STATUS_LABELS: Record<FaraidHeirDecisionStatus, string> = {
  PENDING: "En attente",
  ACCEPTED: "Héritier retenu",
  REJECTED: "Exclu",
};

export const FARAID_ACTION_TYPE_LABELS: Record<FaraidSettlementActionType, string> = {
  ASSET_PURCHASE: "Achat d'un bien par un héritier",
  ASSET_ALLOCATION: "Attribution d'un bien",
  CASH_SETTLEMENT: "Règlement en numéraire",
  OTHER: "Autre arrangement",
};

export const FARAID_DECISION_STATUS_CLASS: Record<FaraidHeirDecisionStatus, string> = {
  PENDING: "bg-amber-100 text-amber-900",
  ACCEPTED: "bg-[var(--sf-green)] text-white",
  REJECTED: "bg-red-100 text-red-900",
};
