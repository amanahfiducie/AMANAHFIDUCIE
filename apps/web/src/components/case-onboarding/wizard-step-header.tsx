export function WizardStepHeader({
  title,
  description,
  stepIndex,
  totalSteps,
}: {
  title: string;
  description: string;
  stepIndex?: number;
  totalSteps?: number;
}) {
  return (
    <header className="mb-8 border-b border-[var(--sf-cream-dark)] pb-6">
      <div className="flex flex-wrap items-start gap-4">
        {stepIndex != null && totalSteps != null ? (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--sf-green-deep)] text-white shadow-sm"
            aria-hidden
          >
            <span className="sf-display text-lg font-semibold leading-none">
              {stepIndex}
            </span>
            <span className="sr-only">
              {" "}
              sur {totalSteps}
            </span>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-[var(--sf-green)]/50">
            {stepIndex != null && totalSteps != null
              ? `Étape ${stepIndex} sur ${totalSteps}`
              : "Enregistrement"}
          </p>
          <h2 className="sf-display mt-1 text-2xl font-semibold tracking-tight text-[var(--sf-green-deep)]">
            {title}
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-relaxed text-[var(--sf-green)]/65">
            {description}
          </p>
        </div>
      </div>
    </header>
  );
}
