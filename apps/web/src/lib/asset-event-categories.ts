import { ASSET_EVENT_TYPE_LABELS } from "@/lib/labels";
import type { AssetEvent, AssetEventCategory, AssetEventType } from "@/types/api";

export function eventTypeLabel(type: AssetEventType): string {
  return ASSET_EVENT_TYPE_LABELS[type] ?? type;
}

export const EVENT_TYPES: AssetEventType[] = ["GAIN", "EXPENSE", "ESTIMATION", "OTHER"];

export function categoriesForType(
  categories: AssetEventCategory[],
  eventType: AssetEventType,
): AssetEventCategory[] {
  return categories.filter((c) => c.event_type === eventType);
}

export function eventMatchesCategory(event: AssetEvent, category: AssetEventCategory): boolean {
  return event.event_type === category.event_type && event.category === category.id;
}

export function isFixedCategory(category: AssetEventCategory): boolean {
  return category.billing_kind === "FIXED";
}

export function categoryFixedAmount(category: AssetEventCategory): string {
  return category.default_amount ?? "";
}
