"use client";

import { useState } from "react";

import { UsersAdminList } from "@/components/admin/users-admin-list";

export default function AdminUtilisateursExternesPage() {
  const [success, setSuccess] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {success ? (
        <div
          className="rounded-xl border border-[var(--sf-green-mid)]/30 bg-[var(--sf-green)]/5 px-4 py-3 text-sm text-[var(--sf-green-deep)]"
          role="status"
        >
          {success}
        </div>
      ) : null}
      <UsersAdminList
        preset={{
          title: "Parties externes",
          description:
            "Famille / tuteurs, notaires et juridictions. Chaque compte accède au tableau de bord de ses dossiers ; s'il en a plusieurs, il peut basculer entre eux dans le portail.",
          fixedParams: { scope: "external" },
          roleOptions: "external",
          showProfileTypeFilter: true,
        }}
        onSuccess={setSuccess}
      />
    </div>
  );
}
