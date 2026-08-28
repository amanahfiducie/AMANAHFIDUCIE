import type { Asset, AssetEvent } from "@/types/api";

export type AssetEstimationStatus = {
  assetId: number;
  estimated: boolean;
  amount: string | null;
  eventDate: string | null;
  justificationFilename: string | null;
  eventId: number | null;
};

export function findActiveEstimation(events: AssetEvent[]): AssetEvent | null {
  return (
    events.find(
      (e) =>
        e.event_type === "ESTIMATION" &&
        e.status !== "CANCELLED" &&
        e.has_justification &&
        e.amount,
    ) ?? null
  );
}

export function buildEstimationStatusMap(
  assets: Asset[],
  eventsByAssetId: Record<number, AssetEvent[]>,
): Record<number, AssetEstimationStatus> {
  const map: Record<number, AssetEstimationStatus> = {};
  for (const asset of assets) {
    const events = eventsByAssetId[asset.id] ?? [];
    const ev = findActiveEstimation(events);
    map[asset.id] = {
      assetId: asset.id,
      estimated: Boolean(ev),
      amount: ev?.amount ?? asset.latest_value ?? null,
      eventDate: ev?.event_date ?? null,
      justificationFilename: ev?.justification_filename ?? null,
      eventId: ev?.id ?? null,
    };
  }
  return map;
}

export function allAssetsEstimated(
  assets: Asset[],
  statusMap: Record<number, AssetEstimationStatus>,
): boolean {
  if (assets.length === 0) return false;
  return assets.every((a) => statusMap[a.id]?.estimated);
}
