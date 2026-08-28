"use client";

import Link from "next/link";

export default function AuditOverviewPage() {
  return (
    <div className="mt-6 space-y-4 rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 p-5 text-sm text-[var(--sf-green)]/70">
      <p>
        Consultez le journal d&apos;audit global pour suivre les actions sensibles sur les
        dossiers, mouvements, validations et rapports.
      </p>
      <Link
        href="/audit/logs"
        className="inline-flex rounded-lg bg-[var(--sf-green-deep)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
      >
        Ouvrir le journal
      </Link>
    </div>
  );
}
