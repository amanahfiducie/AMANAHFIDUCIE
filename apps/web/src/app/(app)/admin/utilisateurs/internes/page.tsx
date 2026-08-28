"use client";

import { useState } from "react";

import { UsersAdminList } from "@/components/admin/users-admin-list";

export default function AdminUtilisateursInternesPage() {
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
          title: "Équipe interne",
          description:
            "Direction, agents fiduciaires, juridique, comptabilité, comité charaïque et audit.",
          fixedParams: { scope: "internal" },
          roleOptions: "internal",
          showProfileTypeFilter: false,
        }}
        onSuccess={setSuccess}
      />
    </div>
  );
}
