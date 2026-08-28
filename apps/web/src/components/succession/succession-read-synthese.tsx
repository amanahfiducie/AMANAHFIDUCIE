"use client";

import Link from "next/link";

import { ErrorAlert } from "@/components/ui/error-alert";
import { LoadingState } from "@/components/ui/loading";
import { useSuccessionSession } from "@/hooks/use-succession-session";
import { usePlatformPermissions } from "@/hooks/use-platform-permissions";
import { formatMoney } from "@/lib/labels";

function StatusBadge({
  label,
  tone,
}: {
  label: string;
  tone: "ok" | "pending" | "warn";
}) {
  const cls =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900"
        : "bg-[var(--sf-cream)] text-[var(--sf-green-deep)]";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export function SuccessionReadSynthese({ caseId }: { caseId: string }) {
  const session = useSuccessionSession(caseId);
  const { canWriteCase, isComiteCharaique } = usePlatformPermissions();

  if (session.loading || !session.caseDetail) {
    return <LoadingState label="Chargement de la succession…" />;
  }

  const {
    deceasedName,
    state,
    assets,
    estimatedCount,
    allAssetsEstimated,
    estimatedGross,
    estimationCurrency,
    netEstate,
    faraidReview,
    error,
  } = session;

  const phaseLabel =
    state.activePhase === "partage" ? "Soumission au comité" : "Évaluation patrimoniale";

  let faraidLabel = "Non soumis";
  let faraidTone: "ok" | "pending" | "warn" = "pending";
  if (faraidReview?.status === "FINALIZED") {
    faraidLabel = "Partage finalisé";
    faraidTone = "ok";
  } else if (faraidReview?.requested_at) {
    faraidLabel = "En revue comité";
    faraidTone = "warn";
  }

  return (
    <div className="space-y-6">
      {error ? <ErrorAlert message={error} /> : null}

      <div className="rounded-2xl border border-[var(--sf-green)]/15 bg-gradient-to-br from-[var(--sf-green-deep)] to-[var(--sf-green)] p-6 text-white sm:p-8">
        <p className="text-xs font-semibold tracking-[0.2em] text-[var(--sf-gold-soft)] uppercase">
          Conseil successoral islamique
        </p>
        <h1 className="sf-display mt-2 text-2xl font-semibold sm:text-3xl">
          Synthèse du dossier
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-white/80">
          Vue d&apos;ensemble en lecture seule. Utilisez <strong>Modifier</strong> pour mettre à
          jour l&apos;évaluation ou soumettre au comité charaïque.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <StatusBadge label={phaseLabel} tone={allAssetsEstimated ? "ok" : "pending"} />
        <StatusBadge label={faraidLabel} tone={faraidTone} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Biens inventoriés"
          value={String(assets.length)}
          hint={`${estimatedCount} estimé${estimatedCount > 1 ? "s" : ""}`}
        />
        <MetricCard
          label="Patrimoine brut estimé"
          value={formatMoney(String(estimatedGross), estimationCurrency)}
        />
        <MetricCard
          label="Patrimoine net"
          value={formatMoney(String(netEstate), estimationCurrency)}
          hint="Après dettes et charges"
        />
        <MetricCard
          label="Défunt"
          value={deceasedName}
          hint={state.deceasedGender === "F" ? "Femme" : "Homme"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
          <h2 className="font-semibold text-[var(--sf-green-deep)]">Évaluation patrimoniale</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row label="Dettes" value={state.debts ? formatMoney(state.debts, estimationCurrency) : "—"} />
            <Row
              label="Frais funéraires & charges"
              value={
                state.funeralExpenses
                  ? formatMoney(state.funeralExpenses, estimationCurrency)
                  : "—"
              }
            />
            <Row
              label="Estimations validées"
              value={
                assets.length === 0
                  ? "Aucun bien"
                  : allAssetsEstimated
                    ? "Tous les biens sont estimés"
                    : `${estimatedCount} / ${assets.length} bien${assets.length > 1 ? "s" : ""}`
              }
            />
          </dl>
          <Link
            href={`/dossiers/${caseId}/succession/evaluation`}
            className="mt-4 inline-block text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Voir le détail de l&apos;évaluation →
          </Link>
        </section>

        <section className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-5">
          <h2 className="font-semibold text-[var(--sf-green-deep)]">Partage farāʾiḍ</h2>
          {faraidReview?.status === "FINALIZED" ? (
            <p className="mt-3 text-sm text-[var(--sf-green-deep)]">
              Partage finalisé par le comité charaïque
              {faraidReview.finalized_at
                ? ` le ${new Date(faraidReview.finalized_at).toLocaleDateString("fr-FR")}`
                : ""}
              .
            </p>
          ) : faraidReview?.requested_at ? (
            <p className="mt-3 text-sm text-amber-900">
              Dossier soumis au comité le{" "}
              {new Date(faraidReview.requested_at).toLocaleDateString("fr-FR")}.
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--sf-green)]/65">
              Le dossier n&apos;a pas encore été soumis au comité charaïque.
            </p>
          )}
          <Link
            href={`/dossiers/${caseId}/succession/partage`}
            className="mt-4 inline-block text-sm font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Voir le statut du partage →
          </Link>
        </section>
      </div>

      <p className="text-center text-[11px] text-[var(--sf-green)]/40">
        {isComiteCharaique ? (
          <>
            <Link
              href={`/dossiers/${caseId}/succession/modifier`}
              className="font-medium text-[var(--sf-green-mid)] hover:underline"
            >
              Modifier la succession
            </Link>
            {" · "}
          </>
        ) : null}
        {canWriteCase ? (
          <Link
            href={`/dossiers/${caseId}/enregistrement?step=patrimoine`}
            className="font-medium text-[var(--sf-green-mid)] hover:underline"
          >
            Assistant d&apos;enregistrement
          </Link>
        ) : null}
      </p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--sf-cream-dark)] bg-white p-4">
      <p className="text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--sf-green-deep)]">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-[var(--sf-green)]/50">{hint}</p> : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-[var(--sf-cream)] pb-2 last:border-0">
      <dt className="text-[var(--sf-green)]/60">{label}</dt>
      <dd className="text-right font-medium text-[var(--sf-green-deep)]">{value}</dd>
    </div>
  );
}
