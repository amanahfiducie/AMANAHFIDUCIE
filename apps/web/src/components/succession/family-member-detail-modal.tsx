"use client";

import { useEffect, useState } from "react";

import { PasswordConfirmModal } from "@/components/ui/password-confirm-modal";
import { ApiError, apiRequest, verifyPassword } from "@/lib/api";
import {
  buildSmartRelationPayload,
  childNeedsMotherSelect,
  findFemaleSpouses,
  formatMemberCardLabel,
  beneficiaryToSmartRelationValue,
  getAvailableSmartRelations,
  smartRelationFormValid,
} from "@/lib/succession/family-relations";
import type { Beneficiary } from "@/types/api";

type EditFormState = {
  first_name: string;
  last_name: string;
  relation_to_donor: string;
  father_id: string;
  mother_id: string;
  date_of_birth: string;
  nationality: string;
  identification_number: string;
  notes: string;
};

type PendingAction = "save" | "delete";

function beneficiaryToForm(b: Beneficiary): EditFormState {
  return {
    first_name: b.first_name,
    last_name: b.last_name,
    relation_to_donor: beneficiaryToSmartRelationValue(b),
    father_id: b.father ? String(b.father) : "",
    mother_id: b.mother ? String(b.mother) : "",
    date_of_birth: b.date_of_birth ?? "",
    nationality: b.nationality ?? "",
    identification_number: b.identification_number ?? "",
    notes: b.notes ?? "",
  };
}

function formToPatchBody(
  form: EditFormState,
  donorId: number | null,
  existing: Beneficiary[],
  memberId: number,
): Record<string, unknown> {
  const others = existing.filter((m) => m.id !== memberId);
  const payload = buildSmartRelationPayload(form, donorId, others);
  if (payload) return payload;
  return {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    date_of_birth: form.date_of_birth || null,
    nationality: form.nationality.trim(),
    identification_number: form.identification_number.trim(),
    notes: form.notes.trim(),
  };
}

export function FamilyMemberDetailModal({
  open,
  member,
  allMembers,
  donorId,
  onClose,
  onUpdated,
}: {
  open: boolean;
  member: Beneficiary | null;
  allMembers: Beneficiary[];
  donorId: number | null;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [form, setForm] = useState<EditFormState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !member) {
      setForm(null);
      setError(null);
      setPasswordOpen(false);
      setPendingAction(null);
      setPasswordError(null);
      return;
    }
    setForm(beneficiaryToForm(member));
    setError(null);
    setPasswordOpen(false);
    setPendingAction(null);
    setPasswordError(null);
  }, [open, member]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !passwordBusy && !passwordOpen) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose, passwordBusy, passwordOpen]);

  if (!open || !member || !form) return null;

  const others = allMembers.filter((m) => m.id !== member.id);
  const relationOptions = getAvailableSmartRelations([
    ...others,
    ...(member.relation_to_donor === "SPOUSE" || member.relation_to_donor === "PARENT"
      ? [member]
      : []),
  ]);
  const currentRelationOption = beneficiaryToSmartRelationValue(member);
  const relationSelectOptions = [
    ...relationOptions,
    ...(currentRelationOption &&
    !relationOptions.some((o) => o.value === currentRelationOption)
      ? [
          {
            value: currentRelationOption,
            label: formatMemberCardLabel(member),
            group: "direct" as const,
          },
        ]
      : []),
  ];
  const needsMother = childNeedsMotherSelect(form.relation_to_donor, others);
  const wives = findFemaleSpouses(others);
  const canSave = smartRelationFormValid(form, others);

  function requestSave() {
    if (!canSave) return;
    setPendingAction("save");
    setPasswordError(null);
    setPasswordOpen(true);
  }

  function requestDelete() {
    setPendingAction("delete");
    setPasswordError(null);
    setPasswordOpen(true);
  }

  async function confirmPasswordAction(password: string) {
    if (!member || !pendingAction || !form) return;
    setPasswordBusy(true);
    setPasswordError(null);
    try {
      await verifyPassword(password);
      if (pendingAction === "save") {
        await apiRequest(`/beneficiaries/${member.id}/`, {
          method: "PATCH",
          body: JSON.stringify(
            formToPatchBody(form, donorId, allMembers, member.id),
          ),
        });
      } else {
        await apiRequest(`/beneficiaries/${member.id}/`, { method: "DELETE" });
      }
      setPasswordOpen(false);
      setPendingAction(null);
      onUpdated();
      onClose();
    } catch (e) {
      setPasswordError(
        e instanceof ApiError
          ? e.message
          : pendingAction === "save"
            ? "Mot de passe incorrect ou enregistrement impossible."
            : "Mot de passe incorrect ou suppression impossible.",
      );
    } finally {
      setPasswordBusy(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[60] flex items-center justify-center bg-[var(--sf-green-deep)]/45 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label={`Détail — ${member.first_name} ${member.last_name}`}
        onClick={(e) => {
          if (e.target === e.currentTarget && !passwordBusy && !passwordOpen) onClose();
        }}
      >
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl">
          <div className="border-b border-[var(--sf-cream-dark)] px-5 py-4">
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--sf-green)]/50">
              Fiche membre
            </p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--sf-green-deep)]">
              {member.first_name} {member.last_name}
            </h2>
            <p className="mt-0.5 text-sm text-[var(--sf-green-mid)]">
              {formatMemberCardLabel(member)}
            </p>
          </div>

          <div className="space-y-4 px-5 py-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Prénom *</label>
                <input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  className="sf-input mt-1.5"
                  disabled={passwordBusy}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Nom *</label>
                <input
                  value={form.last_name}
                  onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                  className="sf-input mt-1.5"
                  disabled={passwordBusy}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">Lien avec le défunt</label>
              <select
                value={form.relation_to_donor}
                onChange={(e) => setForm({ ...form, relation_to_donor: e.target.value })}
                className="sf-input mt-1.5"
                disabled={passwordBusy}
              >
                <option value="">— Choisir —</option>
                {relationSelectOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {needsMother ? (
              <div>
                <label className="block text-sm font-medium">Mère de l&apos;enfant *</label>
                <select
                  value={form.mother_id}
                  onChange={(e) => setForm({ ...form, mother_id: e.target.value })}
                  className="sf-input mt-1.5"
                  disabled={passwordBusy}
                >
                  <option value="">— Choisir l&apos;épouse —</option>
                  {wives.map((w) => (
                    <option key={w.id} value={String(w.id)}>
                      {w.first_name} {w.last_name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium">Date de naissance</label>
                <input
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })}
                  className="sf-input mt-1.5"
                  disabled={passwordBusy}
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Nationalité</label>
                <input
                  value={form.nationality}
                  onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                  className="sf-input mt-1.5"
                  disabled={passwordBusy}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium">N° pièce d&apos;identité</label>
              <input
                value={form.identification_number}
                onChange={(e) =>
                  setForm({ ...form, identification_number: e.target.value })
                }
                className="sf-input mt-1.5"
                disabled={passwordBusy}
              />
            </div>

            <div>
              <label className="block text-sm font-medium">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="sf-input mt-1.5 min-h-[72px] resize-y"
                rows={3}
                disabled={passwordBusy}
              />
            </div>

            {error ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--sf-cream-dark)] px-5 py-4">
            <button
              type="button"
              onClick={requestDelete}
              disabled={passwordBusy}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
            >
              Supprimer
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={passwordBusy}
                className="rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm font-medium text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={requestSave}
                disabled={!canSave || passwordBusy}
                className="rounded-lg bg-[var(--sf-green-deep)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--sf-green)] disabled:opacity-50"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>

      <PasswordConfirmModal
        open={passwordOpen}
        overlayZClass="z-[70]"
        title={
          pendingAction === "delete" ? "Confirmer la suppression" : "Confirmer la modification"
        }
        description={
          pendingAction === "delete"
            ? `Saisissez votre mot de passe pour retirer ${member.first_name} ${member.last_name} de l'arbre.`
            : `Saisissez votre mot de passe pour enregistrer les modifications sur ${member.first_name} ${member.last_name}.`
        }
        confirmLabel={pendingAction === "delete" ? "Supprimer" : "Enregistrer"}
        busy={passwordBusy}
        error={passwordError}
        onClose={() => {
          if (!passwordBusy) {
            setPasswordOpen(false);
            setPendingAction(null);
            setPasswordError(null);
          }
        }}
        onConfirm={confirmPasswordAction}
      />
    </>
  );
}
