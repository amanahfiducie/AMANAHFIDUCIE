"use client";

import { useEffect, useMemo, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { FARAID_ACTION_TYPE_LABELS } from "@/lib/faraid/review-labels";
import { formatMoney } from "@/lib/labels";
import type {
  Asset,
  Beneficiary,
  FaraidHeirDecision,
  FaraidSettlementAction,
  FaraidSettlementActionType,
} from "@/types/api";

export type HeirShareFormState = {
  share_percent: string;
  share_amount: string;
  committee_notes: string;
  action_type: FaraidSettlementActionType;
  action_title: string;
  action_description: string;
  action_asset_id: string;
  action_amount: string;
};

export function emptyHeirShareForm(): HeirShareFormState {
  return {
    share_percent: "",
    share_amount: "",
    committee_notes: "",
    action_type: "ASSET_ALLOCATION",
    action_title: "",
    action_description: "",
    action_asset_id: "",
    action_amount: "",
  };
}

type Props = {
  open: boolean;
  member: Beneficiary | null;
  decision: FaraidHeirDecision | null;
  actions: FaraidSettlementAction[];
  assets: Asset[];
  currency: string;
  readOnly?: boolean;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onSaveShare: (form: HeirShareFormState) => void | Promise<void>;
  onAddAction?: (form: HeirShareFormState) => void | Promise<void>;
  onDeleteAction?: (actionId: number) => void | Promise<void>;
};

export function HeirShareModal({
  open,
  member,
  decision,
  actions,
  assets,
  currency,
  readOnly = false,
  busy = false,
  error = null,
  onClose,
  onSaveShare,
  onAddAction,
  onDeleteAction,
}: Props) {
  const [form, setForm] = useState<HeirShareFormState>(emptyHeirShareForm());

  useEffect(() => {
    if (!open || !decision) return;
    const pct =
      decision.share_fraction && !Number.isNaN(Number(decision.share_fraction))
        ? String(Number(decision.share_fraction) * 100)
        : "";
    setForm({
      ...emptyHeirShareForm(),
      share_percent: pct,
      share_amount: decision.share_amount ?? "",
      committee_notes: decision.committee_notes ?? "",
    });
  }, [open, decision]);

  const heirActions = useMemo(
    () => actions.filter((a) => a.beneficiary === member?.id),
    [actions, member?.id],
  );

  if (!open || !member || !decision) return null;

  const relation =
    member.relation_to_donor_label || member.relation_to_donor || "Héritier retenu";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="heir-share-title"
    >
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--sf-cream-dark)] px-5 py-4">
          <div>
            <h2 id="heir-share-title" className="text-lg font-semibold text-[var(--sf-green-deep)]">
              {member.first_name} {member.last_name}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--sf-green)]/60">{relation}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Fermer
          </button>
        </div>

        <div className="space-y-5 px-5 py-4">
          {error ? <ErrorAlert message={error} /> : null}

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">Part successorale</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium">Part (%)</span>
                <input
                  className="sf-input mt-1"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.share_percent}
                  disabled={readOnly || busy}
                  onChange={(e) => setForm({ ...form, share_percent: e.target.value })}
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium">Montant ({currency})</span>
                <input
                  className="sf-input mt-1"
                  type="number"
                  min="0"
                  step="1"
                  value={form.share_amount}
                  disabled={readOnly || busy}
                  onChange={(e) => setForm({ ...form, share_amount: e.target.value })}
                />
              </label>
            </div>
            <label className="block text-sm">
              <span className="font-medium">Attributions & détails de l&apos;héritage</span>
              <textarea
                className="sf-input mt-1 min-h-[88px]"
                value={form.committee_notes}
                disabled={readOnly || busy}
                placeholder="Ex. : attribution de la maison familiale, véhicule, arrangements particuliers…"
                onChange={(e) => setForm({ ...form, committee_notes: e.target.value })}
              />
            </label>
            {!readOnly ? (
              <button
                type="button"
                className="sf-btn-primary text-sm"
                disabled={busy}
                onClick={() => void onSaveShare(form)}
              >
                Enregistrer la part
              </button>
            ) : null}
          </section>

          <section className="space-y-3 border-t border-[var(--sf-cream-dark)] pt-4">
            <h3 className="text-sm font-semibold text-[var(--sf-green-deep)]">
              Actions particulières
            </h3>
            {heirActions.length > 0 ? (
              <ul className="space-y-2">
                {heirActions.map((action) => (
                  <li
                    key={action.id}
                    className="rounded-lg border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 px-3 py-2 text-sm"
                  >
                    <p className="font-medium text-[var(--sf-green-deep)]">{action.title}</p>
                    <p className="text-xs text-[var(--sf-green)]/55">
                      {FARAID_ACTION_TYPE_LABELS[action.action_type]}
                    </p>
                    {action.description ? (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-[var(--sf-green)]/70">
                        {action.description}
                      </p>
                    ) : null}
                    {action.amount ? (
                      <p className="mt-1 text-xs font-semibold text-[var(--sf-green-mid)]">
                        {formatMoney(action.amount, action.currency)}
                      </p>
                    ) : null}
                    {!readOnly && onDeleteAction ? (
                      <button
                        type="button"
                        className="mt-1 text-xs text-red-700 hover:underline"
                        disabled={busy}
                        onClick={() => void onDeleteAction(action.id)}
                      >
                        Supprimer
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--sf-green)]/50">Aucune action enregistrée.</p>
            )}

            {!readOnly && onAddAction ? (
              <div className="space-y-2 rounded-lg border border-dashed border-[var(--sf-cream-dark)] p-3">
                <select
                  className="sf-input w-full text-sm"
                  value={form.action_type}
                  disabled={busy}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      action_type: e.target.value as FaraidSettlementActionType,
                    })
                  }
                >
                  {Object.entries(FARAID_ACTION_TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <input
                  className="sf-input w-full text-sm"
                  placeholder="Titre (ex. Attribution maison familiale)"
                  value={form.action_title}
                  disabled={busy}
                  onChange={(e) => setForm({ ...form, action_title: e.target.value })}
                />
                <textarea
                  className="sf-input min-h-[64px] w-full text-sm"
                  placeholder="Description détaillée"
                  value={form.action_description}
                  disabled={busy}
                  onChange={(e) => setForm({ ...form, action_description: e.target.value })}
                />
                <select
                  className="sf-input w-full text-sm"
                  value={form.action_asset_id}
                  disabled={busy}
                  onChange={(e) => setForm({ ...form, action_asset_id: e.target.value })}
                >
                  <option value="">Bien concerné (optionnel)</option>
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <input
                  className="sf-input w-full text-sm"
                  type="number"
                  min="0"
                  placeholder={`Montant (${currency})`}
                  value={form.action_amount}
                  disabled={busy}
                  onChange={(e) => setForm({ ...form, action_amount: e.target.value })}
                />
                <button
                  type="button"
                  className="sf-btn-secondary text-sm"
                  disabled={busy || !form.action_title.trim()}
                  onClick={() => void onAddAction(form)}
                >
                  + Ajouter cette action
                </button>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
