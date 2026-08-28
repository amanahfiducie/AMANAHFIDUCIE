"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { FamilyMemberDetailModal } from "@/components/succession/family-member-detail-modal";
import {
    buildGenealogyGraph,
    MAX_GENEALOGY_BRANCHES,
    type GenealogyBranch,
    type GenealogyEdgeStyle,
    type GenealogyGraph,
    type GenealogyGraphEdge,
    type GenealogyGraphNode,
    type GenealogyNodeVariant,
} from "@/lib/succession/genealogy-from-family";
import type { Beneficiary, FaraidHeirDecision, FaraidHeirDecisionStatus } from "@/types/api";

type GenealogyTreeProps = {
  deceasedName: string;
  familyMembers: Beneficiary[];
  deceasedGender?: "M" | "F";
  highlightIds?: Set<string>;
  /** Nœuds exclus (revue farāʾiḍ comité) — tampon rouge. */
  excludedIds?: Set<string>;
  /** Statut de décision par nœud (`b-{id}`) — tampons vert / rouge. */
  heirDecisionByNodeId?: Map<string, FaraidHeirDecisionStatus>;
  /** Sous-titres personnalisés par nœud (ex. part %). */
  subtitleOverrides?: Map<string, string>;
  /** N'afficher que ces bénéficiaires (+ le défunt). */
  visibleBeneficiaryIds?: Set<number>;
  /** Mode évaluation comité : bouton détail → validation / refus. */
  heirReviewMode?: boolean;
  decisionsByBeneficiaryId?: Map<number, FaraidHeirDecision>;
  onHeirReviewDetail?: (member: Beneficiary, decision: FaraidHeirDecision | null) => void;
  variant?: "preview" | "full";
  className?: string;
  /** Hauteur de l'aperçu (variant preview). */
  previewHeightClass?: string;
  caseId?: number | null;
  donorId?: number | null;
  editable?: boolean;
  onMembersChange?: () => void;
};

const NODE_W = 132;
const NODE_H = 68;
/** Marge scrollable autour de l'arbre (permet d'atteindre les bords). */
const GENEALOGY_SCROLL_MARGIN = 48;

function clampPanToGraph(
  pan: { x: number; y: number },
  viewportW: number,
  viewportH: number,
  graphW: number,
  graphH: number,
  scale: number,
): { x: number; y: number } {
  const scaledW = graphW * scale;
  const scaledH = graphH * scale;

  const clampAxis = (value: number, viewport: number, scaled: number) => {
    if (scaled <= viewport) return (viewport - scaled) / 2;
    return Math.min(0, Math.max(viewport - scaled, value));
  };

  return {
    x: clampAxis(pan.x, viewportW, scaledW),
    y: clampAxis(pan.y, viewportH, scaledH),
  };
}

function panToRevealGraph(
  viewportW: number,
  viewportH: number,
  graphW: number,
  graphH: number,
  scale: number,
): { x: number; y: number } {
  const scaledW = graphW * scale;
  const scaledH = graphH * scale;
  const x = scaledW <= viewportW ? (viewportW - scaledW) / 2 : 0;
  const y = scaledH <= viewportH ? (viewportH - scaledH) / 2 : 0;
  return clampPanToGraph({ x, y }, viewportW, viewportH, graphW, graphH, scale);
}

const VARIANT_STYLES: Record<GenealogyNodeVariant, string> = {
  deceased:
    "border-amber-400 bg-gradient-to-br from-[var(--sf-green-deep)] to-[var(--sf-green)] text-amber-50 shadow-md shadow-amber-900/20",
  spouse:
    "border-rose-300 bg-gradient-to-br from-rose-50 to-white text-rose-950 shadow-sm shadow-rose-200/60",
  parent:
    "border-sky-300 bg-gradient-to-br from-sky-50 to-white text-sky-950 shadow-sm shadow-sky-200/50",
  child:
    "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white text-emerald-950 shadow-sm shadow-emerald-200/50",
  sibling:
    "border-orange-300 bg-gradient-to-br from-orange-50 to-white text-orange-950 shadow-sm shadow-orange-200/50",
  indirect:
    "border-violet-300 bg-gradient-to-br from-violet-50 to-white text-violet-950 shadow-sm shadow-violet-200/50",
  "union-hub":
    "border-rose-500 bg-rose-500 text-white shadow-sm",
  default:
    "border-slate-300 bg-gradient-to-br from-slate-50 to-white text-slate-900 shadow-sm",
};

const EDGE_STYLES: Record<
  GenealogyEdgeStyle,
  { stroke: string; width: number; dash?: string; opacity: number }
> = {
  union: { stroke: "#e11d48", width: 2, dash: "6 4", opacity: 0.75 },
  "from-deceased": { stroke: "#15803d", width: 2.25, opacity: 0.85 },
  "from-spouse": { stroke: "#0284c7", width: 2, opacity: 0.8 },
  "from-parent": { stroke: "#7c3aed", width: 2, opacity: 0.75 },
  "from-sibling": { stroke: "#ea580c", width: 2, opacity: 0.8 },
  "from-descendant": { stroke: "#6366f1", width: 1.75, opacity: 0.72 },
};

/** Couleurs par lignée (ex. une épouse = une branche d'enfants). */
const CHILD_BRANCH_STYLES: {
  node: string;
  stroke: string;
  width: number;
}[] = [
  {
    node: "border-emerald-400 bg-gradient-to-br from-emerald-50 to-white text-emerald-950 shadow-sm shadow-emerald-200/55",
    stroke: "#059669",
    width: 2.35,
  },
  {
    node: "border-teal-400 bg-gradient-to-br from-teal-50 to-white text-teal-950 shadow-sm shadow-teal-200/55",
    stroke: "#0d9488",
    width: 2.35,
  },
  {
    node: "border-cyan-400 bg-gradient-to-br from-cyan-50 to-white text-cyan-950 shadow-sm shadow-cyan-200/55",
    stroke: "#0891b2",
    width: 2.35,
  },
  {
    node: "border-violet-400 bg-gradient-to-br from-violet-50 to-white text-violet-950 shadow-sm shadow-violet-200/55",
    stroke: "#7c3aed",
    width: 2.35,
  },
  {
    node: "border-fuchsia-400 bg-gradient-to-br from-fuchsia-50 to-white text-fuchsia-950 shadow-sm shadow-fuchsia-200/55",
    stroke: "#c026d3",
    width: 2.35,
  },
  {
    node: "border-amber-400 bg-gradient-to-br from-amber-50 to-white text-amber-950 shadow-sm shadow-amber-200/55",
    stroke: "#d97706",
    width: 2.35,
  },
];

function branchBorderClass(branchIndex: number): string {
  return (
    CHILD_BRANCH_STYLES[branchIndex % MAX_GENEALOGY_BRANCHES].node
      .split(" ")
      .find((c) => c.startsWith("border-")) ?? "border-slate-300"
  );
}

function nodeClassName(node: GenealogyGraphNode): string {
  if (node.branchIndex != null) {
    return CHILD_BRANCH_STYLES[node.branchIndex % MAX_GENEALOGY_BRANCHES].node;
  }
  return VARIANT_STYLES[node.variant];
}

function edgeVisualStyle(edge: GenealogyGraphEdge): {
  stroke: string;
  width: number;
  dash?: string;
  opacity: number;
} {
  if (edge.branchIndex != null) {
    const branch = CHILD_BRANCH_STYLES[edge.branchIndex % MAX_GENEALOGY_BRANCHES];
    return { stroke: branch.stroke, width: branch.width, opacity: 0.88 };
  }
  return EDGE_STYLES[edge.style];
}

const LEGEND_ITEMS: { variant: GenealogyNodeVariant; label: string }[] = [
  { variant: "deceased", label: "Défunt" },
  { variant: "spouse", label: "Conjoint(e)" },
  { variant: "parent", label: "Parent" },
  { variant: "child", label: "Enfant" },
  { variant: "sibling", label: "Frère / sœur" },
  { variant: "indirect", label: "Lien indirect" },
];

function GenderIcon({
  gender,
  variant,
  scale = 1,
}: {
  gender?: "" | "M" | "F";
  variant: GenealogyNodeVariant;
  scale?: number;
}) {
  if (gender !== "M" && gender !== "F") return null;

  const size = Math.max(18, 22 * scale);
  const onDark = variant === "deceased";
  const maleClass = onDark
    ? "bg-sky-400/25 text-sky-100"
    : "bg-sky-100 text-sky-700";
  const femaleClass = onDark
    ? "bg-rose-300/25 text-rose-100"
    : "bg-rose-100 text-rose-700";

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${
        gender === "M" ? maleClass : femaleClass
      }`}
      style={{ width: size, height: size }}
      title={gender === "M" ? "Homme" : "Femme"}
      aria-label={gender === "M" ? "Homme" : "Femme"}
    >
      {gender === "M" ? (
        <svg
          viewBox="0 0 24 24"
          className="h-[58%] w-[58%]"
          fill="currentColor"
          aria-hidden
        >
          <circle cx="12" cy="7.5" r="3.5" />
          <path d="M6.5 20.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5v.5H6.5v-.5z" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-[58%] w-[58%]"
          fill="currentColor"
          aria-hidden
        >
          <circle cx="12" cy="7" r="3.5" />
          <path d="M8.5 21 12 13.5 15.5 21H8.5z" />
        </svg>
      )}
    </span>
  );
}

function DecisionStamp({ status }: { status: FaraidHeirDecisionStatus }) {
  if (status === "ACCEPTED") {
    return (
      <span className="pointer-events-none absolute left-1 right-7 top-1 z-30 rounded bg-emerald-600 px-1 py-0.5 text-center text-[8px] font-black uppercase leading-tight tracking-wide text-white shadow-sm">
        ✓ Retenu
      </span>
    );
  }
  if (status === "REJECTED") {
    return (
      <span className="pointer-events-none absolute left-1 right-7 top-1 z-30 rounded bg-red-600 px-1 py-0.5 text-center text-[8px] font-black uppercase leading-tight tracking-wide text-white shadow-sm">
        ✕ Exclu
      </span>
    );
  }
  return null;
}

function TreeNodeCard({
  node,
  active,
  excluded,
  decisionStatus,
  scale = 1,
  showDetail,
  onDetail,
  subtitleOverride,
}: {
  node: GenealogyGraphNode;
  active?: boolean;
  excluded?: boolean;
  decisionStatus?: FaraidHeirDecisionStatus;
  scale?: number;
  showDetail?: boolean;
  onDetail?: () => void;
  subtitleOverride?: string;
}) {
  const fontSize = Math.max(10, 12 * scale);
  const subSize = Math.max(8, 10 * scale);
  const rejected = decisionStatus === "REJECTED" || excluded;
  const accepted = decisionStatus === "ACCEPTED";

  return (
    <div
      className={`relative rounded-xl border-2 px-2.5 pb-2 pt-7 shadow-sm transition ${
        rejected
          ? "border-red-400/80 bg-gradient-to-br from-red-50/90 to-white text-red-950"
          : accepted
            ? "border-emerald-400/80 bg-gradient-to-br from-emerald-50/90 to-white text-emerald-950"
            : nodeClassName(node)
      } ${active && !rejected ? "ring-2 ring-[var(--sf-gold)] ring-offset-1" : ""}`}
      style={{ width: NODE_W * scale, minHeight: NODE_H * scale }}
    >
      {decisionStatus && decisionStatus !== "PENDING" ? (
        <DecisionStamp status={decisionStatus} />
      ) : null}
      {showDetail && onDetail ? (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDetail();
          }}
          className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white/95 text-[var(--sf-green-deep)] shadow-sm transition hover:bg-white hover:text-[var(--sf-green)]"
          title="Détail et décision"
          aria-label="Détail et décision"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      ) : null}
      <div className="flex items-center gap-1.5 text-left">
        <GenderIcon gender={node.gender} variant={node.variant} scale={scale} />
        <div className="min-w-0 flex-1 pr-7">
          <p className="truncate font-semibold" style={{ fontSize }}>
            {node.name}
          </p>
          <p
            className="truncate font-medium opacity-80"
            style={{ fontSize: subSize }}
          >
            {subtitleOverride ?? node.subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}

function edgePath(
  from: GenealogyGraphNode,
  to: GenealogyGraphNode,
  kind: "parent" | "union",
): string {
  if (kind === "union") {
    // Trait horizontal couple : passe par le nœud d'union (milieu).
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  const fromIsHub = from.variant === "union-hub";
  const fx = from.x;
  const fy = fromIsHub ? from.y : from.y + NODE_H / 2;
  const tx = to.x;
  const ty = to.y - NODE_H / 2;

  // Depuis le nœud d'union : descente puis barre horizontale vers l'enfant.
  const midY = fromIsHub
    ? fy + Math.max(18, (ty - fy) * 0.45)
    : (fy + ty) / 2;
  return `M ${fx} ${fy} L ${fx} ${midY} L ${tx} ${midY} L ${tx} ${ty}`;
}

function GenealogyLegend({
  compact,
  branches,
}: {
  compact?: boolean;
  branches?: GenealogyBranch[];
}) {
  const showBranchLegend = branches != null && branches.length > 1;

  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--sf-cream-dark)]/80 bg-white/70 px-3 py-2 ${
        compact ? "text-[10px]" : "text-xs"
      }`}
    >
      {LEGEND_ITEMS.filter(({ variant }) => !(showBranchLegend && variant === "child")).map(
        ({ variant, label }) => (
          <span key={variant} className="inline-flex items-center gap-1.5">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full border-2 ${VARIANT_STYLES[variant].split(" ").find((c) => c.startsWith("border-")) ?? "border-slate-300"}`}
              aria-hidden
            />
            <span className="text-[var(--sf-green)]/70">{label}</span>
          </span>
        ),
      )}
      {showBranchLegend
        ? branches.map((branch) => (
            <span key={branch.index} className="inline-flex items-center gap-1.5">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full border-2 ${branchBorderClass(branch.index)}`}
                aria-hidden
              />
              <span className="text-[var(--sf-green)]/70">Enfants — {branch.label}</span>
            </span>
          ))
        : null}
      <span className="hidden sm:inline text-[var(--sf-green)]/35">·</span>
      <span className="inline-flex items-center gap-1 text-[var(--sf-green)]/55">
        <svg width="18" height="6" aria-hidden>
          <line x1="0" y1="3" x2="18" y2="3" stroke="#15803d" strokeWidth="2" />
        </svg>
        Descendance
      </span>
      <span className="inline-flex items-center gap-1 text-[var(--sf-green)]/55">
        <svg width="18" height="6" aria-hidden>
          <line
            x1="0"
            y1="3"
            x2="18"
            y2="3"
            stroke="#e11d48"
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        </svg>
        Union
      </span>
      <span className="inline-flex items-center gap-1 text-[var(--sf-green)]/55">
        <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-500 ring-1 ring-rose-200" />
        Nœud de liaison (enfants)
      </span>
    </div>
  );
}

function GenealogyTreeContent({
  graph,
  highlightIds,
  excludedIds,
  heirDecisionByNodeId,
  subtitleOverrides,
  visibleBeneficiaryIds,
  heirReviewMode,
  decisionsByBeneficiaryId,
  memberById,
  editable,
  onOpenMember,
  onHeirReviewDetail,
}: {
  graph: GenealogyGraph;
  highlightIds?: Set<string>;
  excludedIds?: Set<string>;
  heirDecisionByNodeId?: Map<string, FaraidHeirDecisionStatus>;
  subtitleOverrides?: Map<string, string>;
  visibleBeneficiaryIds?: Set<number>;
  heirReviewMode?: boolean;
  decisionsByBeneficiaryId?: Map<number, FaraidHeirDecision>;
  memberById: Map<number, Beneficiary>;
  editable?: boolean;
  onOpenMember?: (member: Beneficiary) => void;
  onHeirReviewDetail?: (member: Beneficiary, decision: FaraidHeirDecision | null) => void;
}) {
  const nodeById = useMemo(
    () => new Map(graph.nodes.map((n) => [n.id, n])),
    [graph.nodes],
  );

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={graph.width}
        height={graph.height}
        aria-hidden
      >
        {graph.edges.map((edge) => {
          const from = nodeById.get(edge.from);
          const to = nodeById.get(edge.to);
          if (!from || !to) return null;
          const style = edgeVisualStyle(edge);
          return (
            <path
              key={`${edge.kind}-${edge.from}-${edge.to}`}
              d={edgePath(from, to, edge.kind)}
              fill="none"
              stroke={style.stroke}
              strokeOpacity={style.opacity}
              strokeWidth={style.width}
              strokeDasharray={style.dash}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          );
        })}
      </svg>

      {graph.nodes.map((node) => {
        if (node.variant === "union-hub") {
          return (
            <div
              key={node.id}
              className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2"
              style={{ left: node.x, top: node.y }}
              title="Liaison du couple"
            >
              <span
                className="block h-3 w-3 rounded-full border-2 border-white bg-rose-500 shadow-sm ring-1 ring-rose-300/80"
                aria-hidden
              />
            </div>
          );
        }
        if (
          node.beneficiaryId != null &&
          visibleBeneficiaryIds &&
          !visibleBeneficiaryIds.has(node.beneficiaryId)
        ) {
          return null;
        }
        const member =
          node.beneficiaryId != null ? memberById.get(node.beneficiaryId) : undefined;
        const decisionStatus =
          heirDecisionByNodeId?.get(node.id) ??
          (excludedIds?.has(node.id) ? "REJECTED" : highlightIds?.has(node.id) ? "ACCEPTED" : undefined);
        const canEditDetail = editable && member && onOpenMember;
        const canReviewDetail =
          heirReviewMode &&
          member &&
          node.variant !== "deceased" &&
          onHeirReviewDetail;
        const decision =
          member && decisionsByBeneficiaryId
            ? decisionsByBeneficiaryId.get(member.id) ?? null
            : null;
        return (
          <div
            key={node.id}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: node.x, top: node.y }}
          >
            <TreeNodeCard
              node={node}
              active={highlightIds?.has(node.id)}
              excluded={excludedIds?.has(node.id)}
              decisionStatus={decisionStatus}
              subtitleOverride={subtitleOverrides?.get(node.id)}
              showDetail={Boolean(canEditDetail || canReviewDetail)}
              onDetail={
                canReviewDetail
                  ? () => onHeirReviewDetail!(member, decision)
                  : canEditDetail
                    ? () => onOpenMember!(member)
                    : undefined
              }
            />
          </div>
        );
      })}
    </>
  );
}

function GenealogyPreviewCanvas({
  graph,
  highlightIds,
  excludedIds,
  heirDecisionByNodeId,
  subtitleOverrides,
  visibleBeneficiaryIds,
  heirReviewMode,
  decisionsByBeneficiaryId,
  fitScale,
  pan,
  zoom,
  memberById,
  editable,
  onOpenMember,
  onHeirReviewDetail,
}: {
  graph: GenealogyGraph;
  highlightIds?: Set<string>;
  excludedIds?: Set<string>;
  heirDecisionByNodeId?: Map<string, FaraidHeirDecisionStatus>;
  subtitleOverrides?: Map<string, string>;
  visibleBeneficiaryIds?: Set<number>;
  heirReviewMode?: boolean;
  decisionsByBeneficiaryId?: Map<number, FaraidHeirDecision>;
  fitScale: number;
  pan: { x: number; y: number };
  zoom: number;
  memberById: Map<number, Beneficiary>;
  editable?: boolean;
  onOpenMember?: (member: Beneficiary) => void;
  onHeirReviewDetail?: (member: Beneficiary, decision: FaraidHeirDecision | null) => void;
}) {
  const effectiveScale = fitScale * zoom;

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveScale})`,
          width: graph.width,
          height: graph.height,
        }}
      >
        <div className="relative" style={{ width: graph.width, height: graph.height }}>
          <GenealogyTreeContent
            graph={graph}
            highlightIds={highlightIds}
            excludedIds={excludedIds}
            heirDecisionByNodeId={heirDecisionByNodeId}
            subtitleOverrides={subtitleOverrides}
            visibleBeneficiaryIds={visibleBeneficiaryIds}
            heirReviewMode={heirReviewMode}
            decisionsByBeneficiaryId={decisionsByBeneficiaryId}
            memberById={memberById}
            editable={editable}
            onOpenMember={onOpenMember}
            onHeirReviewDetail={onHeirReviewDetail}
          />
        </div>
      </div>
    </div>
  );
}

function GenealogyScrollCanvas({
  graph,
  highlightIds,
  excludedIds,
  heirDecisionByNodeId,
  subtitleOverrides,
  visibleBeneficiaryIds,
  heirReviewMode,
  decisionsByBeneficiaryId,
  zoom,
  onZoomChange,
  scrollRef,
  hBarRef,
  memberById,
  editable,
  onOpenMember,
  onHeirReviewDetail,
  onPanDelta,
}: {
  graph: GenealogyGraph;
  highlightIds?: Set<string>;
  excludedIds?: Set<string>;
  heirDecisionByNodeId?: Map<string, FaraidHeirDecisionStatus>;
  subtitleOverrides?: Map<string, string>;
  visibleBeneficiaryIds?: Set<number>;
  heirReviewMode?: boolean;
  decisionsByBeneficiaryId?: Map<number, FaraidHeirDecision>;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  hBarRef: React.RefObject<HTMLDivElement | null>;
  memberById: Map<number, Beneficiary>;
  editable?: boolean;
  onOpenMember?: (member: Beneficiary) => void;
  onHeirReviewDetail?: (member: Beneficiary, decision: FaraidHeirDecision | null) => void;
  onPanDelta: (dx: number, dy: number) => void;
}) {
  const dragRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);
  const syncingRef = useRef(false);
  const [viewport, setViewport] = useState({ w: 640, h: 400 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const { clientWidth, clientHeight } = el;
      if (clientWidth <= 0 || clientHeight <= 0) return;
      setViewport({ w: clientWidth, h: clientHeight });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  const treeW = graph.width * zoom;
  const treeH = graph.height * zoom;
  const pad = GENEALOGY_SCROLL_MARGIN;
  const contentW = Math.max(treeW + pad * 2, viewport.w + 80);
  const contentH = Math.max(treeH + pad * 2, viewport.h + 80);

  const syncFromMain = useCallback(() => {
    const main = scrollRef.current;
    const bar = hBarRef.current;
    if (!main || !bar || syncingRef.current) return;
    syncingRef.current = true;
    bar.scrollLeft = main.scrollLeft;
    syncingRef.current = false;
  }, [hBarRef, scrollRef]);

  const syncFromBar = useCallback(() => {
    const main = scrollRef.current;
    const bar = hBarRef.current;
    if (!main || !bar || syncingRef.current) return;
    syncingRef.current = true;
    main.scrollLeft = bar.scrollLeft;
    syncingRef.current = false;
  }, [hBarRef, scrollRef]);

  useEffect(() => {
    const main = scrollRef.current;
    if (!main) return;
    const onScroll = () => syncFromMain();
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, [scrollRef, syncFromMain, contentW]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = scrollRef.current;
    if (!el) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: el.scrollLeft,
      scrollTop: el.scrollTop,
    };
  }, [scrollRef]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragRef.current;
      const el = scrollRef.current;
      if (!drag || !el) return;
      el.scrollLeft = drag.scrollLeft - (e.clientX - drag.startX);
      el.scrollTop = drag.scrollTop - (e.clientY - drag.startY);
      syncFromMain();
    },
    [scrollRef, syncFromMain],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.08 : 0.08;
        onZoomChange(Math.min(2.5, Math.max(0.35, zoom + delta)));
        return;
      }
      if (e.shiftKey && e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
        syncFromMain();
        return;
      }
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        el.scrollLeft += e.deltaX;
        syncFromMain();
      }
    },
    [onZoomChange, scrollRef, syncFromMain, zoom],
  );

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-white">
      <div
        ref={scrollRef}
        tabIndex={0}
        className="genealogy-scroll-area genealogy-scroll-y min-h-0 flex-1 cursor-grab outline-none active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--sf-gold)]/40"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
      >
        <div className="relative shrink-0" style={{ width: contentW, height: contentH }}>
          <div
            className="absolute overflow-visible"
            style={{
              left: pad,
              top: pad,
              width: treeW,
              height: treeH,
            }}
          >
            <div
              className="relative origin-top-left"
              style={{
                width: graph.width,
                height: graph.height,
                transform: `scale(${zoom})`,
              }}
            >
              <GenealogyTreeContent
                graph={graph}
                highlightIds={highlightIds}
                excludedIds={excludedIds}
                heirDecisionByNodeId={heirDecisionByNodeId}
                subtitleOverrides={subtitleOverrides}
                visibleBeneficiaryIds={visibleBeneficiaryIds}
                heirReviewMode={heirReviewMode}
                decisionsByBeneficiaryId={decisionsByBeneficiaryId}
                memberById={memberById}
                editable={editable}
                onOpenMember={onOpenMember}
                onHeirReviewDetail={onHeirReviewDetail}
              />
            </div>
          </div>
        </div>
      </div>

      <div
        ref={hBarRef}
        className="genealogy-scroll-area genealogy-scroll-hbar shrink-0 border-t-2 border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]"
        onScroll={syncFromBar}
        aria-label="Défilement horizontal"
      >
        <div style={{ width: contentW, height: 1 }} aria-hidden />
      </div>

      <TreeNavigationPad onPanDelta={onPanDelta} />
    </div>
  );
}

function scrollToRevealGraph(
  scrollEl: HTMLDivElement,
  opts: { graphW: number; graphH: number; zoom: number; align?: "left" | "center"; contentW?: number },
  hBarEl?: HTMLDivElement | null,
) {
  const { graphW, graphH, zoom, align = "left" } = opts;
  const margin = GENEALOGY_SCROLL_MARGIN;
  const scaledW = graphW * zoom;
  const scaledH = graphH * zoom;
  const contentW = opts.contentW ?? scaledW + margin * 2;
  const contentH = scaledH + margin * 2;
  const maxScrollLeft = Math.max(0, contentW - scrollEl.clientWidth);
  const maxScrollTop = Math.max(0, contentH - scrollEl.clientHeight);

  if (align === "left") {
    scrollEl.scrollLeft = Math.min(maxScrollLeft, margin);
  } else {
    scrollEl.scrollLeft = maxScrollLeft / 2;
  }

  scrollEl.scrollTop = Math.min(maxScrollTop, Math.max(0, (contentH - scrollEl.clientHeight) / 2));
  if (hBarEl) hBarEl.scrollLeft = scrollEl.scrollLeft;
}

function scrollByDelta(
  scrollEl: HTMLDivElement | null,
  hBarEl: HTMLDivElement | null | undefined,
  dx: number,
  dy: number,
) {
  if (!scrollEl) return;
  scrollEl.scrollBy({ left: -dx, top: -dy, behavior: "auto" });
  if (hBarEl) hBarEl.scrollLeft = scrollEl.scrollLeft;
}

function EmptyGenealogyState({ compact }: { compact?: boolean }) {
  return (
    <div
      className={`flex items-center justify-center rounded-2xl border border-dashed border-[var(--sf-cream-dark)] bg-[var(--sf-cream)]/40 text-center ${
        compact ? "h-full min-h-[10rem] px-4" : "p-8"
      }`}
    >
      <p className="text-sm text-[var(--sf-green)]/60">
        Ajoutez les membres de la famille pour construire l&apos;arbre — commencez par le
        conjoint ou les parents si vous enregistrez des enfants.
      </p>
    </div>
  );
}

function TreeNavigationPad({
  onPanDelta,
}: {
  onPanDelta: (dx: number, dy: number) => void;
}) {
  const padRef = useRef<HTMLDivElement>(null);
  const onPanDeltaRef = useRef(onPanDelta);
  onPanDeltaRef.current = onPanDelta;

  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ vx: number; vy: number; raf: number } | null>(null);
  const holdRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const MAX_KNOB = 28;
  const PAN_STEP = 48;

  const pan = useCallback((dx: number, dy: number) => {
    onPanDeltaRef.current(dx, dy);
  }, []);

  const stopHold = useCallback(() => {
    if (holdRef.current) {
      clearInterval(holdRef.current);
      holdRef.current = null;
    }
  }, []);

  const stopDrag = useCallback(() => {
    if (dragRef.current) {
      cancelAnimationFrame(dragRef.current.raf);
      dragRef.current = null;
    }
    setDragging(false);
    setKnob({ x: 0, y: 0 });
  }, []);

  useEffect(
    () => () => {
      stopHold();
      stopDrag();
    },
    [stopDrag, stopHold],
  );

  const startHold = useCallback(
    (dx: number, dy: number) => {
      stopHold();
      pan(dx, dy);
      holdRef.current = setInterval(() => pan(dx, dy), 70);
    },
    [pan, stopHold],
  );

  const knobOffsetFromPointer = useCallback((clientX: number, clientY: number) => {
    const el = padRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let x = clientX - cx;
    let y = clientY - cy;
    const dist = Math.hypot(x, y);
    if (dist > MAX_KNOB) {
      x = (x / dist) * MAX_KNOB;
      y = (y / dist) * MAX_KNOB;
    }
    return { x, y };
  }, []);

  const onKnobPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragging(true);
      const offset = knobOffsetFromPointer(e.clientX, e.clientY);
      setKnob(offset);

      const tick = () => {
        const drag = dragRef.current;
        if (!drag) return;
        const mag = Math.hypot(drag.vx, drag.vy);
        if (mag > 2) {
          const speed = Math.min(mag / MAX_KNOB, 1) * 16;
          pan((-drag.vx / mag) * speed, (-drag.vy / mag) * speed);
        }
        drag.raf = requestAnimationFrame(tick);
      };

      dragRef.current = { vx: offset.x, vy: offset.y, raf: requestAnimationFrame(tick) };

      const onMove = (ev: PointerEvent) => {
        const next = knobOffsetFromPointer(ev.clientX, ev.clientY);
        setKnob(next);
        if (dragRef.current) {
          dragRef.current.vx = next.x;
          dragRef.current.vy = next.y;
        }
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        stopDrag();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [knobOffsetFromPointer, pan, stopDrag],
  );

  const dirButton = (label: string, dx: number, dy: number, className: string) => (
    <button
      type="button"
      aria-label={label}
      className={`absolute z-10 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--sf-cream-dark)] bg-white/95 text-[var(--sf-green-deep)] shadow-sm transition hover:bg-[var(--sf-cream)] active:scale-95 ${className}`}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        startHold(dx, dy);
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        stopHold();
      }}
      onPointerLeave={stopHold}
      onPointerCancel={stopHold}
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor" aria-hidden>
        {label === "Monter" ? (
          <path d="M12 4 4 14h16L12 4z" />
        ) : label === "Descendre" ? (
          <path d="M12 20 4 10h16l-8 10z" />
        ) : label === "Aller à gauche" ? (
          <path d="M4 12 14 4v20L4 12z" />
        ) : (
          <path d="M20 12 10 4v16l10-8z" />
        )}
      </svg>
    </button>
  );

  return (
    <div
      ref={padRef}
      className="pointer-events-auto absolute bottom-[4.25rem] left-4 z-30 h-[5.75rem] w-[5.75rem] select-none rounded-full border border-[var(--sf-cream-dark)] bg-white/92 shadow-xl backdrop-blur-sm"
      aria-label="Boule de navigation dans l'arbre"
      role="group"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {dirButton("Monter", 0, PAN_STEP, "left-1/2 top-0.5 -translate-x-1/2")}
      {dirButton("Descendre", 0, -PAN_STEP, "bottom-0.5 left-1/2 -translate-x-1/2")}
      {dirButton("Aller à gauche", PAN_STEP, 0, "left-0.5 top-1/2 -translate-y-1/2")}
      {dirButton("Aller à droite", -PAN_STEP, 0, "right-0.5 top-1/2 -translate-y-1/2")}

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className={`relative z-20 h-11 w-11 touch-none rounded-full border-2 border-[var(--sf-green-deep)]/30 bg-gradient-to-br from-[var(--sf-cream)] to-white shadow-md ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
          style={{
            transform: `translate(${knob.x}px, ${knob.y}px)`,
            transition: dragging ? "none" : "transform 150ms ease-out",
          }}
          onPointerDown={onKnobPointerDown}
          title="Glisser pour naviguer"
        >
          <div className="pointer-events-none absolute inset-2 rounded-full bg-[var(--sf-green-deep)]/12" />
        </div>
      </div>
    </div>
  );
}

function useFitScale(
  graph: GenealogyGraph,
  containerRef: React.RefObject<HTMLDivElement | null>,
  compressToFit = true,
) {
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      if (!compressToFit) {
        setFitScale(1);
        return;
      }
      const sx = width / graph.width;
      const sy = height / graph.height;
      setFitScale(Math.min(sx, sy, 1));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [graph.width, graph.height, compressToFit]);

  return fitScale;
}

function GenealogyViewport({
  graph,
  highlightIds,
  excludedIds,
  heirDecisionByNodeId,
  subtitleOverrides,
  visibleBeneficiaryIds,
  heirReviewMode,
  decisionsByBeneficiaryId,
  interactive,
  heightClass,
  familyMembers,
  editable,
  onOpenMember,
  onHeirReviewDetail,
  compressToFit = true,
  onRequestClose,
}: {
  graph: GenealogyGraph;
  highlightIds?: Set<string>;
  excludedIds?: Set<string>;
  heirDecisionByNodeId?: Map<string, FaraidHeirDecisionStatus>;
  subtitleOverrides?: Map<string, string>;
  visibleBeneficiaryIds?: Set<number>;
  heirReviewMode?: boolean;
  decisionsByBeneficiaryId?: Map<number, FaraidHeirDecision>;
  interactive: boolean;
  heightClass: string;
  familyMembers: Beneficiary[];
  editable?: boolean;
  onOpenMember?: (member: Beneficiary) => void;
  onHeirReviewDetail?: (member: Beneficiary, decision: FaraidHeirDecision | null) => void;
  compressToFit?: boolean;
  onRequestClose?: () => void;
}) {
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hBarRef = useRef<HTMLDivElement>(null);
  const fitScale = useFitScale(graph, previewContainerRef, compressToFit);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const memberById = useMemo(
    () => new Map(familyMembers.map((m) => [m.id, m])),
    [familyMembers],
  );

  const revealGraphView = useCallback(
    (align: "left" | "center" = "left") => {
      if (interactive) {
        const el = scrollRef.current;
        if (el) {
          scrollToRevealGraph(
            el,
            { graphW: graph.width, graphH: graph.height, zoom, align },
            hBarRef.current,
          );
        }
        return;
      }
      const el = previewContainerRef.current;
      if (!el) return;
      const { width, height } = el.getBoundingClientRect();
      setPan(panToRevealGraph(width, height, graph.width, graph.height, fitScale * zoom));
    },
    [fitScale, graph.height, graph.width, interactive, zoom],
  );

  const clampZoom = useCallback((next: number | ((z: number) => number)) => {
    setZoom((prev) => {
      const raw = typeof next === "function" ? next(prev) : next;
      return Math.min(2.5, Math.max(0.35, raw));
    });
  }, []);

  useEffect(() => {
    if (!interactive) return;
    const el = scrollRef.current;
    if (!el) return;
    scrollToRevealGraph(el, { graphW: graph.width, graphH: graph.height, zoom, align: "left" });
  }, [interactive, graph.width, graph.height, zoom]);

  useEffect(() => {
    if (interactive) return;
    revealGraphView("left");
  }, [interactive, graph.width, graph.height, fitScale, revealGraphView]);

  useEffect(() => {
    if (!interactive) return;
    const el = scrollRef.current;
    if (!el) return;

    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 80 : 48;
      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          scrollByDelta(el, hBarRef.current, step, 0);
          break;
        case "ArrowRight":
          e.preventDefault();
          scrollByDelta(el, hBarRef.current, -step, 0);
          break;
        case "ArrowUp":
          e.preventDefault();
          scrollByDelta(el, hBarRef.current, 0, step);
          break;
        case "ArrowDown":
          e.preventDefault();
          scrollByDelta(el, hBarRef.current, 0, -step);
          break;
        default:
          break;
      }
    };

    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [interactive]);

  const resetView = () => {
    clampZoom(1);
    requestAnimationFrame(() => revealGraphView("left"));
  };

  const panByDelta = useCallback((dx: number, dy: number) => {
    scrollByDelta(scrollRef.current, hBarRef.current, dx, dy);
  }, []);

  const toolbar = interactive ? (
    <div className="relative z-20 flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--sf-cream-dark)] bg-[var(--sf-cream)] px-3 py-2">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]"
          onClick={() => clampZoom((z) => z + 0.15)}
          aria-label="Zoom avant"
        >
          +
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]"
          onClick={() => clampZoom((z) => z - 0.15)}
          aria-label="Zoom arrière"
        >
          −
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]"
          onClick={() => revealGraphView("left")}
        >
          ← Gauche
        </button>
        <button
          type="button"
          className="rounded-lg border border-[var(--sf-cream-dark)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]"
          onClick={resetView}
        >
          Tout voir
        </button>
        <span className="ml-1 hidden text-[10px] text-[var(--sf-green)]/50 lg:inline">
          « Gauche » · barres verticale (droite) et horizontale (bas) · boule · Ctrl+molette : zoom
        </span>
      </div>
      {onRequestClose ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--sf-green-deep)]/20 bg-white px-2.5 py-1 text-xs font-semibold text-[var(--sf-green-deep)] hover:bg-[var(--sf-cream)]"
          onClick={onRequestClose}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          Fermer
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <div
      className={
        interactive
          ? `flex min-h-0 w-full flex-col overflow-hidden ${heightClass || "h-full"}`
          : `flex flex-col ${heightClass}`
      }
    >
      {toolbar}
      <div className="relative min-h-0 flex-1">
        {interactive ? (
          <GenealogyScrollCanvas
            graph={graph}
            highlightIds={highlightIds}
            excludedIds={excludedIds}
            heirDecisionByNodeId={heirDecisionByNodeId}
            subtitleOverrides={subtitleOverrides}
            visibleBeneficiaryIds={visibleBeneficiaryIds}
            heirReviewMode={heirReviewMode}
            decisionsByBeneficiaryId={decisionsByBeneficiaryId}
            zoom={zoom}
            onZoomChange={clampZoom}
            scrollRef={scrollRef}
            hBarRef={hBarRef}
            memberById={memberById}
            editable={editable}
            onOpenMember={onOpenMember}
            onHeirReviewDetail={onHeirReviewDetail}
            onPanDelta={panByDelta}
          />
        ) : (
          <div ref={previewContainerRef} className="relative h-full overflow-hidden">
            <GenealogyPreviewCanvas
              graph={graph}
              highlightIds={highlightIds}
              excludedIds={excludedIds}
              heirDecisionByNodeId={heirDecisionByNodeId}
              subtitleOverrides={subtitleOverrides}
              visibleBeneficiaryIds={visibleBeneficiaryIds}
              heirReviewMode={heirReviewMode}
              decisionsByBeneficiaryId={decisionsByBeneficiaryId}
              fitScale={fitScale}
              pan={pan}
              zoom={zoom}
              memberById={memberById}
              editable={editable}
              onOpenMember={onOpenMember}
              onHeirReviewDetail={onHeirReviewDetail}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function GenealogyExplorerModal({
  open,
  onClose,
  graph,
  highlightIds,
  excludedIds,
  heirDecisionByNodeId,
  subtitleOverrides,
  visibleBeneficiaryIds,
  heirReviewMode,
  decisionsByBeneficiaryId,
  deceasedName,
  familyMembers,
  editable,
  onOpenMember,
  onHeirReviewDetail,
}: {
  open: boolean;
  onClose: () => void;
  graph: GenealogyGraph;
  highlightIds?: Set<string>;
  excludedIds?: Set<string>;
  heirDecisionByNodeId?: Map<string, FaraidHeirDecisionStatus>;
  subtitleOverrides?: Map<string, string>;
  visibleBeneficiaryIds?: Set<number>;
  heirReviewMode?: boolean;
  decisionsByBeneficiaryId?: Map<number, FaraidHeirDecision>;
  deceasedName: string;
  familyMembers: Beneficiary[];
  editable?: boolean;
  onOpenMember?: (member: Beneficiary) => void;
  onHeirReviewDetail?: (member: Beneficiary, decision: FaraidHeirDecision | null) => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] isolate flex flex-col bg-[var(--sf-green-deep)]/60 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label={`Arbre généalogique — ${deceasedName}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-[var(--sf-green-deep)] px-4 py-3 text-white">
        <div>
          <p className="text-sm font-semibold">Arbre généalogique — grand format</p>
          <p className="text-xs text-white/70">{deceasedName}</p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg border border-white/30 bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25"
          onClick={onClose}
          aria-label="Fermer l'arbre agrandi"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
          Fermer
        </button>
      </div>
      <div className="min-h-0 flex-1 bg-gradient-to-b from-[var(--sf-cream)]/95 to-white p-2 sm:p-4">
        <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-white shadow-lg">
          <div className="flex min-h-0 flex-1 flex-col">
            <GenealogyViewport
              graph={graph}
              highlightIds={highlightIds}
              excludedIds={excludedIds}
              heirDecisionByNodeId={heirDecisionByNodeId}
              subtitleOverrides={subtitleOverrides}
              visibleBeneficiaryIds={visibleBeneficiaryIds}
              heirReviewMode={heirReviewMode}
              decisionsByBeneficiaryId={decisionsByBeneficiaryId}
              interactive
              heightClass=""
              familyMembers={familyMembers}
              editable={editable}
              onOpenMember={onOpenMember}
              onHeirReviewDetail={onHeirReviewDetail}
              compressToFit={false}
              onRequestClose={onClose}
            />
          </div>
          <GenealogyLegend branches={graph.branches} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function GenealogyTree({
  deceasedName,
  familyMembers,
  deceasedGender,
  highlightIds,
  excludedIds,
  heirDecisionByNodeId,
  subtitleOverrides,
  visibleBeneficiaryIds,
  heirReviewMode = false,
  decisionsByBeneficiaryId,
  onHeirReviewDetail,
  variant = "preview",
  className = "",
  previewHeightClass = "h-44 sm:h-52",
  caseId = null,
  donorId = null,
  editable = false,
  onMembersChange,
}: GenealogyTreeProps) {
  const [expanded, setExpanded] = useState(false);
  const [detailMember, setDetailMember] = useState<Beneficiary | null>(null);
  const previewGraph = useMemo(
    () =>
      buildGenealogyGraph(deceasedName, familyMembers, {
        deceasedGender,
        spacing: "default",
      }),
    [deceasedName, familyMembers, deceasedGender],
  );
  const expandedGraph = useMemo(
    () =>
      buildGenealogyGraph(deceasedName, familyMembers, {
        deceasedGender,
        spacing: "expanded",
      }),
    [deceasedName, familyMembers, deceasedGender],
  );

  const canEdit = editable && Boolean(caseId && onMembersChange);

  function handleOpenMember(member: Beneficiary) {
    setDetailMember(member);
  }

  function handleMemberUpdated() {
    onMembersChange?.();
    setDetailMember(null);
  }

  const treeBody = (
    graph: typeof previewGraph,
    interactive: boolean,
    heightClass: string,
    compressToFit = true,
    onRequestClose?: () => void,
  ) => (
    <GenealogyViewport
      graph={graph}
      highlightIds={highlightIds}
      excludedIds={excludedIds}
      heirDecisionByNodeId={heirDecisionByNodeId}
      subtitleOverrides={subtitleOverrides}
      visibleBeneficiaryIds={visibleBeneficiaryIds}
      heirReviewMode={heirReviewMode}
      decisionsByBeneficiaryId={decisionsByBeneficiaryId}
      interactive={interactive}
      heightClass={heightClass}
      familyMembers={familyMembers}
      editable={canEdit}
      onOpenMember={canEdit ? handleOpenMember : undefined}
      onHeirReviewDetail={heirReviewMode ? onHeirReviewDetail : undefined}
      compressToFit={compressToFit}
      onRequestClose={onRequestClose}
    />
  );

  if (familyMembers.length === 0) {
    return <EmptyGenealogyState compact={variant === "preview"} />;
  }

  if (variant === "full") {
    return (
      <>
        <div
          className={`overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-gradient-to-b from-[var(--sf-cream)]/80 to-white ${className}`}
          role="img"
          aria-label="Arbre généalogique de la succession"
        >
          {treeBody(expandedGraph, true, "h-[min(70vh,520px)]", false)}
          <GenealogyLegend branches={expandedGraph.branches} />
        </div>
        <FamilyMemberDetailModal
          open={detailMember != null}
          member={detailMember}
          allMembers={familyMembers}
          donorId={donorId}
          onClose={() => setDetailMember(null)}
          onUpdated={handleMemberUpdated}
        />
      </>
    );
  }

  return (
    <>
      <div
        className={`overflow-hidden rounded-2xl border border-[var(--sf-cream-dark)] bg-gradient-to-b from-[var(--sf-cream)]/80 to-white ${className}`}
        role="img"
        aria-label="Aperçu de l'arbre généalogique"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[var(--sf-cream-dark)]/80 bg-white/60 px-3 py-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--sf-green)]/55">
              Arbre généalogique
            </p>
            <p className="text-[11px] text-[var(--sf-green)]/45">
              {familyMembers.length} membre{familyMembers.length > 1 ? "s" : ""} enregistré
              {familyMembers.length > 1 ? "s" : ""}
            </p>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-[var(--sf-gold)]/40 bg-[var(--sf-cream)] px-2.5 py-1 text-xs font-semibold text-[var(--sf-green-deep)] hover:bg-[var(--sf-gold)]/15"
            onClick={() => setExpanded(true)}
          >
            Agrandir ↗
          </button>
        </div>
        <div className={`relative overflow-hidden ${previewHeightClass}`}>
          {treeBody(previewGraph, false, "h-full", false)}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-center bg-gradient-to-t from-white via-white/80 to-transparent pb-2 pt-10">
            <p className="text-[10px] font-medium text-[var(--sf-green)]/55">
              Aperçu à taille réelle — agrandissez pour explorer tout l&apos;arbre
            </p>
          </div>
        </div>
        <GenealogyLegend compact branches={previewGraph.branches} />
      </div>

      <GenealogyExplorerModal
        open={expanded}
        onClose={() => setExpanded(false)}
        graph={expandedGraph}
        highlightIds={highlightIds}
        excludedIds={excludedIds}
        heirDecisionByNodeId={heirDecisionByNodeId}
        subtitleOverrides={subtitleOverrides}
        visibleBeneficiaryIds={visibleBeneficiaryIds}
        heirReviewMode={heirReviewMode}
        decisionsByBeneficiaryId={decisionsByBeneficiaryId}
        deceasedName={deceasedName}
        familyMembers={familyMembers}
        editable={canEdit}
        onOpenMember={canEdit ? handleOpenMember : undefined}
        onHeirReviewDetail={heirReviewMode ? onHeirReviewDetail : undefined}
      />

      <FamilyMemberDetailModal
        open={detailMember != null}
        member={detailMember}
        allMembers={familyMembers}
        donorId={donorId}
        onClose={() => setDetailMember(null)}
        onUpdated={handleMemberUpdated}
      />
    </>
  );
}
