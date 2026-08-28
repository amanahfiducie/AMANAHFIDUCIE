import type { SuccessionState } from "@/lib/faraid/types";

export const defaultSuccessionState = (): SuccessionState => ({
  deceasedGender: "M",
  grossEstate: "",
  debts: "",
  funeralExpenses: "",
  heirs: [],
  faraidCompleted: false,
  activePhase: "evaluation",
  currentStepIndex: 0,
});

export function parseSuccessionFromOnboarding(
  onboardingData: Record<string, unknown> | undefined,
): SuccessionState {
  const raw = onboardingData?.succession;
  if (!raw || typeof raw !== "object") return defaultSuccessionState();
  const s = raw as Record<string, unknown>;
  return {
    deceasedGender: s.deceasedGender === "F" ? "F" : "M",
    grossEstate: typeof s.grossEstate === "string" ? s.grossEstate : "",
    debts: typeof s.debts === "string" ? s.debts : "",
    funeralExpenses: typeof s.funeralExpenses === "string" ? s.funeralExpenses : "",
    heirs: Array.isArray(s.heirs) ? (s.heirs as SuccessionState["heirs"]) : [],
    faraidCompleted: s.faraidCompleted === true,
    activePhase: s.activePhase === "partage" ? "partage" : "evaluation",
    currentStepIndex:
      typeof s.currentStepIndex === "number" ? s.currentStepIndex : 0,
  };
}

export function successionToOnboardingPatch(state: SuccessionState): Record<string, unknown> {
  return {
    succession: { ...state },
    faraid_completed: state.faraidCompleted,
  };
}

/** Patrimoine net = somme des estimations validées (avec justificatif) − dettes − charges. */
export function computeNetEstate(
  state: SuccessionState,
  estimatedAssetsGross: number,
): number {
  const gross = estimatedAssetsGross;
  const debts = Number(state.debts) || 0;
  const funeral = Number(state.funeralExpenses) || 0;
  const net = gross - debts - funeral;
  return Number.isFinite(net) && net > 0 ? net : 0;
}
