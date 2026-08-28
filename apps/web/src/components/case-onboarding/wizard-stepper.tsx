import type { OnboardingStepProgress } from "@/lib/case-onboarding";

/** Échelle type Dock macOS : plus proche de l'étape courante = plus grand. */
function scaleForDistance(distance: number): number {
  const scales = [1.14, 1.02, 0.9, 0.8, 0.72, 0.66, 0.62];
  return scales[Math.min(distance, scales.length - 1)] ?? 0.58;
}

export function WizardStepper({
  steps,
  currentId,
  stepStatuses,
}: {
  steps: { id: string; label: string }[];
  currentId: string;
  stepStatuses?: Pick<OnboardingStepProgress, "id" | "status">[];
}) {
  const currentIndex = Math.max(0, steps.findIndex((s) => s.id === currentId));
  const lastIndex = Math.max(steps.length - 1, 1);

  function statusFor(stepId: string): "completed" | "skipped" | "pending" | null {
    const found = stepStatuses?.find((s) => s.id === stepId);
    return found?.status ?? null;
  }

  /** Avancement visuel aligné sur la section affichée (pas seulement l'API). */
  const progressRatio =
    steps.length <= 1 ? 1 : currentIndex / lastIndex;

  return (
    <nav aria-label="Progression" className="mb-8">
      <div className="relative px-2 pb-1 pt-2">
        {/* Trait de liaison — fond */}
        <div
          className="pointer-events-none absolute left-6 right-6 top-[calc(50%+0.25rem)] h-[2px] -translate-y-1/2 rounded-full bg-[var(--sf-cream-dark)]"
          aria-hidden
        />
        {/* Trait rempli jusqu'à l'étape en cours */}
        <div
          className="pointer-events-none absolute left-6 top-[calc(50%+0.25rem)] h-[2px] -translate-y-1/2 rounded-full bg-[var(--sf-green-mid)] transition-all duration-500 ease-out"
          style={{
            width: `calc((100% - 3rem) * ${progressRatio})`,
          }}
          aria-hidden
        />

        <ol className="relative flex items-end justify-between gap-0">
          {steps.map((step, index) => {
            const apiStatus = statusFor(step.id);
            const active = step.id === currentId;
            const skipped = apiStatus === "skipped";
            const done =
              apiStatus === "completed"
              || (apiStatus === null && index < currentIndex);
            const distance = Math.abs(index - currentIndex);
            const scale = scaleForDistance(distance);

            return (
              <li
                key={step.id}
                className="relative z-[1] flex min-w-0 flex-1 flex-col items-center"
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: "bottom center",
                  transition: "transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1)",
                }}
                aria-current={active ? "step" : undefined}
              >
                <button
                  type="button"
                  disabled
                  tabIndex={-1}
                  className={`group flex flex-col items-center gap-1.5 rounded-xl px-1 py-1 transition-colors sm:px-2 ${
                    active ? "cursor-default" : "cursor-default"
                  }`}
                  aria-label={`${step.label}${active ? " (étape en cours)" : done ? " (terminée)" : ""}`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold shadow-sm ring-2 ring-offset-2 ring-offset-[var(--sf-cream)] transition-all duration-300 sm:h-10 sm:w-10 ${
                      active
                        ? skipped
                          ? "bg-red-700 text-white ring-red-300"
                          : "bg-[var(--sf-gold)] text-[var(--sf-green-deep)] ring-[var(--sf-green-mid)]/40 shadow-md"
                        : skipped
                          ? "bg-red-600 text-white ring-red-200"
                          : done
                            ? "bg-[var(--sf-green-mid)] text-white ring-[var(--sf-green)]/20"
                            : "bg-white text-[var(--sf-green)]/45 ring-[var(--sf-cream-dark)]"
                    }`}
                  >
                    {skipped ? "!" : done ? "✓" : index + 1}
                  </span>
                  <span
                    className={`max-w-[5.5rem] text-center text-[10px] leading-tight transition-all duration-300 sm:max-w-[7rem] sm:text-xs ${
                      active
                        ? skipped
                          ? "font-semibold text-red-800"
                          : "font-semibold text-[var(--sf-green-deep)]"
                        : skipped
                          ? "text-red-700/80"
                          : done
                            ? "font-medium text-[var(--sf-green-mid)]"
                            : "text-[var(--sf-green)]/40"
                    } ${distance >= 3 ? "hidden md:inline" : distance >= 2 ? "hidden sm:inline" : "inline"}`}
                  >
                    {step.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Barre de progression globale */}
      <div className="mt-4 px-2">
        <div className="mb-1 flex justify-between text-[10px] font-medium uppercase tracking-wide text-[var(--sf-green)]/45 sm:text-xs">
          <span>
            Étape {currentIndex + 1} / {steps.length}
          </span>
          <span>{steps[currentIndex]?.label ?? ""}</span>
        </div>
        <div
          className="h-1.5 overflow-hidden rounded-full bg-[var(--sf-cream-dark)]"
          role="progressbar"
          aria-valuenow={currentIndex + 1}
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-label={`Progression : étape ${currentIndex + 1} sur ${steps.length}`}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--sf-green-mid)] to-[var(--sf-green-deep)] transition-all duration-500 ease-out"
            style={{
              width: `${((currentIndex + 1) / steps.length) * 100}%`,
            }}
          />
        </div>
      </div>
    </nav>
  );
}
