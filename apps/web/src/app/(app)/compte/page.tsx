"use client";

import { FormEvent, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { ApiError, changePassword } from "@/lib/api";
import { formatDateTime, ROLE_LABELS } from "@/lib/labels";
import { useAuth } from "@/providers/auth-provider";

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-[var(--sf-green)]/50 uppercase">
        {label}
      </p>
      <p className="mt-1 rounded-lg border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 px-3 py-2.5 text-sm text-[var(--sf-green-deep)]">
        {value || "—"}
      </p>
    </div>
  );
}

export default function ComptePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (!user) return null;

  const displayName =
    user.profile?.display_name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.username;

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (newPassword !== confirmPassword) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Le nouveau mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Mot de passe mis à jour. Utilisez-le à votre prochaine connexion.");
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de modifier le mot de passe.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="sf-display text-2xl font-semibold text-[var(--sf-green-deep)]">
          Mon compte
        </h1>
        <p className="mt-2 text-sm text-[var(--sf-green)]/60">
          Vos informations sont gérées par l&apos;administration. Seul le mot de passe
          peut être modifié ici.
        </p>
      </div>

      <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
          Identité
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <ReadOnlyField label="Nom affiché" value={displayName} />
          <ReadOnlyField
            label="Identifiant de connexion"
            value={`${user.username} (lettre = profil, non modifiable)`}
          />
          <ReadOnlyField label="Prénom" value={user.first_name} />
          <ReadOnlyField label="Nom" value={user.last_name} />
          <ReadOnlyField label="E-mail" value={user.email} />
          <ReadOnlyField label="Téléphone" value={user.profile?.phone ?? ""} />
          <ReadOnlyField label="Fuseau horaire" value={user.profile?.timezone ?? ""} />
          <ReadOnlyField label="Langue" value={user.profile?.locale ?? ""} />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
          Rôles et accès
        </h2>
        <ul className="mt-3 flex flex-wrap gap-2">
          {user.roles.length > 0 ? (
            user.roles.map((role) => (
              <li
                key={role}
                className="rounded-full bg-[var(--sf-green)]/10 px-3 py-1 text-xs font-medium text-[var(--sf-green-deep)]"
              >
                {ROLE_LABELS[role] ?? role}
              </li>
            ))
          ) : (
            <li className="text-sm text-[var(--sf-green)]/50">Aucun rôle métier assigné</li>
          )}
        </ul>
        {user.profile?.created_at ? (
          <p className="mt-4 text-xs text-[var(--sf-green)]/45">
            Profil créé le {formatDateTime(user.profile.created_at)}
          </p>
        ) : null}
      </section>

      <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-[var(--sf-green-deep)]">
          Modifier le mot de passe
        </h2>
        <p className="mt-1 text-xs text-[var(--sf-green)]/50">
          La connexion reste protégée par code à 6 chiffres envoyé par e-mail après
          votre mot de passe.
        </p>

        {success ? (
          <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
            {success}
          </p>
        ) : null}
        {error ? (
          <div className="mt-4">
            <ErrorAlert message={error} />
          </div>
        ) : null}

        <form onSubmit={handlePasswordChange} className="mt-4 space-y-4">
          <div>
            <label
              htmlFor="current-password"
              className="block text-sm font-medium text-[var(--sf-green-deep)]"
            >
              Mot de passe actuel
            </label>
            <input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="sf-input mt-1 w-full"
            />
          </div>
          <div>
            <label
              htmlFor="new-password"
              className="block text-sm font-medium text-[var(--sf-green-deep)]"
            >
              Nouveau mot de passe
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="sf-input mt-1 w-full"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-sm font-medium text-[var(--sf-green-deep)]"
            >
              Confirmer le nouveau mot de passe
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="sf-input mt-1 w-full"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="sf-btn-primary disabled:opacity-60"
          >
            {submitting ? "Enregistrement…" : "Enregistrer le mot de passe"}
          </button>
        </form>
      </section>
    </div>
  );
}
