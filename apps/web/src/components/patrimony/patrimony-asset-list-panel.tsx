"use client";

import { AssetTypeIcon } from "@/components/patrimony/asset-type-icon";
import type { AssetEstimationStatus } from "@/lib/faraid/asset-estimation-status";
import { ASSET_TYPE_LABELS, formatMoney } from "@/lib/labels";
import type { Asset } from "@/types/api";

type Props = {
  assets: Asset[];
  statusMap: Record<number, AssetEstimationStatus>;
  activeAssetId?: number | null;
  onSelect?: (assetId: number) => void;
  onEdit?: (assetId: number) => void;
  onDelete?: (assetId: number) => void;
  totalEstimated?: { sum: number; currency: string };
};

export function PatrimonyAssetListPanel({
  assets,
  statusMap,
  activeAssetId,
  onSelect,
  onEdit,
  onDelete,
  totalEstimated,
}: Props) {
  const showActions = Boolean(onEdit || onDelete);

  return (
    <div className="flex h-full max-h-[min(70vh,640px)] flex-col rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/35">
      <div className="shrink-0 border-b border-[var(--sf-cream-dark)] bg-white/80 px-4 py-3">
        <p className="text-xs font-semibold tracking-wide text-[var(--sf-gold)] uppercase">
          Patrimoine enregistré
        </p>
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-lg font-semibold text-[var(--sf-green-deep)]">
            {assets.length} bien{assets.length !== 1 ? "s" : ""}
          </p>
          {totalEstimated && totalEstimated.sum > 0 ? (
            <p className="text-sm font-semibold text-[var(--sf-green-mid)]">
              {formatMoney(String(totalEstimated.sum), totalEstimated.currency)}
            </p>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-[var(--sf-green)]/55">
          {onSelect
            ? "Cliquez sur un bien pour l'estimer. Modifier ou supprimer via les actions à droite."
            : showActions
              ? "Modifier ou supprimer un bien via les actions à droite."
              : "La liste se met à jour à chaque ajout."}
        </p>
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {assets.length === 0 ? (
          <li className="rounded-lg border border-dashed border-[var(--sf-cream-dark)] bg-white/60 px-4 py-8 text-center text-sm text-[var(--sf-green)]/55">
            Aucun bien pour l&apos;instant — utilisez le formulaire à gauche pour ajouter
            autant d&apos;actifs que nécessaire.
          </li>
        ) : (
          assets.map((asset, index) => {
            const st = statusMap[asset.id];
            const isActive = asset.id === activeAssetId;
            const currency = asset.latest_currency ?? asset.currency;

            const rowInner = (
              <>
                <AssetTypeIcon assetType={asset.asset_type} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium text-[var(--sf-green-deep)]">
                      {asset.label}
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        st?.estimated
                          ? "bg-[var(--sf-green)] text-white"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {st?.estimated ? "Estimé" : onSelect ? "À estimer" : "Enregistré"}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-[var(--sf-green)]/50">
                    {ASSET_TYPE_LABELS[asset.asset_type] ?? asset.asset_type}
                    {asset.location ? ` · ${asset.location}` : ""}
                  </span>
                  {st?.estimated && st.amount ? (
                    <span className="mt-1 block text-xs font-semibold text-[var(--sf-green-mid)]">
                      {formatMoney(st.amount, currency)}
                    </span>
                  ) : asset.latest_value ? (
                    <span className="mt-1 block text-xs text-[var(--sf-green)]/60">
                      {onSelect ? "Indicatif : " : ""}
                      {formatMoney(asset.latest_value, currency)}
                    </span>
                  ) : onSelect ? (
                    <span className="mt-1 block text-xs text-amber-800/75">
                      Justificatif PDF requis
                    </span>
                  ) : null}
                </span>
                {showActions ? (
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {onEdit ? (
                      <button
                        type="button"
                        title="Modifier"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(asset.id);
                        }}
                        className="rounded-md px-2 py-1 text-xs font-medium text-[var(--sf-green-mid)] hover:bg-[var(--sf-cream)] hover:underline"
                      >
                        Modifier
                      </button>
                    ) : null}
                    {onDelete ? (
                      <button
                        type="button"
                        title="Supprimer"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(asset.id);
                        }}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 hover:underline"
                      >
                        Supprimer
                      </button>
                    ) : null}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs font-medium text-[var(--sf-green)]/35">
                    {index + 1}
                  </span>
                )}
              </>
            );

            const rowClass = `flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
              isActive
                ? "border-[var(--sf-gold)] bg-white shadow-sm ring-1 ring-[var(--sf-gold)]/30"
                : "border-[var(--sf-cream-dark)] bg-white hover:border-[var(--sf-green)]/25"
            }`;

            return (
              <li key={asset.id}>
                {onSelect ? (
                  <button type="button" onClick={() => onSelect(asset.id)} className={rowClass}>
                    {rowInner}
                  </button>
                ) : (
                  <div className={rowClass.replace(" hover:border-[var(--sf-green)]/25", "")}>
                    {rowInner}
                  </div>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
