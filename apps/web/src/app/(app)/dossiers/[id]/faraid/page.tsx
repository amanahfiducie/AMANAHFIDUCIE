"use client";

import { use, useEffect, useState } from "react";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { usePlatformPermissions } from "@/hooks/use-platform-permissions";
import { ApiError, apiRequest } from "@/lib/api";
import type { FaraidHeir } from "@/types/api";

export default function CaseFaraidPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { canWriteCase } = usePlatformPermissions();
  const [heirs, setHeirs] = useState<FaraidHeir[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [share, setShare] = useState("");

  function load() {
    setLoading(true);
    apiRequest<FaraidHeir[]>(`/cases/${id}/faraid-heirs/`)
      .then(setHeirs)
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addHeir() {
    if (!name.trim()) return;
    setError(null);
    try {
      await apiRequest<FaraidHeir>(`/cases/${id}/faraid-heirs/`, {
        method: "POST",
        body: JSON.stringify({
          full_name: name.trim(),
          relationship_label: relationship.trim(),
          share_fraction: share || "0",
        }),
      });
      setName("");
      setRelationship("");
      setShare("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Ajout impossible.");
    }
  }

  if (loading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      {canWriteCase ? (
        <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4">
          <h2 className="font-semibold text-[var(--sf-green-deep)]">Héritier théorique</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="min-w-[160px] flex-1 rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              placeholder="Nom complet"
            />
            <input
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              className="min-w-[120px] rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              placeholder="Lien (ex. fils)"
            />
            <input
              value={share}
              onChange={(e) => setShare(e.target.value)}
              className="w-28 rounded-lg border border-[var(--sf-cream-dark)] px-3 py-2 text-sm"
              placeholder="Fraction"
            />
            <button
              type="button"
              onClick={addHeir}
              className="rounded-lg bg-[var(--sf-green-deep)] px-4 py-2 text-sm font-medium text-white"
            >
              Ajouter
            </button>
          </div>
        </section>
      ) : null}

      <ul className="space-y-2">
        {heirs.map((h) => (
          <li
            key={h.id}
            className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-4 py-3 text-sm"
          >
            <span className="font-medium">{h.full_name}</span>
            {h.relationship_label ? ` (${h.relationship_label})` : null}
            {" — "}
            {(Number(h.share_fraction) * 100).toFixed(2)} %
          </li>
        ))}
      </ul>
    </div>
  );
}
