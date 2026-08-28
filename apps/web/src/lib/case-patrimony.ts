import type { Asset } from "@/types/api";

/** Somme des dernières valorisations des actifs (aligné sur l’API). */
export function computeCasePatrimonyFromAssets(
  assets: Pick<Asset, "latest_value" | "latest_currency" | "currency">[],
): { total: string; currency: string } | null {
  let sum = 0;
  for (const asset of assets) {
    if (asset.latest_value) {
      const n = Number(asset.latest_value);
      if (!Number.isNaN(n)) sum += n;
    }
  }
  if (sum <= 0) return null;
  const currency =
    assets.find((a) => a.latest_currency)?.latest_currency ??
    assets.find((a) => a.currency)?.currency ??
    "XOF";
  return { total: String(sum), currency };
}
