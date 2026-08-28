"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PatrimonyAssetListPanel } from "@/components/patrimony/patrimony-asset-list-panel";
import { PatrimonySmartAssetForm } from "@/components/patrimony/patrimony-smart-asset-form";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, apiRequest } from "@/lib/api";
import {
  appendAssetEventFields,
  isPdfFile,
  type AssetEventFormFields,
} from "@/lib/asset-event-form";
import {
  allAssetsEstimated,
  buildEstimationStatusMap,
  type AssetEstimationStatus,
} from "@/lib/faraid/asset-estimation-status";
import { ASSET_TYPE_LABELS, formatDate, formatMoney } from "@/lib/labels";
import {
  assetToPatrimonyForm,
  createCaseAsset,
  deleteCaseAsset,
  EMPTY_PATRIMONY_ASSET_FORM,
  updateCaseAsset,
  type PatrimonyAssetFormState,
} from "@/lib/patrimony/create-asset";
import type { Asset, AssetEvent } from "@/types/api";

const EMPTY_FORM: AssetEventFormFields = {
  reference: "OTHER",
  title: "",
  description: "",
  amount: "",
  event_date: new Date().toISOString().slice(0, 10),
  expense_kind: "FIXED",
};

type Props = {
  caseId: string;
  assets: Asset[];
  onAssetsChanged: () => void | Promise<void>;
  onTotalsChange?: (totals: { gross: number; currency: string; allEstimated: boolean }) => void;
};

export function SuccessionAssetEvaluation({
  caseId,
  assets,
  onAssetsChanged,
  onTotalsChange,
}: Props) {
  const [eventsByAsset, setEventsByAsset] = useState<Record<number, AssetEvent[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [addForm, setAddForm] = useState<PatrimonyAssetFormState>({
    ...EMPTY_PATRIMONY_ASSET_FORM,
  });
  const [addingAsset, setAddingAsset] = useState(false);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [pendingSelectId, setPendingSelectId] = useState<number | null>(null);
  const [form, setForm] = useState<AssetEventFormFields>({ ...EMPTY_FORM });
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadAllEvents = useCallback(async () => {
    if (assets.length === 0) {
      setEventsByAsset({});
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const entries = await Promise.all(
        assets.map(async (asset) => {
          const events = await apiRequest<AssetEvent[]>(
            `/assets/${asset.id}/events/?include_cancelled=0`,
          );
          return [asset.id, events] as const;
        }),
      );
      const map: Record<number, AssetEvent[]> = {};
      for (const [id, events] of entries) map[id] = events;
      setEventsByAsset(map);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Chargement des estimations impossible.");
    } finally {
      setLoading(false);
    }
  }, [assets]);

  useEffect(() => {
    void loadAllEvents();
  }, [loadAllEvents]);

  useEffect(() => {
    if (pendingSelectId == null) return;
    const idx = assets.findIndex((a) => a.id === pendingSelectId);
    if (idx >= 0) {
      setActiveIndex(idx);
      setPendingSelectId(null);
    }
  }, [assets, pendingSelectId]);

  useEffect(() => {
    if (activeIndex >= assets.length) {
      setActiveIndex(Math.max(0, assets.length - 1));
    }
  }, [assets.length, activeIndex]);

  const statusMap = useMemo(
    () => buildEstimationStatusMap(assets, eventsByAsset),
    [assets, eventsByAsset],
  );

  const allDone = useMemo(
    () => assets.length > 0 && allAssetsEstimated(assets, statusMap),
    [assets, statusMap],
  );

  const estimatedTotal = useMemo(() => {
    let sum = 0;
    let currency = "XOF";
    for (const asset of assets) {
      const st = statusMap[asset.id];
      if (!st?.estimated || !st.amount) continue;
      const n = Number(st.amount);
      if (!Number.isNaN(n)) sum += n;
      currency = asset.latest_currency ?? asset.currency ?? currency;
    }
    return { sum, currency };
  }, [assets, statusMap]);

  useEffect(() => {
    onTotalsChange?.({
      gross: estimatedTotal.sum,
      currency: estimatedTotal.currency,
      allEstimated: allDone,
    });
  }, [estimatedTotal.sum, estimatedTotal.currency, allDone, onTotalsChange]);

  const activeAsset = assets[activeIndex] ?? null;
  const activeStatus: AssetEstimationStatus | null = activeAsset
    ? statusMap[activeAsset.id] ?? null
    : null;

  useEffect(() => {
    if (!activeAsset) return;
    const st = statusMap[activeAsset.id];
    if (st?.estimated && st.amount) {
      setForm((f) => ({
        ...f,
        amount: st.amount ?? "",
        event_date: st.eventDate ?? f.event_date,
      }));
    } else {
      setForm({
        ...EMPTY_FORM,
        amount: activeAsset.latest_value ?? "",
        event_date: new Date().toISOString().slice(0, 10),
      });
    }
    setPdfFile(null);
  }, [activeAsset?.id, activeStatus?.estimated, activeAsset, statusMap]);

  function resetAddForm() {
    setAddForm({
      ...EMPTY_PATRIMONY_ASSET_FORM,
      asset_type: addForm.asset_type,
      valuation_frequency: addForm.valuation_frequency,
    });
    setEditingAssetId(null);
  }

  async function handleSaveAsset() {
    if (!addForm.label.trim()) return;
    setAddingAsset(true);
    setError(null);
    try {
      if (editingAssetId != null) {
        await updateCaseAsset(editingAssetId, addForm);
        setPendingSelectId(editingAssetId);
        resetAddForm();
      } else {
        const created = await createCaseAsset(
          caseId,
          addForm,
          "Estimation initiale — évaluation patrimoine",
        );
        setAddForm({
          ...EMPTY_PATRIMONY_ASSET_FORM,
          asset_type: addForm.asset_type,
          valuation_frequency: addForm.valuation_frequency,
        });
        setPendingSelectId(created.id);
      }
      await onAssetsChanged();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : editingAssetId != null
            ? "Impossible de modifier ce bien."
            : "Impossible d'ajouter ce bien.",
      );
    } finally {
      setAddingAsset(false);
    }
  }

  function startEditAsset(assetId: number) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    setEditingAssetId(assetId);
    setAddForm(assetToPatrimonyForm(asset));
    const idx = assets.findIndex((a) => a.id === assetId);
    if (idx >= 0) setActiveIndex(idx);
  }

  async function handleDeleteAsset(assetId: number) {
    const asset = assets.find((a) => a.id === assetId);
    if (!asset) return;
    if (
      !window.confirm(
        `Supprimer « ${asset.label} » du patrimoine ? Cette action est irréversible.`,
      )
    ) {
      return;
    }
    setAddingAsset(true);
    setError(null);
    try {
      await deleteCaseAsset(assetId);
      if (editingAssetId === assetId) resetAddForm();
      await onAssetsChanged();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de supprimer ce bien.");
    } finally {
      setAddingAsset(false);
    }
  }

  async function submitEstimation() {
    if (!activeAsset || !pdfFile || !form.amount.trim() || !form.event_date) return;
    if (!isPdfFile(pdfFile)) {
      setError("Le justificatif doit être un fichier PDF.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const body = new FormData();
      appendAssetEventFields(body, "ESTIMATION", form);
      body.append("justification_file", pdfFile);
      await apiRequest<AssetEvent>(`/assets/${activeAsset.id}/events/`, {
        method: "POST",
        body,
      });
      await loadAllEvents();
      onAssetsChanged();
      const nextPending = assets.findIndex(
        (a, i) => i > activeIndex && !statusMap[a.id]?.estimated,
      );
      if (nextPending >= 0) setActiveIndex(nextPending);
      else if (activeIndex < assets.length - 1) setActiveIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-[var(--sf-green-deep)]">
            Évaluation du patrimoine
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/60">
            Ajoutez autant de biens que nécessaire, puis estimez chacun avec un justificatif PDF.
          </p>
        </div>
        {assets.length > 0 ? (
          <p className="text-sm font-semibold text-[var(--sf-green-deep)]">
            {Object.values(statusMap).filter((s) => s.estimated).length} / {assets.length}{" "}
            estimé{assets.length > 1 ? "s" : ""}
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-7">
          <PatrimonySmartAssetForm
            form={addForm}
            onChange={setAddForm}
            onSubmit={() => void handleSaveAsset()}
            submitting={addingAsset}
            mode={editingAssetId != null ? "edit" : "create"}
            title={editingAssetId != null ? "Modifier le bien" : "Ajouter un bien"}
            submitLabel={
              editingAssetId != null ? "Enregistrer les modifications" : "+ Ajouter ce bien"
            }
            onCancel={editingAssetId != null ? resetAddForm : undefined}
          />

          {loading && assets.length > 0 ? (
            <p className="text-sm text-[var(--sf-green)]/55">Chargement des estimations…</p>
          ) : null}

          {activeAsset ? (
            <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
              <p className="text-xs font-semibold tracking-wide text-[var(--sf-gold)] uppercase">
                Estimation — bien sélectionné
              </p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--sf-green-deep)]">
                {activeAsset.label}
              </h3>
              <p className="text-sm text-[var(--sf-green)]/55">
                {ASSET_TYPE_LABELS[activeAsset.asset_type] ?? activeAsset.asset_type}
              </p>

              {activeStatus?.estimated ? (
                <div className="mt-4 rounded-lg border border-[var(--sf-green)]/20 bg-[var(--sf-cream)]/50 px-4 py-3">
                  <p className="text-sm font-semibold text-[var(--sf-green-deep)]">
                    Estimation enregistrée
                  </p>
                  <p className="mt-1 text-sm text-[var(--sf-green)]/70">
                    Montant :{" "}
                    <strong>
                      {formatMoney(
                        activeStatus.amount ?? "0",
                        activeAsset.latest_currency ?? activeAsset.currency,
                      )}
                    </strong>
                    {activeStatus.eventDate ? (
                      <> · Date : {formatDate(activeStatus.eventDate)}</>
                    ) : null}
                  </p>
                  {activeStatus.justificationFilename ? (
                    <p className="mt-1 text-xs text-[var(--sf-green)]/55">
                      Justificatif : {activeStatus.justificationFilename}
                    </p>
                  ) : null}
                  <Link
                    href={`/dossiers/${caseId}/patrimoine/actifs/${activeAsset.id}/estimations`}
                    className="mt-2 inline-block text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
                  >
                    Voir l&apos;historique →
                  </Link>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <label className="block text-sm">
                    <span className="font-medium text-[var(--sf-green-deep)]">
                      Montant estimé (XOF) *
                    </span>
                    <input
                      className="sf-input mt-1"
                      type="number"
                      min="0"
                      step="1"
                      value={form.amount}
                      onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-[var(--sf-green-deep)]">
                      Date de l&apos;estimation *
                    </span>
                    <input
                      className="sf-input mt-1"
                      type="date"
                      value={form.event_date}
                      onChange={(e) => setForm((f) => ({ ...f, event_date: e.target.value }))}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-[var(--sf-green-deep)]">
                      Notes / méthode d&apos;évaluation
                    </span>
                    <textarea
                      className="sf-input mt-1 min-h-[72px]"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Expertise, titre foncier, relevé bancaire…"
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="font-medium text-[var(--sf-green-deep)]">
                      Justificatif PDF *
                    </span>
                    <input
                      className="mt-1 block w-full text-sm"
                      type="file"
                      accept="application/pdf,.pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    />
                  </label>
                  <button
                    type="button"
                    className="sf-btn-primary"
                    disabled={submitting || !pdfFile || !form.amount.trim()}
                    onClick={() => void submitEstimation()}
                  >
                    {submitting ? "Enregistrement…" : "Enregistrer l'estimation"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 px-5 py-8 text-center text-sm text-[var(--sf-green)]/60">
              Ajoutez un premier bien — il apparaîtra dans la liste à droite pour l&apos;estimation.
            </div>
          )}
        </div>

        <aside className="lg:col-span-5 lg:sticky lg:top-4">
          <PatrimonyAssetListPanel
            assets={assets}
            statusMap={statusMap}
            activeAssetId={activeAsset?.id}
            onSelect={(id) => {
              const idx = assets.findIndex((a) => a.id === id);
              if (idx >= 0) setActiveIndex(idx);
            }}
            onEdit={startEditAsset}
            onDelete={(id) => void handleDeleteAsset(id)}
            totalEstimated={estimatedTotal}
          />
        </aside>
      </div>

      {assets.length > 0 ? (
        allDone ? (
          <p className="rounded-lg bg-[var(--sf-green)]/8 px-4 py-3 text-sm font-medium text-[var(--sf-green-deep)]">
            Tous les biens sont estimés avec justificatif. Vous pouvez passer au partage farāʾiḍ.
          </p>
        ) : (
          <p className="text-sm text-amber-900/80">
            Complétez l&apos;estimation et le justificatif pour chaque bien de la liste.
          </p>
        )
      ) : null}
    </div>
  );
}
