import type { FaraidHeirDecision, FaraidHeirDecisionStatus } from "@/types/api";
import { formatMoney } from "@/lib/labels";

export function beneficiaryNodeId(beneficiaryId: number): string {
  return `b-${beneficiaryId}`;
}

export function buildHeirDecisionMaps(decisions: FaraidHeirDecision[]) {
  const statusByNodeId = new Map<string, FaraidHeirDecisionStatus>();
  const byBeneficiaryId = new Map<number, FaraidHeirDecision>();
  const highlightIds = new Set<string>();
  const excludedIds = new Set<string>();
  const acceptedBeneficiaryIds = new Set<number>();

  for (const d of decisions) {
    if (d.beneficiary == null) continue;
    const nodeId = beneficiaryNodeId(d.beneficiary);
    statusByNodeId.set(nodeId, d.status);
    byBeneficiaryId.set(d.beneficiary, d);
    if (d.status === "ACCEPTED") {
      highlightIds.add(nodeId);
      acceptedBeneficiaryIds.add(d.beneficiary);
    }
    if (d.status === "REJECTED") excludedIds.add(nodeId);
  }

  return {
    statusByNodeId,
    byBeneficiaryId,
    highlightIds,
    excludedIds,
    acceptedBeneficiaryIds,
  };
}

export function filterAcceptedHeirs<T extends { id: number }>(
  members: T[],
  decisions: FaraidHeirDecision[],
): T[] {
  const { acceptedBeneficiaryIds } = buildHeirDecisionMaps(decisions);
  return members.filter((m) => acceptedBeneficiaryIds.has(m.id));
}

export function buildShareSubtitleMap(
  decisions: FaraidHeirDecision[],
  currency = "XOF",
): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of decisions) {
    if (d.status !== "ACCEPTED" || d.beneficiary == null) continue;
    const parts: string[] = [];
    if (d.share_fraction) {
      const pct = Number(d.share_fraction) * 100;
      if (!Number.isNaN(pct)) parts.push(`${pct.toFixed(2)} %`);
    }
    if (d.share_amount) {
      parts.push(formatMoney(d.share_amount, currency));
    }
    if (parts.length > 0) {
      map.set(beneficiaryNodeId(d.beneficiary), parts.join(" · "));
    }
  }
  return map;
}

export type HeirDecisionPatch = Partial<{
  status: FaraidHeirDecisionStatus;
  rejection_justification: string;
  share_fraction: string | null;
  share_amount: string | null;
  committee_notes: string;
  faraid_role: string;
}>;
