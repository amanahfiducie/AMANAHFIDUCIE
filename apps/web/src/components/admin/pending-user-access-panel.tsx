"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import {
  ApiError,
  approveUserAccessRequest,
  listUserAccessRequests,
  previewUserAccessRequest,
  rejectUserAccessRequest,
} from "@/lib/api";
import type { ProfileAccessPreview, ProfileUserAccessRequestItem } from "@/types/api";

const PREVIEW_HINTS: Record<string, string> = {
  no_user: "Nouveau compte à créer",
  user_exists: "Compte existant — confirmation requise",
  missing_email: "E-mail à renseigner",
  already_in_case: "Déjà dans le dossier",
};

function RequestRow({
  item,
  onDone,
}: {
  item: ProfileUserAccessRequestItem;
  onDone: () => void;
}) {
  const [email, setEmail] = useState(item.email);
  const [preview, setPreview] = useState<ProfileAccessPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded || preview) return;
    setLoadingPreview(true);
    previewUserAccessRequest(item.id)
      .then((data) => {
        setPreview(data);
        if (data.suggested_email && !email) {
          setEmail(data.suggested_email);
        }
      })
      .catch(() => setPreview(null))
      .finally(() => setLoadingPreview(false));
  }, [expanded, item.id, email, preview]);

  async function handleApprove(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await approveUserAccessRequest(item.id, {
        email: email.trim(),
        confirm_add_existing: preview?.status === "user_exists",
      });
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setPreview((p) =>
          p ? { ...p, status: "user_exists", message: err.message } : p,
        );
        setError("Confirmez l'ajout au dossier (compte existant).");
      } else {
        setError(err instanceof ApiError ? err.message : "Validation impossible.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject() {
    setSubmitting(true);
    setError(null);
    try {
      await rejectUserAccessRequest(item.id);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Refus impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[var(--sf-green-deep)]">{item.display_name}</p>
          <p className="mt-1 text-sm text-[var(--sf-green)]/70">
            {item.profile_type_label} · dossier{" "}
            <span className="font-mono">{item.case_reference}</span> — {item.case_title}
          </p>
          {item.phone ? (
            <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">Tél. {item.phone}</p>
          ) : null}
          <p className="mt-1 text-xs text-[var(--sf-green)]/45">
            {PREVIEW_HINTS[item.preview_status] ?? item.preview_status}
            {item.existing_user_username
              ? ` · compte ${item.existing_user_username}`
              : ""}
          </p>
        </div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "Réduire" : "Traiter"}
        </Button>
      </div>

      {expanded ? (
        <form onSubmit={handleApprove} className="mt-4 space-y-3 border-t border-[var(--sf-cream-dark)] pt-4">
          {loadingPreview ? (
            <p className="text-sm text-[var(--sf-green)]/50">Vérification…</p>
          ) : preview ? (
            <p className="rounded-lg bg-[var(--sf-cream)]/40 px-3 py-2 text-sm text-[var(--sf-green-deep)]">
              {preview.message}
            </p>
          ) : null}

          {item.preview_status !== "already_in_case" ? (
            <div>
              <label className="text-sm font-medium text-[var(--sf-green-deep)]">
                E-mail pour le compte <span className="text-red-600">*</span>
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="sf-input mt-1.5 w-full"
                placeholder="ex. utilisateur@example.com"
              />
            </div>
          ) : null}

          {error ? <ErrorAlert message={error} /> : null}

          <div className="flex flex-wrap gap-2">
            {item.preview_status !== "already_in_case" ? (
              <Button type="submit" variant="gold" disabled={submitting}>
                {submitting
                  ? "…"
                  : preview?.status === "user_exists"
                    ? "Valider et ajouter au dossier"
                    : "Créer le compte et envoyer l'e-mail"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={handleReject}
            >
              Refuser
            </Button>
          </div>
        </form>
      ) : null}
    </li>
  );
}

export function PendingUserAccessPanel() {
  const [items, setItems] = useState<ProfileUserAccessRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listUserAccessRequests("PENDING");
      setItems(data);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Impossible de charger les demandes en attente.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--sf-green-deep)]">
            Comptes à valider
          </h2>
          <p className="mt-1 text-sm text-[var(--sf-green)]/60">
            Profils enregistrés dans un dossier (héritiers majeurs, tuteurs, personnes de
            confiance). Les mineurs ne sont pas listés — validez le tuteur associé.
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={() => void load()}>
          Actualiser
        </Button>
      </div>

      {error ? (
        <div className="mt-4">
          <ErrorAlert message={error} />
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6">
          <LoadingState label="Chargement des demandes…" />
        </div>
      ) : items.length === 0 ? (
        <p className="mt-6 text-sm text-[var(--sf-green)]/50">
          Aucune demande en attente pour le moment.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {items.map((item) => (
            <RequestRow key={item.id} item={item} onDone={load} />
          ))}
        </ul>
      )}
    </Card>
  );
}
