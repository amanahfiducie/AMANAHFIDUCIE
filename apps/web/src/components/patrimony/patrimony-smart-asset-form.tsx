"use client";

import { AssetTypeIcon } from "@/components/patrimony/asset-type-icon";
import {
  ASSET_TYPE_ORDER,
  assetTypeUi,
} from "@/lib/patrimony/asset-type-ui";
import type { PatrimonyAssetFormState } from "@/lib/patrimony/create-asset";
import { ASSET_TYPE_LABELS, VALUATION_FREQUENCY_LABELS } from "@/lib/labels";

type Props = {
  form: PatrimonyAssetFormState;
  onChange: (form: PatrimonyAssetFormState) => void;
  onSubmit: () => void;
  submitting?: boolean;
  title?: string;
  submitLabel?: string;
  compact?: boolean;
  mode?: "create" | "edit";
  onCancel?: () => void;
};

export function PatrimonySmartAssetForm({
  form,
  onChange,
  onSubmit,
  submitting = false,
  title = "Nouveau bien",
  submitLabel = "+ Ajouter au patrimoine",
  compact = false,
  mode = "create",
  onCancel,
}: Props) {
  const ui = assetTypeUi(form.asset_type);
  const canSubmit = form.label.trim().length > 0;

  return (
    <div
      className={`rounded-xl border border-[var(--sf-cream-dark)] bg-white ${
        compact ? "p-4" : "p-5"
      }`}
    >
      <div className="flex items-start gap-4">
        <AssetTypeIcon assetType={form.asset_type} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-wide text-[var(--sf-gold)] uppercase">
            {title}
          </p>
          <h3 className={`mt-0.5 font-semibold text-[var(--sf-green-deep)] ${compact ? "text-base" : "text-lg"}`}>
            {ui.label}
          </h3>
          <p className="mt-1 text-sm text-[var(--sf-green)]/60">{ui.hint}</p>
        </div>
      </div>

      <div className={`mt-5 grid gap-4 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-6"}`}>
        <div className={compact ? "sm:col-span-2" : "sm:col-span-2 lg:col-span-3"}>
          <label className="block text-sm font-medium text-[var(--sf-green-deep)]">
            Type de bien *
          </label>
          <div className="mt-1.5 flex items-center gap-2.5">
            <AssetTypeIcon assetType={form.asset_type} size="sm" />
            <select
              value={form.asset_type}
              onChange={(e) => onChange({ ...form, asset_type: e.target.value })}
              className="sf-input min-w-0 flex-1"
            >
              {ASSET_TYPE_ORDER.map((key) => (
                <option key={key} value={key}>
                  {ASSET_TYPE_LABELS[key] ?? key}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={compact ? "sm:col-span-2" : "sm:col-span-2 lg:col-span-3"}>
          <label className="block text-sm font-medium text-[var(--sf-green-deep)]">
            Libellé *
          </label>
          <input
            value={form.label}
            onChange={(e) => onChange({ ...form, label: e.target.value })}
            className="sf-input mt-1.5 w-full"
            placeholder={ui.labelPlaceholder}
          />
        </div>

        <div className={compact ? "sm:col-span-2" : "sm:col-span-2 lg:col-span-2"}>
          <label className="block text-sm font-medium text-[var(--sf-green-deep)]">
            {ui.locationLabel}
          </label>
          <input
            value={form.location}
            onChange={(e) => onChange({ ...form, location: e.target.value })}
            className="sf-input mt-1.5 w-full"
            placeholder={ui.locationPlaceholder}
          />
        </div>

        <div className={compact ? "sm:col-span-1" : "sm:col-span-2 lg:col-span-2"}>
          <label className="block text-sm font-medium text-[var(--sf-green-deep)]">
            Estimation (FCFA)
          </label>
          <input
            type="number"
            min="0"
            step="1"
            value={form.estimated_value}
            onChange={(e) => onChange({ ...form, estimated_value: e.target.value })}
            className="sf-input mt-1.5 w-full"
            placeholder="Montant indicatif"
          />
        </div>

        <div className={compact ? "sm:col-span-1" : "sm:col-span-2 lg:col-span-2"}>
          <label className="block text-sm font-medium text-[var(--sf-green-deep)]">
            Réévaluation
          </label>
          <select
            value={form.valuation_frequency}
            onChange={(e) => onChange({ ...form, valuation_frequency: e.target.value })}
            className="sf-input mt-1.5 w-full"
          >
            {Object.entries(VALUATION_FREQUENCY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className={compact ? "sm:col-span-2" : "sm:col-span-2 lg:col-span-6"}>
          <label className="block text-sm font-medium text-[var(--sf-green-deep)]">
            Description
          </label>
          <textarea
            rows={compact ? 2 : 3}
            value={form.description}
            onChange={(e) => onChange({ ...form, description: e.target.value })}
            className="sf-input mt-1.5 w-full resize-y"
            placeholder={ui.descriptionPlaceholder}
          />
        </div>

        <div
          className={`${compact ? "sm:col-span-2" : "sm:col-span-2 lg:col-span-6"} flex flex-wrap items-end gap-2`}
        >
          <button
            type="button"
            disabled={submitting || !canSubmit}
            onClick={onSubmit}
            className="sf-btn-secondary w-full sm:w-auto"
          >
            {submitting
              ? mode === "edit"
                ? "Enregistrement…"
                : "Ajout…"
              : submitLabel}
          </button>
          {mode === "edit" && onCancel ? (
            <button
              type="button"
              disabled={submitting}
              onClick={onCancel}
              className="sf-btn-secondary w-full border border-[var(--sf-cream-dark)] bg-white sm:w-auto"
            >
              Annuler
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
