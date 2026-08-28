import type { FaraidHeirRole } from "@/lib/faraid/types";

export const FARAID_HEIR_ROLE_LABELS: Record<FaraidHeirRole, string> = {
  HUSBAND: "Époux",
  WIFE: "Épouse",
  SON: "Fils",
  DAUGHTER: "Fille",
  FATHER: "Père",
  MOTHER: "Mère",
  GRANDFATHER: "Grand-père",
  GRANDMOTHER: "Grand-mère",
  BROTHER_FULL: "Frère germain",
  SISTER_FULL: "Sœur germaine",
  BROTHER_PATERNAL: "Frère paternel",
  SISTER_PATERNAL: "Sœur paternelle",
  BROTHER_MATERNAL: "Frère utérin",
  SISTER_MATERNAL: "Sœur utérine",
  GRANDSON: "Petit-fils",
  GRANDDAUGHTER: "Petite-fille",
};

export const FARAID_HEIR_ROLES_ORDER: FaraidHeirRole[] = [
  "HUSBAND",
  "WIFE",
  "FATHER",
  "MOTHER",
  "SON",
  "DAUGHTER",
  "GRANDFATHER",
  "GRANDMOTHER",
  "BROTHER_FULL",
  "SISTER_FULL",
  "BROTHER_PATERNAL",
  "SISTER_PATERNAL",
  "BROTHER_MATERNAL",
  "SISTER_MATERNAL",
  "GRANDSON",
  "GRANDDAUGHTER",
];
