import { FARAID_HEIR_ROLE_LABELS } from "@/lib/faraid/labels";
import {
  addFractions,
  formatFraction,
  frac,
  fractionToDecimal,
  simplify,
} from "@/lib/faraid/fractions";
import type {
  FaraidCalculationResult,
  FaraidFraction,
  FaraidHeirRole,
  FaraidQuranStep,
  FaraidShareResult,
  SuccessionHeirInput,
} from "@/lib/faraid/types";

type HeirCounts = Record<string, number>;

function countByRole(heirs: SuccessionHeirInput[]): HeirCounts {
  const c: HeirCounts = {};
  for (const h of heirs) {
    c[h.role] = (c[h.role] ?? 0) + 1;
  }
  return c;
}

function hasRole(c: HeirCounts, role: FaraidHeirRole): boolean {
  return (c[role] ?? 0) > 0;
}

function buildQuranSteps(currentIndex: number): FaraidQuranStep[] {
  const defs = [
    {
      id: "net_estate",
      title: "1. Déterminer la masse à partager",
      verseRef: "—",
      verseExcerpt:
        "On règle d'abord les dettes et les legs, puis on partage selon ce qu'Allah a prescrit.",
      instruction:
        "Pour chaque bien : estimation distincte + justificatif PDF, puis total − dettes − frais funéraires.",
    },
    {
      id: "identify_heirs",
      title: "2. Identifier les héritiers",
      verseRef: "Sourate An-Nisa, 4:7",
      verseExcerpt:
        "« Aux hommes revient une part de ce qu'ont laissé les père et mère, ainsi que les proches… »",
      instruction:
        "Recensez chaque ayant droit sur l'arbre généalogique : époux, enfants, parents, etc.",
    },
    {
      id: "spouses",
      title: "3. Parts de l'époux et de l'épouse",
      verseRef: "Sourate An-Nisa, 4:12",
      verseExcerpt:
        "« … à vos épouses, un quart de ce que vous laissez si vous n'avez pas d'enfant… un huitième si vous avez un enfant… »",
      instruction:
        "Attribuez la part fixe (fard) du conjoint survivant selon la présence d'enfants.",
    },
    {
      id: "parents",
      title: "4. Parts du père et de la mère",
      verseRef: "Sourate An-Nisa, 4:11",
      verseExcerpt:
        "« … pour le père et la mère, à chacun le sixième si le défunt a un enfant… »",
      instruction:
        "Calculez les parts des parents ; le père peut aussi recevoir le reste (`asaba) s'il reste une quote.",
    },
    {
      id: "children",
      title: "5. Parts des fils et filles",
      verseRef: "Sourate An-Nisa, 4:11",
      verseExcerpt:
        "« Allah vous a prescrit, au sujet de vos enfants : au fils, une part équivalente à celle de deux filles… »",
      instruction:
        "Les filles ont une part fixe en l'absence de fils ; avec fils, les fils reçoivent le double des filles à la `asaba.",
    },
    {
      id: "asaba",
      title: "6. Répartition du reste (`asaba)",
      verseRef: "Sourate An-Nisa, 4:33",
      verseExcerpt:
        "« … et aux proches parents, le droit de succession… »",
      instruction:
        "Distribuez le reliquat aux héritiers masculins prioritaires (fils, père, frères…) selon la proximité.",
    },
    {
      id: "balance",
      title: "7. Vérification et clôture",
      verseRef: "—",
      verseExcerpt: "La somme des parts doit couvrir 100 % du patrimoine net.",
      instruction:
        "Contrôlez les totaux, ajustez en cas d'awl ou de radd, puis validez le partage.",
    },
  ];
  return defs.map((d, i) => ({
    ...d,
    status:
      i < currentIndex ? "done" : i === currentIndex ? "current" : "pending",
  }));
}

type ShareDraft = {
  heirId: string;
  name: string;
  role: FaraidHeirRole;
  fraction: FaraidFraction;
  shareType: FaraidShareResult["shareType"];
  explanation: string;
};

export function calculateFaraidShares(
  heirs: SuccessionHeirInput[],
  netEstate: number,
  currency = "XOF",
  currentStepIndex = 6,
): FaraidCalculationResult {
  const warnings: string[] = [];
  const counts = countByRole(heirs);
  const hasSon = hasRole(counts, "SON");
  const hasDaughter = hasRole(counts, "DAUGHTER");
  const hasChild = hasSon || hasDaughter || hasRole(counts, "GRANDSON");
  const hasFather = hasRole(counts, "FATHER");
  const hasMother = hasRole(counts, "MOTHER");
  const husbandCount = counts.HUSBAND ?? 0;
  const wifeCount = counts.WIFE ?? 0;
  const daughterCount = counts.DAUGHTER ?? 0;

  if (heirs.length === 0) {
    return {
      netEstate,
      currency,
      shares: [],
      quranSteps: buildQuranSteps(0),
      warnings: ["Ajoutez au moins un héritier pour lancer le calcul."],
      totalFraction: frac(0, 1),
      isBalanced: false,
    };
  }

  if (husbandCount > 0 && wifeCount > 0) {
    warnings.push("Époux et épouse ne peuvent pas coexister : un seul conjoint survivant.");
  }

  const drafts: ShareDraft[] = [];

  for (const heir of heirs) {
    if (heir.role === "HUSBAND") {
      const f = hasChild ? frac(1, 4) : frac(1, 2);
      drafts.push({
        heirId: heir.id,
        name: heir.name,
        role: heir.role,
        fraction: f,
        shareType: "fard",
        explanation: hasChild
          ? "Époux : 1/4 en présence d'enfants (4:12)."
          : "Époux : 1/2 sans enfant (4:12).",
      });
    } else if (heir.role === "WIFE") {
      const pool = hasChild ? frac(1, 8) : frac(1, 4);
      const each = frac(pool.numerator, pool.denominator * Math.max(wifeCount, 1));
      drafts.push({
        heirId: heir.id,
        name: heir.name,
        role: heir.role,
        fraction: each,
        shareType: "fard",
        explanation:
          wifeCount > 1
            ? `Épouses : partager ${formatFraction(pool)} entre ${wifeCount} épouses.`
            : hasChild
              ? "Épouse : 1/8 en présence d'enfants (4:12)."
              : "Épouse : 1/4 sans enfant (4:12).",
      });
    } else if (heir.role === "FATHER") {
      if (hasChild) {
        drafts.push({
          heirId: heir.id,
          name: heir.name,
          role: heir.role,
          fraction: frac(1, 6),
          shareType: "fard",
          explanation: "Père : 1/6 avec enfant descendant (4:11), puis éventuellement `asaba.",
        });
      }
    } else if (heir.role === "MOTHER") {
      const siblings =
        (counts.BROTHER_FULL ?? 0) +
        (counts.SISTER_FULL ?? 0) +
        (counts.BROTHER_PATERNAL ?? 0) +
        (counts.SISTER_PATERNAL ?? 0) +
        (counts.BROTHER_MATERNAL ?? 0) +
        (counts.SISTER_MATERNAL ?? 0);
      const motherShare =
        hasChild || siblings >= 2 || (hasFather && siblings >= 1)
          ? frac(1, 6)
          : frac(1, 3);
      drafts.push({
        heirId: heir.id,
        name: heir.name,
        role: heir.role,
        fraction: motherShare,
        shareType: "fard",
        explanation:
          motherShare.denominator === 6
            ? "Mère : 1/6 (présence d'enfant ou de frères/sœurs) (4:11)."
            : "Mère : 1/3 en l'absence d'enfant et de frères/sœurs multiples (4:11).",
      });
    } else if (heir.role === "DAUGHTER" && !hasSon) {
      if (daughterCount === 1) {
        drafts.push({
          heirId: heir.id,
          name: heir.name,
          role: heir.role,
          fraction: frac(1, 2),
          shareType: "fard",
          explanation: "Fille unique sans fils : 1/2 (4:11).",
        });
      } else if (daughterCount >= 2) {
        const each = frac(2, 3 * daughterCount);
        drafts.push({
          heirId: heir.id,
          name: heir.name,
          role: heir.role,
          fraction: each,
          shareType: "fard",
          explanation: `Plusieurs filles sans fils : 2/3 répartis entre ${daughterCount} filles (4:11).`,
        });
      }
    }
  }

  let totalFard = frac(0, 1);
  for (const d of drafts) {
    totalFard = addFractions(totalFard, d.fraction);
  }

  const fardDecimal = fractionToDecimal(totalFard);
  const remainder = 1 - fardDecimal;

  const asabaCandidates = heirs.filter((h) => {
    if (drafts.some((d) => d.heirId === h.id)) {
      if (h.role === "FATHER" && !hasChild) return true;
      return false;
    }
    return (
      h.role === "SON" ||
      h.role === "GRANDSON" ||
      (h.role === "FATHER" && !hasChild) ||
      h.role === "BROTHER_FULL" ||
      h.role === "BROTHER_PATERNAL" ||
      h.role === "BROTHER_MATERNAL"
    );
  });

  if (remainder > 0.0001 && asabaCandidates.length > 0) {
    const sons = asabaCandidates.filter((h) => h.role === "SON");
    const pool =
      sons.length > 0
        ? sons
        : asabaCandidates.filter((h) => h.role === "FATHER" || h.role.startsWith("BROTHER"));

    if (pool.length > 0) {
      const maleSons = pool.filter((h) => h.role === "SON");
      const femaleInPool = pool.filter((h) => h.role === "DAUGHTER");
      if (maleSons.length > 0) {
        const daughtersInCase = heirs.filter((h) => h.role === "DAUGHTER");
        const sonUnits = maleSons.length * 2 + daughtersInCase.length;
        for (const heir of maleSons) {
          const f = frac(remainder * 2, sonUnits);
          drafts.push({
            heirId: heir.id,
            name: heir.name,
            role: heir.role,
            fraction: f,
            shareType: "asaba",
            explanation: "Fils : `asaba — part double de la fille (4:11).",
          });
        }
        for (const heir of daughtersInCase) {
          if (drafts.some((d) => d.heirId === heir.id)) continue;
          const f = frac(remainder, sonUnits);
          drafts.push({
            heirId: heir.id,
            name: heir.name,
            role: heir.role,
            fraction: f,
            shareType: "asaba",
            explanation: "Fille avec fils : `asaba — moitié de la part du fils (4:11).",
          });
        }
      } else {
        const each = frac(remainder, pool.length);
        for (const heir of pool) {
          if (drafts.some((d) => d.heirId === heir.id && d.shareType === "fard")) {
            const idx = drafts.findIndex((d) => d.heirId === heir.id);
            if (idx >= 0) {
              drafts[idx] = {
                ...drafts[idx],
                fraction: addFractions(drafts[idx].fraction, each),
                shareType: "asaba",
                explanation: `${drafts[idx].explanation} + reliquat \`asaba.`,
              };
            }
            continue;
          }
          drafts.push({
            heirId: heir.id,
            name: heir.name,
            role: heir.role,
            fraction: each,
            shareType: "asaba",
            explanation: "Héritier `asaba : reliquat après les parts fixes.",
          });
        }
      }
    }
  } else if (remainder > 0.0001 && drafts.length > 0) {
    warnings.push(
      "Reliquat non attribué : vérifiez les héritiers `asaba ou appliquez le radd (retour aux héritiers de fard).",
    );
    const bump = frac(remainder, drafts.length);
    for (const d of drafts) {
      d.fraction = addFractions(d.fraction, bump);
      d.shareType = "radd";
      d.explanation += " (radd : part du reliquat).";
    }
  }

  if (fardDecimal > 1.0001) {
    warnings.push(
      "Total des parts fixes > 100 % : cas d'awl (augmentation du dénominateur) — faites valider par le comité charaïque.",
    );
  }

  let totalFraction = frac(0, 1);
  for (const d of drafts) {
    totalFraction = addFractions(totalFraction, d.fraction);
  }

  const shares: FaraidShareResult[] = drafts.map((d) => {
    const pct = fractionToDecimal(d.fraction) * 100;
    return {
      heirId: d.heirId,
      name: d.name,
      role: d.role,
      roleLabel: FARAID_HEIR_ROLE_LABELS[d.role],
      fraction: simplify(d.fraction),
      sharePercent: pct,
      amount: netEstate * fractionToDecimal(d.fraction),
      shareType: d.shareType,
      explanation: d.explanation,
    };
  });

  const totalDec = fractionToDecimal(totalFraction);
  const isBalanced = Math.abs(totalDec - 1) < 0.02;

  return {
    netEstate,
    currency,
    shares,
    quranSteps: buildQuranSteps(currentStepIndex),
    warnings,
    totalFraction: simplify(totalFraction),
    isBalanced,
  };
}
