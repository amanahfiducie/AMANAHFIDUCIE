"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, updateUser } from "@/lib/api";
import {
  ASSIGNABLE_ROLES,
  PARTY_TYPE_OPTIONS,
  ROLE_LABELS,
} from "@/lib/labels";
import type { UpdateUserPayload, UserListItem } from "@/types/api";

type EditUserDialogProps = {
  user: UserListItem;
  open: boolean;
  onClose: () => void;
  onSaved: (user: UserListItem) => void;
};

export function EditUserDialog({
  user,
  open,
  onClose,
  onSaved,
}: EditUserDialogProps) {
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.profile?.phone ?? "");
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [displayName, setDisplayName] = useState(user.profile?.display_name ?? "");
  const [isStaff, setIsStaff] = useState(user.is_staff);
  const [isActive, setIsActive] = useState(user.is_active);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(user.roles);
  const [partyType, setPartyType] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsPartyType = selectedRoles.includes("FAMILLE_TUTEUR");

  useEffect(() => {
    if (!open) return;
    setEmail(user.email);
    setPhone(user.profile?.phone ?? "");
    setFirstName(user.first_name);
    setLastName(user.last_name);
    setDisplayName(user.profile?.display_name ?? "");
    setIsStaff(user.is_staff);
    setIsActive(user.is_active);
    setSelectedRoles(user.roles);
    setPartyType("");
    setError(null);
  }, [open, user]);

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (selectedRoles.length === 0) {
      setError("Sélectionnez au moins un rôle métier.");
      return;
    }
    if (needsPartyType && !partyType) {
      setError("Indiquez Famille ou Tuteur pour ce profil.");
      return;
    }
    setSubmitting(true);
    try {
      const payload: UpdateUserPayload = {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_staff: isStaff,
        is_active: isActive,
        roles: selectedRoles,
        profile: {
          phone: phone.trim(),
          display_name: displayName.trim(),
        },
      };
      if (needsPartyType && partyType) {
        payload.party_type = partyType;
      }
      const updated = await updateUser(user.id, payload);
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer les modifications.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--sf-cream-dark)] bg-white shadow-xl"
        role="dialog"
        aria-labelledby="edit-user-title"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="p-6">
          <h2
            id="edit-user-title"
            className="text-lg font-semibold text-[var(--sf-green-deep)]"
          >
            Modifier le compte
          </h2>
          <p className="mt-1 font-mono text-sm text-[var(--sf-green)]/70">
            {user.username}
          </p>

          {error ? (
            <div className="mt-4">
              <ErrorAlert message={error} />
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--sf-green-deep)]">
                  Prénom
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--sf-green-deep)]">
                  Nom
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--sf-green-deep)]">
                Nom affiché
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--sf-green-deep)]">
                E-mail
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--sf-green-deep)]">
                Téléphone
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              />
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--sf-green-deep)]">Rôles métier</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {ASSIGNABLE_ROLES.map((role) => (
                  <label
                    key={role}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/20 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="rounded border-[var(--sf-cream-dark)] text-[var(--sf-green-mid)]"
                    />
                    {ROLE_LABELS[role] ?? role}
                  </label>
                ))}
              </div>
            </div>

            {needsPartyType ? (
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--sf-green-deep)]">
                  Type famille / tuteur
                </label>
                <select
                  value={partyType}
                  onChange={(e) => setPartyType(e.target.value)}
                  className="w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
                >
                  <option value="">Choisir…</option>
                  {PARTY_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--sf-green-deep)]">
              <input
                type="checkbox"
                checked={isStaff}
                onChange={(e) => setIsStaff(e.target.checked)}
                className="rounded border-[var(--sf-cream-dark)]"
              />
              Accès interface d&apos;administration Django (is_staff)
            </label>

            <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--sf-green-deep)]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded border-[var(--sf-cream-dark)]"
              />
              Compte actif (décocher pour bloquer la connexion)
            </label>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button type="submit" variant="gold" disabled={submitting}>
              {submitting ? "Enregistrement…" : "Enregistrer"}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
