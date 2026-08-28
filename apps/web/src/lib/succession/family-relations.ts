import type { FaraidHeirRole } from "@/lib/faraid/types";
import type { Beneficiary } from "@/types/api";

/** Option de lien : le libellé précise le rôle ET le sexe — pas de champ séparé. */
export type SmartRelationOption = {
  value: string;
  label: string;
  group: "direct" | "indirect";
};

/** Valeurs internes : DIRECT:RELATION:GENDER ou INDIRECT:KIND:GENDER */
export const SMART_SUCCESSION_RELATIONS: SmartRelationOption[] = [
  { value: "DIRECT:SPOUSE:F", label: "Épouse du défunt", group: "direct" },
  { value: "DIRECT:SPOUSE:M", label: "Époux du défunt", group: "direct" },
  { value: "DIRECT:CHILD:M", label: "Fils du défunt", group: "direct" },
  { value: "DIRECT:CHILD:F", label: "Fille du défunt", group: "direct" },
  { value: "DIRECT:PARENT:M", label: "Père du défunt", group: "direct" },
  { value: "DIRECT:PARENT:F", label: "Mère du défunt", group: "direct" },
  { value: "DIRECT:SIBLING:M", label: "Frère du défunt", group: "direct" },
  { value: "DIRECT:SIBLING:F", label: "Sœur du défunt", group: "direct" },
  { value: "INDIRECT:GRANDCHILD:M", label: "Petit-fils (descendant d'un héritier)", group: "indirect" },
  { value: "INDIRECT:GRANDCHILD:F", label: "Petite-fille (descendant d'un héritier)", group: "indirect" },
  { value: "INDIRECT:NEPHEW:M", label: "Neveu (enfant d'un frère ou d'une sœur)", group: "indirect" },
  { value: "INDIRECT:NEPHEW:F", label: "Nièce (enfant d'un frère ou d'une sœur)", group: "indirect" },
  { value: "INDIRECT:OTHER:", label: "Autre lien indirect", group: "indirect" },
];

export type ParsedSmartRelation = {
  relationToDonor: string;
  gender: "M" | "F" | null;
  indirectKind: string | null;
  indirectLabel: string | null;
  isDirect: boolean;
  isIndirect: boolean;
  needsParentLink: boolean;
};

const INDIRECT_LABELS: Record<string, string> = {
  GRANDCHILD: "Petit-enfant (descendant d'un héritier)",
  NEPHEW: "Neveu / nièce (enfant d'un frère ou d'une sœur)",
  OTHER: "Autre lien indirect",
};

export function parseSmartRelation(value: string): ParsedSmartRelation | null {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length < 3) return null;

  const [scope, kind, genderRaw] = parts;
  const gender = genderRaw === "M" || genderRaw === "F" ? genderRaw : null;

  if (scope === "DIRECT") {
    return {
      relationToDonor: kind,
      gender,
      indirectKind: null,
      indirectLabel: null,
      isDirect: true,
      isIndirect: false,
      needsParentLink: kind === "CHILD",
    };
  }

  if (scope === "INDIRECT") {
    return {
      relationToDonor: "OTHER",
      gender,
      indirectKind: kind,
      indirectLabel: INDIRECT_LABELS[kind] ?? "Autre lien indirect",
      isDirect: false,
      isIndirect: true,
      needsParentLink: true,
    };
  }

  return null;
}

/** @deprecated */
export const SUCCESSION_DIRECT_RELATION_OPTIONS = SMART_SUCCESSION_RELATIONS.filter(
  (o) => o.group === "direct",
);

/** @deprecated */
export const SUCCESSION_INDIRECT_RELATION_OPTIONS = SMART_SUCCESSION_RELATIONS.filter(
  (o) => o.group === "indirect",
);

/** @deprecated */
export const SUCCESSION_RELATION_OPTIONS = SMART_SUCCESSION_RELATIONS;

export function isDirectSuccessionRelation(relation: string): boolean {
  return parseSmartRelation(relation)?.isDirect ?? false;
}

export function isIndirectSuccessionRelation(relation: string): boolean {
  return parseSmartRelation(relation)?.isIndirect ?? false;
}

export function indirectRelationLabel(relation: string): string | null {
  return parseSmartRelation(relation)?.indirectLabel ?? null;
}

export function findSpouses(existing: Beneficiary[]): Beneficiary[] {
  return existing.filter((b) => b.relation_to_donor === "SPOUSE");
}

/** @deprecated Préférer findSpouses / findFemaleSpouses */
export function findSpouse(existing: Beneficiary[]): Beneficiary | undefined {
  return findSpouses(existing)[0];
}

export function findFemaleSpouses(existing: Beneficiary[]): Beneficiary[] {
  return findSpouses(existing).filter((b) => b.gender !== "M");
}

export function findMaleSpouses(existing: Beneficiary[]): Beneficiary[] {
  return findSpouses(existing).filter((b) => b.gender === "M");
}

export function findSiblings(existing: Beneficiary[]): Beneficiary[] {
  return existing.filter((b) => b.relation_to_donor === "SIBLING");
}

export function hasDeceasedFather(existing: Beneficiary[]): boolean {
  return existing.some((b) => b.relation_to_donor === "PARENT" && b.gender === "M");
}

export function hasDeceasedMother(existing: Beneficiary[]): boolean {
  return existing.some((b) => b.relation_to_donor === "PARENT" && b.gender === "F");
}

/** Propose les liens encore pertinents. Père/mère du défunt : une seule fois. Épouses : plusieurs. Époux : une seule fois. */
export function getAvailableSmartRelations(existing: Beneficiary[]): SmartRelationOption[] {
  const wives = findFemaleSpouses(existing);
  const husbands = findMaleSpouses(existing);
  const deceasedIsMale = wives.length > 0;
  const deceasedIsFemale = husbands.length > 0;

  return SMART_SUCCESSION_RELATIONS.filter((opt) => {
    const parsed = parseSmartRelation(opt.value);
    if (!parsed) return false;

    if (parsed.relationToDonor === "PARENT" && parsed.gender === "M" && hasDeceasedFather(existing)) {
      return false;
    }
    if (parsed.relationToDonor === "PARENT" && parsed.gender === "F" && hasDeceasedMother(existing)) {
      return false;
    }

    // Défunt homme (épouse(s) connue(s)) : pas d'époux, épouses multiples autorisées.
    if (parsed.relationToDonor === "SPOUSE" && parsed.gender === "M" && deceasedIsMale) {
      return false;
    }
    // Défunt femme (époux connu) : un seul époux, pas d'épouse supplémentaire.
    if (parsed.relationToDonor === "SPOUSE" && parsed.gender === "F" && deceasedIsFemale) {
      return false;
    }
    if (parsed.relationToDonor === "SPOUSE" && parsed.gender === "M" && husbands.length >= 1) {
      return false;
    }

    return true;
  });
}

export type InferredParents = {
  father_id: string;
  mother_id: string;
  hint: string | null;
};

/** Déduit père/mère à partir du lien choisi et des membres déjà dans l'arbre. */
export function inferDefaultParents(
  relationValue: string,
  existing: Beneficiary[],
): InferredParents {
  const parsed = parseSmartRelation(relationValue);
  const result: InferredParents = { father_id: "", mother_id: "", hint: null };
  if (!parsed) return result;

  const wives = findFemaleSpouses(existing);
  const husbands = findMaleSpouses(existing);
  const siblings = findSiblings(existing);

  if (parsed.relationToDonor === "CHILD") {
    if (wives.length === 1) {
      const wife = wives[0]!;
      result.mother_id = String(wife.id);
      result.hint = `Mère rattachée automatiquement : ${wife.first_name} ${wife.last_name}`;
    } else if (husbands.length === 1) {
      const husband = husbands[0]!;
      result.father_id = String(husband.id);
      result.hint = `Père rattaché automatiquement : ${husband.first_name} ${husband.last_name}`;
    }
    return result;
  }

  if (parsed.indirectKind === "NEPHEW") {
    if (siblings.length === 1) {
      const s = siblings[0]!;
      if (s.gender === "F") {
        result.mother_id = String(s.id);
      } else {
        result.father_id = String(s.id);
      }
      result.hint = `Parent rattaché automatiquement : ${s.first_name} ${s.last_name}`;
    }
    return result;
  }

  return result;
}

/** Enfant du défunt : choix de la mère si plusieurs épouses. */
export function childNeedsMotherSelect(relationValue: string, existing: Beneficiary[]): boolean {
  const parsed = parseSmartRelation(relationValue);
  if (parsed?.relationToDonor !== "CHILD") return false;
  return findFemaleSpouses(existing).length > 1;
}

/** Enfant du défunt (défunt femme) : choix du père si plusieurs époux — cas rare, symétrie. */
export function childNeedsFatherSelect(relationValue: string, existing: Beneficiary[]): boolean {
  const parsed = parseSmartRelation(relationValue);
  if (parsed?.relationToDonor !== "CHILD") return false;
  return findMaleSpouses(existing).length > 1;
}

export function childMissingSpouseForParent(relationValue: string, existing: Beneficiary[]): boolean {
  const parsed = parseSmartRelation(relationValue);
  if (parsed?.relationToDonor !== "CHILD") return false;
  const wives = findFemaleSpouses(existing);
  const husbands = findMaleSpouses(existing);
  return wives.length === 0 && husbands.length === 0;
}

export function relationNeedsParentFields(
  relationValue: string,
  father_id: string,
  mother_id: string,
  existing: Beneficiary[],
): boolean {
  const parsed = parseSmartRelation(relationValue);
  if (!parsed) return false;

  if (parsed.relationToDonor === "CHILD") {
    if (childNeedsMotherSelect(relationValue, existing)) return true;
    if (childNeedsFatherSelect(relationValue, existing)) return true;
    return false;
  }

  if (!parsed.needsParentLink && !parsed.isIndirect) return false;

  const inferred = inferDefaultParents(relationValue, existing);
  const resolvedFather = father_id || inferred.father_id;
  const resolvedMother = mother_id || inferred.mother_id;

  return !resolvedFather && !resolvedMother;
}

export function buildSmartRelationPayload(
  form: {
    first_name: string;
    last_name: string;
    relation_to_donor: string;
    father_id: string;
    mother_id: string;
    date_of_birth: string;
    notes: string;
  },
  donorId: number | null,
  existing: Beneficiary[],
): Record<string, unknown> | null {
  const parsed = parseSmartRelation(form.relation_to_donor);
  if (!parsed) return null;

  const inferred = inferDefaultParents(form.relation_to_donor, existing);
  const fatherId = form.father_id || inferred.father_id;
  const motherId = form.mother_id || inferred.mother_id;

  const notes = form.notes.trim();
  let noteText = notes;
  if (parsed.indirectLabel) {
    noteText = notes ? `${parsed.indirectLabel} — ${notes}` : parsed.indirectLabel;
  }

  const body: Record<string, unknown> = {
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    relation_to_donor: parsed.relationToDonor,
    donor: donorId,
    date_of_birth: form.date_of_birth || null,
    notes: noteText,
    is_minor: false,
    patrimony_share_percent: null,
  };

  if (parsed.gender) {
    body.gender = parsed.gender;
  }

  if (parsed.needsParentLink || parsed.isIndirect) {
    if (fatherId) body.father_id = Number(fatherId);
    if (motherId) body.mother_id = Number(motherId);
  }

  return body;
}

export function smartRelationFormValid(
  form: {
    first_name: string;
    last_name: string;
    relation_to_donor: string;
    father_id: string;
    mother_id: string;
  },
  existing: Beneficiary[],
): boolean {
  if (!form.first_name.trim() || !form.last_name.trim() || !form.relation_to_donor) {
    return false;
  }

  const parsed = parseSmartRelation(form.relation_to_donor);
  if (!parsed) return false;

  if (parsed.needsParentLink || parsed.isIndirect) {
    const inferred = inferDefaultParents(form.relation_to_donor, existing);
    const fatherId = form.father_id || inferred.father_id;
    const motherId = form.mother_id || inferred.mother_id;
    if (!fatherId && !motherId) return false;

    if (parsed.relationToDonor === "CHILD") {
      if (childNeedsMotherSelect(form.relation_to_donor, existing) && !form.mother_id) {
        return false;
      }
      if (childNeedsFatherSelect(form.relation_to_donor, existing) && !form.father_id) {
        return false;
      }
      if (childMissingSpouseForParent(form.relation_to_donor, existing)) {
        return false;
      }
    }
  }

  return true;
}

export function beneficiaryToFaraidRole(
  b: Beneficiary,
  deceasedGender: "M" | "F",
): FaraidHeirRole | null {
  switch (b.relation_to_donor) {
    case "SPOUSE":
      if (b.gender === "F") return "WIFE";
      if (b.gender === "M") return "HUSBAND";
      return deceasedGender === "M" ? "WIFE" : "HUSBAND";
    case "CHILD":
      return b.gender === "F" ? "DAUGHTER" : "SON";
    case "PARENT":
      return b.gender === "F" ? "MOTHER" : "FATHER";
    case "SIBLING":
      return b.gender === "F" ? "SISTER_FULL" : "BROTHER_FULL";
    default:
      return null;
  }
}

export function beneficiariesToHeirInputs(
  members: Beneficiary[],
  deceasedGender: "M" | "F",
): import("@/lib/faraid/types").SuccessionHeirInput[] {
  const heirs: import("@/lib/faraid/types").SuccessionHeirInput[] = [];
  for (const b of members) {
    const role = beneficiaryToFaraidRole(b, deceasedGender);
    if (!role) continue;
    heirs.push({
      id: `b-${b.id}`,
      name: [b.first_name, b.last_name].filter(Boolean).join(" ") || `Membre #${b.id}`,
      role,
      beneficiaryId: b.id,
    });
  }
  return heirs;
}

export function inferDeceasedGenderFromFamily(members: Beneficiary[]): "M" | "F" | undefined {
  if (findFemaleSpouses(members).length > 0) return "M";
  if (findMaleSpouses(members).length > 0) return "F";
  return undefined;
}

/** Libellé affiché sur la carte (attribut précis, pas « FRÈRE / SŒUR » générique). */
export function formatMemberCardLabel(b: Beneficiary): string {
  const g = b.gender;
  switch (b.relation_to_donor) {
    case "SPOUSE":
      if (g === "F") return "Épouse du défunt";
      if (g === "M") return "Époux du défunt";
      return "Conjoint(e) du défunt";
    case "CHILD":
      if (g === "F") return "Fille du défunt";
      if (g === "M") return "Fils du défunt";
      return "Enfant du défunt";
    case "PARENT":
      if (g === "F") return "Mère du défunt";
      if (g === "M") return "Père du défunt";
      return "Parent du défunt";
    case "SIBLING":
      if (g === "F") return "Sœur du défunt";
      if (g === "M") return "Frère du défunt";
      return "Frère du défunt";
    case "OTHER": {
      const note = (b.notes || "").trim();
      if (note.includes("Petit-enfant") || note.includes("Petite-fille") || note.includes("Petit-fils")) {
        if (g === "F") return "Petite-fille";
        if (g === "M") return "Petit-fils";
        return "Petit-enfant";
      }
      if (note.includes("Neveu") || note.includes("Nièce")) {
        if (g === "F") return "Nièce";
        if (g === "M") return "Neveu";
        return "Neveu / nièce";
      }
      const head = note.split(" — ")[0]?.trim();
      return head || "Lien indirect";
    }
    default:
      return b.relation_to_donor_label || "Membre de la famille";
  }
}

export function beneficiaryToSmartRelationValue(b: Beneficiary): string {
  const g = b.gender === "M" || b.gender === "F" ? b.gender : "";
  if (b.relation_to_donor === "OTHER") {
    const note = b.notes || "";
    if (note.includes("Petit-enfant")) return `INDIRECT:GRANDCHILD:${g}`;
    if (note.includes("Neveu") || note.includes("Nièce")) return `INDIRECT:NEPHEW:${g}`;
    return "INDIRECT:OTHER:";
  }
  if (["SPOUSE", "CHILD", "PARENT", "SIBLING"].includes(b.relation_to_donor)) {
    return `DIRECT:${b.relation_to_donor}:${g}`;
  }
  return "";
}
