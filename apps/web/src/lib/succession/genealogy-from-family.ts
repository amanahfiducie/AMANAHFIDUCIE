import { formatMemberCardLabel } from "@/lib/succession/family-relations";
import type { Beneficiary } from "@/types/api";

export type GenealogyNodeVariant =
  | "deceased"
  | "spouse"
  | "parent"
  | "child"
  | "sibling"
  | "indirect"
  | "union-hub"
  | "default";

export type GenealogyEdgeStyle =
  | "union"
  | "from-deceased"
  | "from-spouse"
  | "from-parent"
  | "from-sibling"
  | "from-descendant";

export type GenealogyGraphNode = {
  id: string;
  beneficiaryId?: number;
  name: string;
  subtitle: string;
  variant: GenealogyNodeVariant;
  gender?: "" | "M" | "F";
  generation: number;
  x: number;
  y: number;
  /** Branche familiale (ex. lignée d'une épouse) pour différencier nœuds et traits. */
  branchIndex?: number | null;
};

export type GenealogyGraphEdge = {
  from: string;
  to: string;
  kind: "parent" | "union";
  style: GenealogyEdgeStyle;
  branchIndex?: number | null;
};

export type GenealogyBranch = {
  index: number;
  spouseId: number;
  label: string;
};

export type GenealogyGraph = {
  nodes: GenealogyGraphNode[];
  edges: GenealogyGraphEdge[];
  width: number;
  height: number;
  branches?: GenealogyBranch[];
};

export const MAX_GENEALOGY_BRANCHES = 6;

export type GenealogySpacing = "default" | "expanded";

type LayoutMetrics = {
  nodeWidth: number;
  nodeHeight: number;
  hGap: number;
  vGap: number;
  coupleGap: number;
  siblingGap: number;
  padding: number;
};

function layoutMetricsFor(spacing: GenealogySpacing = "default"): LayoutMetrics {
  if (spacing === "expanded") {
    return {
      nodeWidth: 132,
      nodeHeight: 68,
      hGap: 56,
      vGap: 132,
      coupleGap: 96,
      siblingGap: 24,
      padding: 52,
    };
  }
  return {
    nodeWidth: 132,
    nodeHeight: 68,
    hGap: 24,
    vGap: 80,
    coupleGap: 72,
    siblingGap: 16,
    padding: 40,
  };
}

const DECEASED_ID = "deceased";

/** Identifiant stable du nœud d'union entre deux personnes (liaison du couple). */
export function unionHubId(a: string, b: string): string {
  return a < b ? `u-${a}__${b}` : `u-${b}__${a}`;
}

export function isUnionHubId(id: string): boolean {
  return id.startsWith("u-") && id.includes("__");
}

function parseUnionHubPartners(hubId: string): [string, string] | null {
  if (!isUnionHubId(hubId)) return null;
  const rest = hubId.slice(2);
  const sep = rest.indexOf("__");
  if (sep < 0) return null;
  return [rest.slice(0, sep), rest.slice(sep + 2)];
}

function nodeVariant(b: Beneficiary): GenealogyNodeVariant {
  switch (b.relation_to_donor) {
    case "SPOUSE":
      return "spouse";
    case "PARENT":
      return "parent";
    case "CHILD":
      return "child";
    case "SIBLING":
      return "sibling";
    case "OTHER":
      return "indirect";
    default:
      return "default";
  }
}

function beneficiaryNodeId(id: number): string {
  return `b-${id}`;
}

function nodeFromBeneficiary(
  b: Beneficiary,
  generation: number,
  deceasedGender?: "M" | "F",
): Omit<GenealogyGraphNode, "x" | "y"> {
  return {
    id: beneficiaryNodeId(b.id),
    beneficiaryId: b.id,
    name: [b.first_name, b.last_name].filter(Boolean).join(" "),
    subtitle: formatMemberCardLabel(b),
    variant: nodeVariant(b),
    gender: resolveMemberGender(b, deceasedGender),
    generation,
  };
}

function inferDeceasedGender(members: Beneficiary[]): "M" | "F" | undefined {
  const spouse = members.find((m) => m.relation_to_donor === "SPOUSE");
  if (spouse?.gender === "F") return "M";
  if (spouse?.gender === "M") return "F";
  return undefined;
}

function resolveMemberGender(
  b: Beneficiary,
  deceasedGender?: "M" | "F",
): "" | "M" | "F" {
  if (b.gender === "M" || b.gender === "F") return b.gender;
  if (b.relation_to_donor === "SPOUSE" && deceasedGender) {
    return deceasedGender === "M" ? "F" : "M";
  }
  return "";
}

function edgeStyleForParent(fromId: string, nodeById: Map<string, Omit<GenealogyGraphNode, "x" | "y">>): GenealogyEdgeStyle {
  if (fromId === DECEASED_ID) return "from-deceased";
  const from = nodeById.get(fromId);
  if (!from) return "from-descendant";
  switch (from.variant) {
    case "spouse":
      return "from-spouse";
    case "parent":
      return "from-parent";
    case "sibling":
      return "from-sibling";
    default:
      return "from-descendant";
  }
}

function parentPairKey(m: Beneficiary): string {
  return `${m.father ?? "none"}:${m.mother ?? "none"}`;
}

/**
 * Couple dont est issu le membre — pour rattacher les enfants au nœud d'union.
 * Polygamie : chaque épouse forme un couple distinct avec le défunt.
 */
function resolveCouplePartners(
  m: Beneficiary,
  byId: Map<number, Beneficiary>,
  spouseIds: Set<number>,
  soleWifeId: number | null,
  soleHusbandId: number | null,
): { a: string; b: string } | null {
  const fatherInTree = m.father != null && byId.has(m.father);
  const motherInTree = m.mother != null && byId.has(m.mother);

  if (fatherInTree && motherInTree) {
    return {
      a: beneficiaryNodeId(m.father!),
      b: beneficiaryNodeId(m.mother!),
    };
  }

  if (m.relation_to_donor === "CHILD") {
    if (motherInTree && spouseIds.has(m.mother!)) {
      return { a: DECEASED_ID, b: beneficiaryNodeId(m.mother!) };
    }
    if (fatherInTree && spouseIds.has(m.father!)) {
      return { a: DECEASED_ID, b: beneficiaryNodeId(m.father!) };
    }
    if (!motherInTree && !fatherInTree && soleWifeId != null) {
      return { a: DECEASED_ID, b: beneficiaryNodeId(soleWifeId) };
    }
    if (!motherInTree && !fatherInTree && soleHusbandId != null) {
      return { a: DECEASED_ID, b: beneficiaryNodeId(soleHusbandId) };
    }
  }

  if (motherInTree && spouseIds.has(m.mother!)) {
    return { a: DECEASED_ID, b: beneficiaryNodeId(m.mother!) };
  }
  if (fatherInTree && spouseIds.has(m.father!)) {
    return { a: DECEASED_ID, b: beneficiaryNodeId(m.father!) };
  }

  return null;
}

function pushParentEdgeFromCoupleOrPerson(
  edges: GenealogyGraphEdge[],
  m: Beneficiary,
  childId: string,
  byId: Map<number, Beneficiary>,
  spouseIds: Set<number>,
  soleWifeId: number | null,
  soleHusbandId: number | null,
  nodeByIdDraft: Map<string, Omit<GenealogyGraphNode, "x" | "y">>,
  hubIds: Set<string>,
): void {
  const couple = resolveCouplePartners(
    m,
    byId,
    spouseIds,
    soleWifeId,
    soleHusbandId,
  );
  if (couple) {
    const hub = unionHubId(couple.a, couple.b);
    hubIds.add(hub);
    // Couples hors défunt↔conjoint (ex. parents d'un neveu) : créer aussi le trait d'union.
    if (couple.a !== DECEASED_ID && couple.b !== DECEASED_ID) {
      edges.push({
        from: couple.a,
        to: couple.b,
        kind: "union",
        style: "union",
      });
    }
    edges.push({
      from: hub,
      to: childId,
      kind: "parent",
      style:
        couple.a === DECEASED_ID || couple.b === DECEASED_ID
          ? "from-deceased"
          : edgeStyleForParent(couple.a, nodeByIdDraft),
    });
    return;
  }

  if (m.mother != null && byId.has(m.mother)) {
    edges.push({
      from: beneficiaryNodeId(m.mother),
      to: childId,
      kind: "parent",
      style: edgeStyleForParent(beneficiaryNodeId(m.mother), nodeByIdDraft),
    });
    return;
  }
  if (m.father != null && byId.has(m.father)) {
    edges.push({
      from: beneficiaryNodeId(m.father),
      to: childId,
      kind: "parent",
      style: edgeStyleForParent(beneficiaryNodeId(m.father), nodeByIdDraft),
    });
    return;
  }
  edges.push({
    from: DECEASED_ID,
    to: childId,
    kind: "parent",
    style: "from-deceased",
  });
}

function resolvePrimaryLayoutAnchor(
  m: Beneficiary,
  byId: Map<number, Beneficiary>,
  spouseIds: Set<number>,
  soleWifeId: number | null,
  soleHusbandId: number | null = null,
): string {
  if (m.mother != null && byId.has(m.mother)) {
    return beneficiaryNodeId(m.mother);
  }
  if (m.relation_to_donor === "CHILD" && m.mother == null && soleWifeId != null) {
    return beneficiaryNodeId(soleWifeId);
  }
  if (m.father != null && byId.has(m.father)) {
    return beneficiaryNodeId(m.father);
  }
  if (m.relation_to_donor === "CHILD" && m.father == null && soleHusbandId != null) {
    return beneficiaryNodeId(soleHusbandId);
  }
  return DECEASED_ID;
}

function childrenAnchoredTo(
  anchorNodeId: string,
  members: Beneficiary[],
  byId: Map<number, Beneficiary>,
  spouseIds: Set<number>,
  soleWifeId: number | null,
  soleHusbandId: number | null = null,
): Beneficiary[] {
  return members.filter(
    (m) =>
      resolvePrimaryLayoutAnchor(m, byId, spouseIds, soleWifeId, soleHusbandId) ===
      anchorNodeId,
  );
}

function groupByParentPair(children: Beneficiary[]): Beneficiary[][] {
  const map = new Map<string, Beneficiary[]>();
  for (const m of children) {
    const key = parentPairKey(m);
    const list = map.get(key) ?? [];
    list.push(m);
    map.set(key, list);
  }
  for (const list of map.values()) {
    list.sort((a, b) =>
      `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "fr"),
    );
  }
  return [...map.values()];
}

function sortParentPairGroups(
  groups: Beneficiary[][],
  branchByNodeId: Map<string, number>,
): Beneficiary[][] {
  return [...groups].sort((a, b) => {
    const branchA = branchByNodeId.get(beneficiaryNodeId(a[0]!.id)) ?? 999;
    const branchB = branchByNodeId.get(beneficiaryNodeId(b[0]!.id)) ?? 999;
    if (branchA !== branchB) return branchA - branchB;
    return parentPairKey(a[0]!).localeCompare(parentPairKey(b[0]!), "fr");
  });
}

function measureSiblingGroupWidth(
  group: Beneficiary[],
  members: Beneficiary[],
  byId: Map<number, Beneficiary>,
  spouseIds: Set<number>,
  soleWifeId: number | null,
  soleHusbandId: number | null,
  nodeById: Map<string, Omit<GenealogyGraphNode, "x" | "y">>,
  generationY: Map<number, number>,
  positions: Map<string, { x: number; y: number }>,
  placed: Set<string>,
  metrics: LayoutMetrics,
  widthMemo: Map<string, number>,
  branchByNodeId: Map<string, number>,
): number {
  let total = 0;
  for (let i = 0; i < group.length; i++) {
    total += measureDescendantForestWidth(
      beneficiaryNodeId(group[i]!.id),
      members,
      byId,
      spouseIds,
      soleWifeId,
      soleHusbandId,
      nodeById,
      generationY,
      positions,
      placed,
      metrics,
      widthMemo,
      branchByNodeId,
    );
    if (i < group.length - 1) total += metrics.siblingGap;
  }
  return total;
}

function measureDescendantForestWidth(
  anchorNodeId: string,
  members: Beneficiary[],
  byId: Map<number, Beneficiary>,
  spouseIds: Set<number>,
  soleWifeId: number | null,
  soleHusbandId: number | null,
  nodeById: Map<string, Omit<GenealogyGraphNode, "x" | "y">>,
  generationY: Map<number, number>,
  positions: Map<string, { x: number; y: number }>,
  placed: Set<string>,
  metrics: LayoutMetrics,
  widthMemo: Map<string, number>,
  branchByNodeId: Map<string, number>,
): number {
  const cached = widthMemo.get(anchorNodeId);
  if (cached != null) return cached;

  const children = childrenAnchoredTo(anchorNodeId, members, byId, spouseIds, soleWifeId, soleHusbandId);
  if (children.length === 0) {
    widthMemo.set(anchorNodeId, metrics.nodeWidth);
    return metrics.nodeWidth;
  }

  const groups = sortParentPairGroups(groupByParentPair(children), branchByNodeId);
  let total = 0;
  for (let i = 0; i < groups.length; i++) {
    total += measureSiblingGroupWidth(
      groups[i]!,
      members,
      byId,
      spouseIds,
      soleWifeId,
      soleHusbandId,
      nodeById,
      generationY,
      positions,
      placed,
      metrics,
      widthMemo,
      branchByNodeId,
    );
    if (i < groups.length - 1) total += metrics.hGap;
  }

  const width = Math.max(metrics.nodeWidth, total);
  widthMemo.set(anchorNodeId, width);
  return width;
}

function placeSiblingGroup(
  group: Beneficiary[],
  groupCenterX: number,
  members: Beneficiary[],
  byId: Map<number, Beneficiary>,
  spouseIds: Set<number>,
  soleWifeId: number | null,
  soleHusbandId: number | null,
  nodeById: Map<string, Omit<GenealogyGraphNode, "x" | "y">>,
  generationY: Map<number, number>,
  positions: Map<string, { x: number; y: number }>,
  placed: Set<string>,
  metrics: LayoutMetrics,
  widthMemo: Map<string, number>,
  branchByNodeId: Map<string, number>,
): void {
  const widths = group.map((m) =>
    measureDescendantForestWidth(
      beneficiaryNodeId(m.id),
      members,
      byId,
      spouseIds,
      soleWifeId,
      soleHusbandId,
      nodeById,
      generationY,
      positions,
      placed,
      metrics,
      widthMemo,
      branchByNodeId,
    ),
  );
  const total =
    widths.reduce((sum, w) => sum + w, 0) + metrics.siblingGap * Math.max(0, group.length - 1);

  let xCursor = groupCenterX - total / 2;
  for (let i = 0; i < group.length; i++) {
    const m = group[i]!;
    const w = widths[i]!;
    const nodeId = beneficiaryNodeId(m.id);
    const childCenterX = xCursor + w / 2;
    const node = nodeById.get(nodeId);
    const y = generationY.get(node?.generation ?? 1) ?? 0;

    if (!placed.has(nodeId)) {
      positions.set(nodeId, { x: childCenterX, y });
      placed.add(nodeId);
    }

    placeDescendantsForest(
      nodeId,
      childCenterX,
      members,
      byId,
      spouseIds,
      soleWifeId,
      soleHusbandId,
      nodeById,
      generationY,
      positions,
      placed,
      metrics,
      widthMemo,
      branchByNodeId,
    );

    xCursor += w + (i < group.length - 1 ? metrics.siblingGap : 0);
  }
}

function placeDescendantsForest(
  anchorNodeId: string,
  centerX: number,
  members: Beneficiary[],
  byId: Map<number, Beneficiary>,
  spouseIds: Set<number>,
  soleWifeId: number | null,
  soleHusbandId: number | null,
  nodeById: Map<string, Omit<GenealogyGraphNode, "x" | "y">>,
  generationY: Map<number, number>,
  positions: Map<string, { x: number; y: number }>,
  placed: Set<string>,
  metrics: LayoutMetrics,
  widthMemo: Map<string, number>,
  branchByNodeId: Map<string, number>,
): void {
  const children = childrenAnchoredTo(anchorNodeId, members, byId, spouseIds, soleWifeId, soleHusbandId);
  if (children.length === 0) return;

  const groups = sortParentPairGroups(groupByParentPair(children), branchByNodeId);
  const groupWidths = groups.map((group) =>
    measureSiblingGroupWidth(
      group,
      members,
      byId,
      spouseIds,
      soleWifeId,
      soleHusbandId,
      nodeById,
      generationY,
      positions,
      placed,
      metrics,
      widthMemo,
      branchByNodeId,
    ),
  );
  const totalWidth =
    groupWidths.reduce((sum, w) => sum + w, 0) + metrics.hGap * Math.max(0, groups.length - 1);

  let cursor = centerX - totalWidth / 2;
  for (let gi = 0; gi < groups.length; gi++) {
    const gw = groupWidths[gi]!;
    placeSiblingGroup(
      groups[gi]!,
      cursor + gw / 2,
      members,
      byId,
      spouseIds,
      soleWifeId,
      soleHusbandId,
      nodeById,
      generationY,
      positions,
      placed,
      metrics,
      widthMemo,
      branchByNodeId,
    );
    cursor += gw + (gi < groups.length - 1 ? metrics.hGap : 0);
  }
}

function layoutGenerationY(
  sortedGens: number[],
  minGen: number,
  metrics: LayoutMetrics,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const gen of sortedGens) {
    map.set(gen, (gen - minGen) * metrics.vGap);
  }
  return map;
}

function layoutCoreGeneration(
  row: Omit<GenealogyGraphNode, "x" | "y">[],
  positions: Map<string, { x: number; y: number }>,
  generationY: Map<number, number>,
  metrics: LayoutMetrics,
  deceasedGender?: "M" | "F",
): void {
  const { nodeWidth, hGap, coupleGap } = metrics;
  const y = generationY.get(0) ?? 0;
  const siblings = row.filter((n) => n.variant === "sibling");
  const spouses = row.filter((n) => n.variant === "spouse");
  const others = row.filter(
    (n) => n.id !== DECEASED_ID && n.variant !== "sibling" && n.variant !== "spouse",
  );

  positions.set(DECEASED_ID, { x: 0, y });

  const femaleSpouses: Omit<GenealogyGraphNode, "x" | "y">[] = [];
  const maleSpouses: Omit<GenealogyGraphNode, "x" | "y">[] = [];
  for (const spouse of spouses) {
    if (spouse.gender === "F") {
      femaleSpouses.push(spouse);
    } else if (spouse.gender === "M") {
      maleSpouses.push(spouse);
    } else if (deceasedGender === "F") {
      maleSpouses.push(spouse);
    } else {
      femaleSpouses.push(spouse);
    }
  }

  const byName = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, "fr");
  femaleSpouses.sort(byName);
  maleSpouses.sort(byName);

  // Épouses : polygamie → alternance droite / gauche autour du défunt
  // pour que chaque nœud d'union (milieu du couple) soit clairement séparé.
  let rightX = nodeWidth / 2 + coupleGap;
  let leftX = -(nodeWidth / 2 + coupleGap);
  const spouseGap = femaleSpouses.length > 1 ? coupleGap * 1.25 : coupleGap;
  for (let i = 0; i < femaleSpouses.length; i++) {
    if (i % 2 === 0) {
      positions.set(femaleSpouses[i]!.id, { x: rightX, y });
      rightX += nodeWidth + spouseGap;
    } else {
      positions.set(femaleSpouses[i]!.id, { x: leftX, y });
      leftX -= nodeWidth + spouseGap;
    }
  }

  for (const other of others) {
    positions.set(other.id, { x: rightX, y });
    rightX += nodeWidth + hGap;
  }

  // Époux (défunt femme) : même logique d'alternance.
  const husbandGap = maleSpouses.length > 1 ? coupleGap * 1.25 : coupleGap;
  for (let i = 0; i < maleSpouses.length; i++) {
    if (i % 2 === 0) {
      positions.set(maleSpouses[i]!.id, { x: leftX, y });
      leftX -= nodeWidth + husbandGap;
    } else {
      positions.set(maleSpouses[i]!.id, { x: rightX, y });
      rightX += nodeWidth + husbandGap;
    }
  }

  // Frères / sœurs plus loin à gauche.
  leftX -= hGap / 2;
  for (let i = siblings.length - 1; i >= 0; i--) {
    positions.set(siblings[i]!.id, { x: leftX, y });
    leftX -= nodeWidth + hGap;
  }
}

function layoutParentGeneration(
  row: Omit<GenealogyGraphNode, "x" | "y">[],
  positions: Map<string, { x: number; y: number }>,
  generationY: Map<number, number>,
  metrics: LayoutMetrics,
): void {
  const { nodeWidth, hGap, coupleGap, vGap } = metrics;
  const y = generationY.get(-1) ?? -vGap;
  const fathers = row.filter((n) => n.gender === "M");
  const mothers = row.filter((n) => n.gender === "F");
  const unknown = row.filter((n) => n.gender !== "M" && n.gender !== "F");

  if (fathers.length === 0 && mothers.length === 0) {
    const span = row.length * nodeWidth + (row.length - 1) * hGap;
    let x = -span / 2 + nodeWidth / 2;
    for (const node of row) {
      positions.set(node.id, { x, y });
      x += nodeWidth + hGap;
    }
    return;
  }

  const father = fathers[0];
  const mother = mothers[0];
  if (father && mother) {
    positions.set(father.id, { x: -(nodeWidth / 2 + coupleGap / 2), y });
    positions.set(mother.id, { x: nodeWidth / 2 + coupleGap / 2, y });
    for (let i = 1; i < fathers.length; i++) {
      positions.set(fathers[i].id, { x: -(nodeWidth + hGap) * (i + 1), y });
    }
    for (let i = 1; i < mothers.length; i++) {
      positions.set(mothers[i].id, { x: (nodeWidth + hGap) * (i + 1) + coupleGap, y });
    }
  } else if (father) {
    positions.set(father.id, { x: 0, y });
    for (let i = 1; i < fathers.length; i++) {
      positions.set(fathers[i].id, { x: (nodeWidth + hGap) * i, y });
    }
  } else if (mother) {
    positions.set(mother.id, { x: 0, y });
    for (let i = 1; i < mothers.length; i++) {
      positions.set(mothers[i].id, { x: (nodeWidth + hGap) * i, y });
    }
  }

  let sideX = (row.length + 1) * (nodeWidth + hGap);
  for (const node of unknown) {
    positions.set(node.id, { x: sideX, y });
    sideX += nodeWidth + hGap;
  }
}

function layoutOrphanGeneration(
  row: Omit<GenealogyGraphNode, "x" | "y">[],
  generation: number,
  positions: Map<string, { x: number; y: number }>,
  generationY: Map<number, number>,
  edges: GenealogyGraphEdge[],
  metrics: LayoutMetrics,
  members: Beneficiary[],
  byId: Map<number, Beneficiary>,
): void {
  const { nodeWidth, hGap, siblingGap } = metrics;
  const y = generationY.get(generation) ?? 0;
  const unplaced = row.filter((n) => !positions.has(n.id));
  if (unplaced.length === 0) return;

  const memberByNodeId = new Map(
    members.map((m) => [beneficiaryNodeId(m.id), m]),
  );

  const grouped = new Map<string, Omit<GenealogyGraphNode, "x" | "y">[]>();
  for (const node of unplaced) {
    const member = node.beneficiaryId != null ? memberByNodeId.get(beneficiaryNodeId(node.beneficiaryId)) : undefined;
    const parentEdges = edges.filter((e) => e.kind === "parent" && e.to === node.id);
    const fatherEdge = parentEdges.find((e) => {
      const p = nodeByIdGender(e.from, members);
      return p !== "F";
    });
    const motherEdge = parentEdges.find((e) => {
      const p = nodeByIdGender(e.from, members);
      return p === "F";
    });
    const anchorEdge =
      motherEdge ??
      fatherEdge ??
      parentEdges[0];
    const pairKey = member
      ? parentPairKey(member)
      : anchorEdge
        ? `${anchorEdge.from}:${node.id}`
        : `orphan-${node.variant}`;
    const anchorId = anchorEdge?.from ?? `orphan-${node.variant}`;
    const key = `${anchorId}::${pairKey}`;
    const list = grouped.get(key) ?? [];
    list.push(node);
    grouped.set(key, list);
  }

  const anchorKeys = [...new Set([...grouped.keys()].map((k) => k.split("::")[0]!))].sort(
    (a, b) => {
      const ax = positions.get(a)?.x ?? 0;
      const bx = positions.get(b)?.x ?? 0;
      return ax - bx;
    },
  );

  for (const anchorId of anchorKeys) {
    const clusters = [...grouped.entries()]
      .filter(([key]) => key.startsWith(`${anchorId}::`))
      .map(([, nodes]) =>
        [...nodes].sort((a, b) => a.name.localeCompare(b.name, "fr")),
      );

    const clusterWidths = clusters.map(
      (nodes) => nodes.length * nodeWidth + (nodes.length - 1) * siblingGap,
    );
    const totalWidth =
      clusterWidths.reduce((sum, w) => sum + w, 0) + hGap * Math.max(0, clusters.length - 1);

    const anchorX = positions.get(anchorId)?.x ?? 0;
    let cursor = anchorX - totalWidth / 2;

    for (let ci = 0; ci < clusters.length; ci++) {
      const nodes = clusters[ci]!;
      const cw = clusterWidths[ci]!;
      let x = cursor + nodeWidth / 2;
      for (const node of nodes) {
        if (!positions.has(node.id)) {
          positions.set(node.id, { x, y });
        }
        x += nodeWidth + siblingGap;
      }
      cursor += cw + (ci < clusters.length - 1 ? hGap : 0);
    }
  }
}

function nodeByIdGender(nodeId: string, members: Beneficiary[]): "" | "M" | "F" {
  if (nodeId === DECEASED_ID) return "M";
  const id = Number(nodeId.replace("b-", ""));
  const m = members.find((b) => b.id === id);
  return m?.gender === "F" ? "F" : m?.gender === "M" ? "M" : "";
}

function computeIntelligentLayout(
  nodesByGeneration: Map<number, Omit<GenealogyGraphNode, "x" | "y">[]>,
  edges: GenealogyGraphEdge[],
  sortedGens: number[],
  minGen: number,
  metrics: LayoutMetrics,
  members: Beneficiary[],
  deceasedGender?: "M" | "F",
): Map<string, { x: number; y: number }> {
  const nodeById = new Map<string, Omit<GenealogyGraphNode, "x" | "y">>();
  for (const row of nodesByGeneration.values()) {
    for (const node of row) {
      nodeById.set(node.id, node);
    }
  }

  const byId = new Map(members.map((m) => [m.id, m]));
  const spouseIds = new Set(
    members.filter((m) => m.relation_to_donor === "SPOUSE").map((m) => m.id),
  );
  const wives = members.filter(
    (m) => m.relation_to_donor === "SPOUSE" && (m.gender === "F" || (m.gender !== "M" && deceasedGender !== "F")),
  );
  const husbands = members.filter(
    (m) => m.relation_to_donor === "SPOUSE" && (m.gender === "M" || (m.gender !== "F" && deceasedGender === "F")),
  );
  const soleWifeId = wives.length === 1 ? wives[0]!.id : null;
  const soleHusbandId = husbands.length === 1 ? husbands[0]!.id : null;

  const branches = buildSpouseBranches(members, deceasedGender);
  const branchByNodeId = buildBranchIndexByNodeId(members, branches);

  const generationY = layoutGenerationY(sortedGens, minGen, metrics);
  const positions = new Map<string, { x: number; y: number }>();
  const widthMemo = new Map<string, number>();
  const placed = new Set<string>([DECEASED_ID]);

  const gen0 = nodesByGeneration.get(0) ?? [];
  layoutCoreGeneration(gen0, positions, generationY, metrics, deceasedGender);

  const genMinus1 = nodesByGeneration.get(-1) ?? [];
  if (genMinus1.length > 0) {
    layoutParentGeneration(genMinus1, positions, generationY, metrics);
  }

  for (const node of gen0) {
    if (node.id !== DECEASED_ID) placed.add(node.id);
  }

  const layoutCtx = {
    members,
    byId,
    spouseIds,
    soleWifeId,
    soleHusbandId,
    nodeById,
    generationY,
    positions,
    placed,
    metrics,
    widthMemo,
    branchByNodeId,
  };

  const spouseRoots = gen0
    .filter((n) => n.variant === "spouse")
    .sort((a, b) => {
      const ax = positions.get(a.id)?.x ?? 0;
      const bx = positions.get(b.id)?.x ?? 0;
      return ax - bx;
    });
  const siblingRoots = gen0
    .filter((n) => n.variant === "sibling")
    .sort((a, b) => {
      const ax = positions.get(a.id)?.x ?? 0;
      const bx = positions.get(b.id)?.x ?? 0;
      return ax - bx;
    });

  for (const spouse of spouseRoots) {
    const pos = positions.get(spouse.id);
    const deceasedPos = positions.get(DECEASED_ID);
    if (!pos || !deceasedPos) continue;
    // Les enfants partent du milieu de la liaison défunt ↔ conjoint.
    const hubX = (pos.x + deceasedPos.x) / 2;
    placeDescendantsForest(
      spouse.id,
      hubX,
      layoutCtx.members,
      layoutCtx.byId,
      layoutCtx.spouseIds,
      layoutCtx.soleWifeId,
      layoutCtx.soleHusbandId,
      layoutCtx.nodeById,
      layoutCtx.generationY,
      layoutCtx.positions,
      layoutCtx.placed,
      layoutCtx.metrics,
      layoutCtx.widthMemo,
      layoutCtx.branchByNodeId,
    );
  }

  const deceasedPos = positions.get(DECEASED_ID);
  if (deceasedPos) {
    placeDescendantsForest(
      DECEASED_ID,
      deceasedPos.x,
      layoutCtx.members,
      layoutCtx.byId,
      layoutCtx.spouseIds,
      layoutCtx.soleWifeId,
      layoutCtx.soleHusbandId,
      layoutCtx.nodeById,
      layoutCtx.generationY,
      layoutCtx.positions,
      layoutCtx.placed,
      layoutCtx.metrics,
      layoutCtx.widthMemo,
      layoutCtx.branchByNodeId,
    );
  }

  for (const sibling of siblingRoots) {
    const pos = positions.get(sibling.id);
    if (!pos) continue;
    placeDescendantsForest(
      sibling.id,
      pos.x,
      layoutCtx.members,
      layoutCtx.byId,
      layoutCtx.spouseIds,
      layoutCtx.soleWifeId,
      layoutCtx.soleHusbandId,
      layoutCtx.nodeById,
      layoutCtx.generationY,
      layoutCtx.positions,
      layoutCtx.placed,
      layoutCtx.metrics,
      layoutCtx.widthMemo,
      layoutCtx.branchByNodeId,
    );
  }

  for (const gen of sortedGens) {
    if (gen <= 0) continue;
    const row = nodesByGeneration.get(gen) ?? [];
    layoutOrphanGeneration(row, gen, positions, generationY, edges, metrics, members, byId);
  }

  return positions;
}

export function buildGenealogyGraph(
  deceasedName: string,
  members: Beneficiary[],
  options?: { deceasedGender?: "M" | "F"; spacing?: GenealogySpacing },
): GenealogyGraph {
  const metrics = layoutMetricsFor(options?.spacing ?? "default");
  const { nodeWidth, nodeHeight, vGap, padding } = metrics;
  const byId = new Map(members.map((m) => [m.id, m]));
  const generations = new Map<string, number>();
  const edges: GenealogyGraphEdge[] = [];
  const nodeByIdDraft = new Map<string, Omit<GenealogyGraphNode, "x" | "y">>();

  generations.set(DECEASED_ID, 0);

  const deceasedGender = options?.deceasedGender ?? inferDeceasedGender(members);
  const spouseIds = new Set(
    members.filter((m) => m.relation_to_donor === "SPOUSE").map((m) => m.id),
  );
  const wives = members.filter(
    (m) =>
      m.relation_to_donor === "SPOUSE"
      && (m.gender === "F" || (m.gender !== "M" && deceasedGender !== "F")),
  );
  const husbands = members.filter(
    (m) =>
      m.relation_to_donor === "SPOUSE"
      && (m.gender === "M" || (m.gender !== "F" && deceasedGender === "F")),
  );
  const soleWifeId = wives.length === 1 ? wives[0]!.id : null;
  const soleHusbandId = husbands.length === 1 ? husbands[0]!.id : null;
  const hubIds = new Set<string>();

  // Tout couple défunt ↔ conjoint a un nœud d'union (même sans enfant).
  for (const m of members) {
    if (m.relation_to_donor === "SPOUSE") {
      hubIds.add(unionHubId(DECEASED_ID, beneficiaryNodeId(m.id)));
    }
  }

  for (const m of members) {
    const id = beneficiaryNodeId(m.id);
    const draft = nodeFromBeneficiary(m, 0, deceasedGender);
    nodeByIdDraft.set(id, draft);

    switch (m.relation_to_donor) {
      case "PARENT":
        generations.set(id, -1);
        edges.push({
          from: id,
          to: DECEASED_ID,
          kind: "parent",
          style: "from-parent",
        });
        break;
      case "SPOUSE":
        generations.set(id, 0);
        edges.push({
          from: DECEASED_ID,
          to: id,
          kind: "union",
          style: "union",
        });
        break;
      case "SIBLING":
        generations.set(id, 0);
        break;
      case "CHILD":
        generations.set(id, 1);
        pushParentEdgeFromCoupleOrPerson(
          edges,
          m,
          id,
          byId,
          spouseIds,
          soleWifeId,
          soleHusbandId,
          nodeByIdDraft,
          hubIds,
        );
        break;
      default: {
        const hasParentInTree =
          (m.father != null && byId.has(m.father)) ||
          (m.mother != null && byId.has(m.mother));
        if (!hasParentInTree) {
          generations.set(id, 1);
          edges.push({
            from: DECEASED_ID,
            to: id,
            kind: "parent",
            style: "from-deceased",
          });
        }
        break;
      }
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const m of members) {
      const id = beneficiaryNodeId(m.id);
      if (generations.has(id)) continue;
      const parentIds = [m.father, m.mother].filter(
        (pid): pid is number => pid != null && byId.has(pid),
      );
      const knownParents = parentIds
        .map((pid) => beneficiaryNodeId(pid))
        .filter((pid) => generations.has(pid));
      if (knownParents.length === 0) continue;
      const gen =
        Math.max(...knownParents.map((pid) => generations.get(pid)!)) + 1;
      generations.set(id, gen);
      pushParentEdgeFromCoupleOrPerson(
        edges,
        m,
        id,
        byId,
        spouseIds,
        soleWifeId,
        soleHusbandId,
        nodeByIdDraft,
        hubIds,
      );
      changed = true;
    }
  }

  const nodesByGeneration = new Map<number, Omit<GenealogyGraphNode, "x" | "y">[]>();

  nodesByGeneration.set(0, [
    {
      id: DECEASED_ID,
      name: deceasedName,
      subtitle: "De cujus",
      variant: "deceased",
      gender: deceasedGender ?? "",
      generation: 0,
    },
  ]);

  for (const m of members) {
    const id = beneficiaryNodeId(m.id);
    const gen = generations.get(id) ?? 1;
    const draft = nodeFromBeneficiary(m, gen, deceasedGender);
    nodeByIdDraft.set(id, draft);
    const list = nodesByGeneration.get(gen) ?? [];
    list.push(draft);
    nodesByGeneration.set(gen, list);
  }

  const sortedGens = [...nodesByGeneration.keys()].sort((a, b) => a - b);
  const minGen = sortedGens[0] ?? 0;

  const positions = computeIntelligentLayout(
    nodesByGeneration,
    dedupeEdges(edges),
    sortedGens,
    minGen,
    metrics,
    members,
    deceasedGender,
  );

  const nodes: GenealogyGraphNode[] = [];
  for (const row of nodesByGeneration.values()) {
    for (const node of row) {
      const pos = positions.get(node.id) ?? { x: 0, y: 0 };
      nodes.push({ ...node, x: pos.x, y: pos.y });
    }
  }

  // Nœuds d'union : au milieu de chaque couple (liaison dont partent les enfants).
  for (const hubId of hubIds) {
    const partners = parseUnionHubPartners(hubId);
    if (!partners) continue;
    const [a, b] = partners;
    const posA = positions.get(a);
    const posB = positions.get(b);
    if (!posA || !posB) continue;
    const hubPos = { x: (posA.x + posB.x) / 2, y: (posA.y + posB.y) / 2 };
    positions.set(hubId, hubPos);
    nodes.push({
      id: hubId,
      name: "",
      subtitle: "Union",
      variant: "union-hub",
      generation: Math.min(
        nodes.find((n) => n.id === a)?.generation ?? 0,
        nodes.find((n) => n.id === b)?.generation ?? 0,
      ),
      x: hubPos.x,
      y: hubPos.y,
    });
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x - nodeWidth / 2);
    maxX = Math.max(maxX, n.x + nodeWidth / 2);
    minY = Math.min(minY, n.y - nodeHeight / 2);
    maxY = Math.max(maxY, n.y + nodeHeight / 2);
  }
  if (!Number.isFinite(minX)) {
    minX = -nodeWidth / 2;
    maxX = nodeWidth / 2;
    minY = -nodeHeight / 2;
    maxY = nodeHeight / 2;
  }

  const graphWidth = maxX - minX + padding * 2 + nodeWidth * 0.15;
  const graphHeight = maxY - minY + padding * 2 + nodeHeight * 0.15;
  const bleedX = (nodeWidth * 0.15) / 2;
  const bleedY = (nodeHeight * 0.15) / 2;
  const offsetX = padding + bleedX - minX;
  const offsetY = padding + bleedY - minY;

  const branches = buildSpouseBranches(members, deceasedGender);
  const branchByNodeId = buildBranchIndexByNodeId(members, branches);
  const offsetNodes = nodes.map((n) => ({ ...n, x: n.x + offsetX, y: n.y + offsetY }));
  const finalEdges = dedupeEdges(edges);
  const { nodes: styledNodes, edges: styledEdges } = applyBranchStyling(
    offsetNodes,
    finalEdges,
    branchByNodeId,
  );

  return {
    nodes: styledNodes,
    edges: styledEdges,
    width: Math.max(graphWidth, 280),
    height: Math.max(graphHeight, 160),
    branches: branches.length > 1 ? branches : undefined,
  };
}

function dedupeEdges(edges: GenealogyGraphEdge[]): GenealogyGraphEdge[] {
  const seen = new Set<string>();
  return edges.filter((e) => {
    const key = `${e.kind}:${e.from}:${e.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildSpouseBranches(
  members: Beneficiary[],
  deceasedGender?: "M" | "F",
): GenealogyBranch[] {
  const spouses = members
    .filter((m) => m.relation_to_donor === "SPOUSE")
    .sort((a, b) => {
      if (deceasedGender !== "F") {
        if (a.gender === "F" && b.gender !== "F") return -1;
        if (b.gender === "F" && a.gender !== "F") return 1;
      } else {
        if (a.gender === "M" && b.gender !== "M") return -1;
        if (b.gender === "M" && a.gender !== "M") return 1;
      }
      const nameA = `${a.first_name} ${a.last_name}`.trim();
      const nameB = `${b.first_name} ${b.last_name}`.trim();
      return nameA.localeCompare(nameB, "fr");
    });

  return spouses.slice(0, MAX_GENEALOGY_BRANCHES).map((s, index) => ({
    index,
    spouseId: s.id,
    label: `${s.first_name} ${s.last_name}`.trim() || `Conjoint(e) ${index + 1}`,
  }));
}

function buildBranchIndexByNodeId(
  members: Beneficiary[],
  branches: GenealogyBranch[],
): Map<string, number> {
  if (branches.length <= 1) return new Map();

  const branchBySpouseId = new Map(branches.map((b) => [b.spouseId, b.index]));
  const byNodeId = new Map<string, number>();

  for (const m of members) {
    const nodeId = beneficiaryNodeId(m.id);
    if (m.mother != null && branchBySpouseId.has(m.mother)) {
      byNodeId.set(nodeId, branchBySpouseId.get(m.mother)!);
      continue;
    }
    if (m.father != null && branchBySpouseId.has(m.father)) {
      byNodeId.set(nodeId, branchBySpouseId.get(m.father)!);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const m of members) {
      const nodeId = beneficiaryNodeId(m.id);
      if (byNodeId.has(nodeId)) continue;

      if (m.mother != null) {
        const fromMother = byNodeId.get(beneficiaryNodeId(m.mother));
        if (fromMother != null) {
          byNodeId.set(nodeId, fromMother);
          changed = true;
        }
      }
      if (!byNodeId.has(nodeId) && m.father != null) {
        const fromFather = byNodeId.get(beneficiaryNodeId(m.father));
        if (fromFather != null) {
          byNodeId.set(nodeId, fromFather);
          changed = true;
        }
      }
    }
  }

  return byNodeId;
}

function applyBranchStyling(
  nodes: GenealogyGraphNode[],
  edges: GenealogyGraphEdge[],
  branchByNodeId: Map<string, number>,
): { nodes: GenealogyGraphNode[]; edges: GenealogyGraphEdge[] } {
  if (branchByNodeId.size === 0) {
    return { nodes, edges };
  }

  const styledNodes = nodes.map((node) => {
    const branchIndex = branchByNodeId.get(node.id);
    if (branchIndex == null) return node;
    return { ...node, branchIndex };
  });

  const styledEdges = edges.map((edge) => {
    if (edge.kind !== "parent") return edge;
    const branchIndex = branchByNodeId.get(edge.to);
    if (branchIndex == null) return edge;
    return { ...edge, branchIndex };
  });

  return { nodes: styledNodes, edges: styledEdges };
}

/** @deprecated Use buildGenealogyGraph — kept for gradual migration */
export type GenealogyNode = {
  id: string;
  name: string;
  subtitle: string;
  variant: GenealogyNodeVariant;
};

export type GenealogyLayout = {
  deceased: GenealogyNode;
  spouses: GenealogyNode[];
  parents: { father: GenealogyNode | null; mother: GenealogyNode | null };
  children: GenealogyNode[];
  siblings: GenealogyNode[];
};

function toLegacyNode(
  n: Pick<GenealogyGraphNode, "id" | "name" | "subtitle" | "variant">,
): GenealogyNode {
  return { id: n.id, name: n.name, subtitle: n.subtitle, variant: n.variant };
}

function toLegacyNodeFromBeneficiary(b: Beneficiary): GenealogyNode {
  return {
    id: beneficiaryNodeId(b.id),
    name: [b.first_name, b.last_name].filter(Boolean).join(" "),
    subtitle: formatMemberCardLabel(b),
    variant: nodeVariant(b),
  };
}

export function buildGenealogyLayout(
  deceasedName: string,
  members: Beneficiary[],
): GenealogyLayout {
  const graph = buildGenealogyGraph(deceasedName, members);
  const deceased = graph.nodes.find((n) => n.id === DECEASED_ID)!;
  const parentMembers = members.filter((m) => m.relation_to_donor === "PARENT");
  const fatherMember =
    parentMembers.find((m) => m.gender === "M") ?? parentMembers[0] ?? null;
  const motherMember =
    parentMembers.find((m) => m.gender === "F") ??
    (parentMembers.length > 1 ? parentMembers[1] : null);

  return {
    deceased: toLegacyNode(deceased),
    spouses: graph.nodes.filter((n) => n.variant === "spouse").map(toLegacyNode),
    parents: {
      father: fatherMember ? toLegacyNodeFromBeneficiary(fatherMember) : null,
      mother: motherMember ? toLegacyNodeFromBeneficiary(motherMember) : null,
    },
    children: graph.nodes.filter((n) => n.variant === "child").map(toLegacyNode),
    siblings: graph.nodes.filter((n) => n.variant === "sibling").map(toLegacyNode),
  };
}
