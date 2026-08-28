"use client";

export function StepCompletionHints({
  hints,
  canSkip = false,
  className = "",
}: {
  hints: string[];
  /** Affiche la mention « passer l'étape » si l'étape est reportable. */
  canSkip?: boolean;
  className?: string;
}) {
  if (hints.length === 0) return null;

  return (
    <div
      className={`rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 ${className}`}
      role="status"
      aria-live="polite"
    >
      <p className="flex items-start gap-2 font-medium">
        <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>
          ◇
        </span>
        <span>
          Éléments obligatoires encore manquants pour cette étape&nbsp;:
        </span>
      </p>
      <ul className="mt-2 list-inside list-disc space-y-1 pl-6 text-amber-900/90">
        {hints.map((hint) => (
          <li key={hint}>{hint}</li>
        ))}
      </ul>
      {canSkip ? (
        <p className="mt-2 text-xs text-amber-800/75">
          Vous pouvez reporter cette étape et la compléter plus tard depuis le dossier.
        </p>
      ) : null}
    </div>
  );
}
