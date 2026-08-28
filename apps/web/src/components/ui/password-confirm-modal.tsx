"use client";

import { useEffect, useId, useState } from "react";

type PasswordConfirmModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  busy?: boolean;
  error?: string | null;
  /** Classe z-index du calque (ex. z-[70] au-dessus d'un autre modal). */
  overlayZClass?: string;
  onClose: () => void;
  onConfirm: (password: string) => void | Promise<void>;
};

export function PasswordConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirmer",
  busy = false,
  error = null,
  overlayZClass = "z-50",
  onClose,
  onConfirm,
}: PasswordConfirmModalProps) {
  const titleId = useId();
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) setPassword("");
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || busy) return;
    await onConfirm(password);
  }

  return (
    <div
      className={`fixed inset-0 ${overlayZClass} flex items-center justify-center bg-black/40 p-4`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onSubmit={(e) => void handleSubmit(e)}
        className="w-full max-w-md rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold text-[var(--sf-green-deep)]">
          {title}
        </h2>
        <p className="mt-1.5 text-sm text-[var(--sf-green)]/60">{description}</p>

        <div className="mt-4">
          <label
            htmlFor="password-confirm-input"
            className="text-xs font-medium uppercase tracking-wide text-[var(--sf-green)]/45"
          >
            Mot de passe
          </label>
          <input
            id="password-confirm-input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="sf-input mt-1.5 w-full"
            placeholder="Votre mot de passe de connexion"
            disabled={busy}
            autoFocus
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="sf-btn-secondary text-sm"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={busy || !password.trim()}
            className="sf-btn-primary text-sm"
          >
            {busy ? "Vérification…" : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
