"use client";

import { useState } from "react";

import { UsersAdminList } from "@/components/admin/users-admin-list";

export default function AdminUtilisateursBloquesPage() {
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
          title: "Comptes bloqués",
          description: "Comptes désactivés — débloquez-les ou supprimez-les si nécessaire.",
          fixedParams: { status: "blocked" },
          roleOptions: "all",
          showProfileTypeFilter: true,
          showStatusFilter: false,
        }}
        onSuccess={setSuccess}
      />
    </div>
  );
}
