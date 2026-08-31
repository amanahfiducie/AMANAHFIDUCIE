"use client";

import { FormEvent, useEffect, useState } from "react";

import { UsersAdminList } from "@/components/admin/users-admin-list";
import { Button } from "@/components/ui/button";
import {
  ASSIGNABLE_ROLES,
  IDENTIFIER_PREFIX_LEGEND,
  PARTY_TYPE_OPTIONS,
  ROLE_LABELS,
} from "@/lib/labels";
import { userCanManageUsers } from "@/lib/role-access";
import { useAuth } from "@/providers/auth-provider";
import { ApiError, createUser } from "@/lib/api";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] bg-white px-3 py-2.5 text-sm text-[var(--sf-green-deep)] outline-none focus:border-[var(--sf-green-mid)] focus:ring-2 focus:ring-[var(--sf-green-mid)]/20";

export default function AdminUtilisateursTousPage() {
  const { user } = useAuth();
  const canManage = userCanManageUsers(user);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [listKey, setListKey] = useState(0);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [partyType, setPartyType] = useState("");
  const [isStaff, setIsStaff] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

  const needsPartyType = selectedRoles.includes("FAMILLE_TUTEUR");

  useEffect(() => {
    if (!showForm) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) closeForm();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [showForm, submitting]);

  function toggleRole(role: string) {
    setSelectedRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );
  }

  function resetForm() {
    setEmail("");
    setPhone("");
    setPassword("");
    setFirstName("");
    setLastName("");
    setPartyType("");
    setIsStaff(false);
    setSelectedRoles([]);
  }

  function closeForm() {
    resetForm();
    setShowForm(false);
    setError(null);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      if (selectedRoles.length === 0) {
        setError("Sélectionnez au moins un rôle métier.");
        setSubmitting(false);
        return;
      }
      const phoneTrimmed = phone.trim();
      if (!phoneTrimmed) {
        setError("Le numéro de téléphone est obligatoire.");
        setSubmitting(false);
        return;
      }
      const created = await createUser({
        email: email.trim(),
        password,
        phone: phoneTrimmed,
        party_type: needsPartyType ? partyType : undefined,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        is_staff: isStaff,
        roles: selectedRoles,
      });
      const welcomeNote =
        "welcome_email_sent" in created && created.welcome_email_sent
          ? " Un e-mail de rappel a été envoyé."
          : "welcome_email_error" in created && created.welcome_email_error
            ? ` (${String(created.welcome_email_error)})`
            : "";
      setSuccess(
        `Identifiant ${created.username} créé. Connexion en 2 étapes : identifiant, mot de passe, puis code OTP.${welcomeNote}`,
      );
      closeForm();
      setListKey((k) => k + 1);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Impossible de créer l'utilisateur.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {canManage ? (
        <div className="flex flex-wrap justify-end gap-3">
          <Button
            type="button"
            variant="gold"
            onClick={() => {
              setShowForm(true);
              setSuccess(null);
              setError(null);
            }}
          >
            Ajouter un utilisateur
          </Button>
        </div>
      ) : null}

      {success ? (
        <div
          className="rounded-xl border border-[var(--sf-green-mid)]/30 bg-[var(--sf-green)]/5 px-4 py-3 text-sm text-[var(--sf-green-deep)]"
          role="status"
        >
          {success}
        </div>
      ) : null}

      <UsersAdminList
        key={listKey}
        preset={{
          title: "Tous les comptes",
          showStatusFilter: true,
          roleOptions: "all",
        }}
        onSuccess={setSuccess}
      />

      {canManage && showForm ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-[var(--sf-green-deep)]/50 p-3 backdrop-blur-[2px] sm:p-4"
          role="presentation"
          onClick={() => {
            if (!submitting) closeForm();
          }}
        >
          <div
            className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-user-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between border-b border-[var(--sf-cream-dark)] px-5 py-4 sm:px-6">
              <div>
                <h2
                  id="create-user-title"
                  className="text-lg font-semibold text-[var(--sf-green-deep)]"
                >
                  Nouvel utilisateur
                </h2>
                <p className="mt-1 text-sm text-[var(--sf-green)]/60">
                  L&apos;identifiant est attribué automatiquement selon le rôle
                  (ex. H000042, F000015).
                </p>
              </div>
              <button
                type="button"
                className="text-sm text-[var(--sf-green-mid)] hover:underline"
                onClick={() => {
                  if (!submitting) closeForm();
                }}
              >
                Fermer
              </button>
            </div>

            <form
              onSubmit={handleCreate}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                {error ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {error}
                  </div>
                ) : null}

                <div className="rounded-lg border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/30 px-4 py-3">
                  <p className="text-xs font-medium text-[var(--sf-green-deep)]">
                    Lettres des identifiants
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--sf-green)]/70">
                    {IDENTIFIER_PREFIX_LEGEND.map(({ letter, label }) => (
                      <li key={letter}>
                        <span className="font-mono font-semibold text-[var(--sf-green-deep)]">
                          {letter}
                        </span>
                        {" — "}
                        {label}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="email"
                      className="text-sm font-medium text-[var(--sf-green-deep)]"
                    >
                      E-mail <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      className={inputClass}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="phone"
                      className="text-sm font-medium text-[var(--sf-green-deep)]"
                    >
                      Téléphone <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="phone"
                      type="tel"
                      className={inputClass}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                      placeholder="+221 77 123 45 67"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="firstName"
                      className="text-sm font-medium text-[var(--sf-green-deep)]"
                    >
                      Prénom
                    </label>
                    <input
                      id="firstName"
                      className={inputClass}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="lastName"
                      className="text-sm font-medium text-[var(--sf-green-deep)]"
                    >
                      Nom
                    </label>
                    <input
                      id="lastName"
                      className={inputClass}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label
                      htmlFor="password"
                      className="text-sm font-medium text-[var(--sf-green-deep)]"
                    >
                      Mot de passe initial <span className="text-red-600">*</span>
                    </label>
                    <input
                      id="password"
                      type="password"
                      className={inputClass}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {needsPartyType ? (
                  <div>
                    <label
                      htmlFor="partyType"
                      className="text-sm font-medium text-[var(--sf-green-deep)]"
                    >
                      Profil famille / tuteur <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="partyType"
                      className={inputClass}
                      value={partyType}
                      onChange={(e) => setPartyType(e.target.value)}
                      required
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

                <div>
                  <p className="text-sm font-medium text-[var(--sf-green-deep)]">
                    Rôles métier
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
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

                <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--sf-green-deep)]">
                  <input
                    type="checkbox"
                    checked={isStaff}
                    onChange={(e) => setIsStaff(e.target.checked)}
                    className="rounded border-[var(--sf-cream-dark)]"
                  />
                  Accès interface d&apos;administration Django (is_staff)
                </label>
              </div>

              <div className="flex shrink-0 flex-wrap gap-3 border-t border-[var(--sf-cream-dark)] px-5 py-4 sm:px-6">
                <Button type="submit" variant="gold" disabled={submitting}>
                  {submitting ? "Création…" : "Créer le compte"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={submitting}
                  onClick={closeForm}
                >
                  Annuler
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
