"use client";

import { use, useEffect, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { usePlatformPermissions } from "@/hooks/use-platform-permissions";
import { ApiError, apiRequest } from "@/lib/api";
import type { WaqfProfile } from "@/types/api";

export default function CaseWaqfPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { canWriteCase } = usePlatformPermissions();
  const [profile, setProfile] = useState<WaqfProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiRequest<WaqfProfile>(`/cases/${id}/waqf/`)
      .then(setProfile)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, [id]);

  async function save() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await apiRequest<WaqfProfile>(`/cases/${id}/waqf/`, {
        method: "PATCH",
        body: JSON.stringify({
          waqf_type: profile.waqf_type,
          waqf_object: profile.waqf_object,
          waqf_distribution_rules: profile.waqf_distribution_rules,
        }),
      });
      setProfile(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (error && !profile) return <ErrorAlert message={error} />;
  if (!profile) return <ErrorAlert message="Profil waqf introuvable." />;

  const readOnly = !canWriteCase;

  return (
    <div className="max-w-2xl space-y-4">
      {error ? <ErrorAlert message={error} /> : null}
      <label className="block text-sm">
        Type de waqf
        <select
          value={profile.waqf_type}
          onChange={(e) => setProfile({ ...profile, waqf_type: e.target.value })}
          disabled={readOnly}
          className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 disabled:opacity-70"
        >
          <option value="FAMILY">Familial</option>
          <option value="PRODUCTIVE">Productif</option>
          <option value="MIXED">Mixte</option>
        </select>
      </label>
      <label className="block text-sm">
        Objet du waqf
        <textarea
          value={profile.waqf_object}
          onChange={(e) => setProfile({ ...profile, waqf_object: e.target.value })}
          disabled={readOnly}
          rows={3}
          className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 disabled:opacity-70"
        />
      </label>
      <label className="block text-sm">
        Règles de distribution
        <textarea
          value={profile.waqf_distribution_rules}
          onChange={(e) =>
            setProfile({ ...profile, waqf_distribution_rules: e.target.value })
          }
          disabled={readOnly}
          rows={4}
          className="mt-1 w-full rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 disabled:opacity-70"
        />
      </label>
      {canWriteCase ? (
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-[var(--sf-green-deep)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Enregistrement…" : "Enregistrer"}
        </button>
      ) : null}
    </div>
  );
}
