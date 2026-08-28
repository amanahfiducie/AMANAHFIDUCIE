/** Rôle de l'héritier dans le calcul farāʾiḍ (de cujus = défunt, non héritier). */
export type FaraidHeirRole =
  | "HUSBAND"
  | "WIFE"
  | "SON"
  | "DAUGHTER"
  | "FATHER"
  | "MOTHER"
  | "GRANDFATHER"
  | "GRANDMOTHER"
  | "BROTHER_FULL"
  | "SISTER_FULL"
  | "BROTHER_PATERNAL"
  | "SISTER_PATERNAL"
  | "BROTHER_MATERNAL"
  | "SISTER_MATERNAL"
  | "GRANDSON"
  | "GRANDDAUGHTER";

export type DeceasedGender = "M" | "F";

export type SuccessionHeirInput = {
  id: string;
  name: string;
  role: FaraidHeirRole;
  beneficiaryId?: number | null;
};

export type SuccessionState = {
  deceasedGender: DeceasedGender;
  grossEstate: string;
  debts: string;
  funeralExpenses: string;
  heirs: SuccessionHeirInput[];
  faraidCompleted: boolean;
  activePhase: "evaluation" | "partage";
  currentStepIndex: number;
};

export type FaraidFraction = {
  numerator: number;
  denominator: number;
};

export type FaraidShareResult = {
  heirId: string;
  name: string;
  role: FaraidHeirRole;
  roleLabel: string;
  fraction: FaraidFraction;
  sharePercent: number;
  amount: number;
  shareType: "fard" | "asaba" | "radd" | "awl";
  explanation: string;
};

export type FaraidQuranStep = {
  id: string;
  title: string;
  verseRef: string;
  verseExcerpt: string;
  instruction: string;
  status: "pending" | "current" | "done";
};

export type FaraidCalculationResult = {
  netEstate: number;
  currency: string;
  shares: FaraidShareResult[];
  quranSteps: FaraidQuranStep[];
  warnings: string[];
  totalFraction: FaraidFraction;
  isBalanced: boolean;
};
