"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ValidationQueuePanel } from "@/components/validation-queue-panel";
import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { ApiError, apiRequest } from "@/lib/api";
import { formatMoney } from "@/lib/labels";
import type { FinanceMovementOverview, FiduciaryAccountListItem } from "@/types/api";

export default function ComptableFiduciairePage() {
  const [movements, setMovements] = useState<FinanceMovementOverview[]>([]);
  const [accounts, setAccounts] = useState<FiduciaryAccountListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      apiRequest<FinanceMovementOverview[]>(
        "/finance/movements/?status=PENDING_VALIDATION,DRAFT&limit=15",
      ),
      apiRequest<FiduciaryAccountListItem[]>("/finance/accounts/"),
    ])
      .then(([m, a]) => {
        setMovements(m);
        setAccounts(a.slice(0, 10));
      })
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Chargement impossible."),
      )
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingState />;

  return (
    <div className="mt-6 space-y-8">
      <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/25 px-4 py-3 text-sm text-[var(--sf-green-deep)]">
        <strong>Fonds fiduciaires</strong> — comptes séparés par dossier mandat. Ce périmètre est
        distinct de la comptabilité générale SOFIGEPAM (onglets Comptes / Mouvements).
      </div>

      {error ? <ErrorAlert message={error} /> : null}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-[var(--sf-green-deep)]">
          Validations comptables (mouvements dossiers)
        </h2>
        <ValidationQueuePanel validationTypeFilter="ACCOUNTING" />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--sf-green-deep)]">
          Mouvements dossiers en attente
        </h2>
        {movements.length === 0 ? (
          <p className="text-sm text-[var(--sf-green)]/55">Aucun mouvement en attente.</p>
        ) : (
          <ul className="space-y-2">
            {movements.map((m) => (
              <li key={m.id}>
                <Link
                  href={`/dossiers/${m.case_id}/finance`}
                  className="flex flex-wrap justify-between gap-2 rounded-lg border border-[var(--sf-cream-dark)] bg-white px-4 py-3 text-sm hover:border-[var(--sf-green)]/25"
                >
                  <span>
                    <span className="font-medium">{m.case_reference}</span>
                    {" · "}
                    {m.account_name}
                  </span>
                  <span className="font-mono">{formatMoney(m.amount, m.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[var(--sf-green-deep)]">
          Comptes fiduciaires récents
        </h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-[var(--sf-green)]/55">Aucun compte fiduciaire.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {accounts.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/dossiers/${a.case}/finance`}
                  className="flex justify-between rounded-lg border border-[var(--sf-cream-dark)] bg-white px-4 py-2 hover:border-[var(--sf-green)]/25"
                >
                  <span>
                    Dossier #{a.case} — {a.name}
                  </span>
                  <span className="font-mono">
                    {formatMoney(a.current_balance, a.currency)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
