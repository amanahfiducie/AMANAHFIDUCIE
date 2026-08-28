"""Mise en page visuelle de l'arbre généalogique pour PDF A4."""

from __future__ import annotations

from dataclasses import dataclass

from reportlab.pdfgen.canvas import Canvas

from reports.pdf_brand import (
    CREAM_DARK,
    EMERALD_BD,
    EMERALD_BG,
    FONT_BOLD,
    FONT_REG,
    GOLD,
    GREEN_DEEP,
    GREEN_MID,
    GREEN_SOFT,
    MUTED,
    ORANGE_BD,
    ORANGE_BG,
    RED_SOFT,
    ROSE_BD,
    ROSE_BG,
    SKY_BD,
    SKY_BG,
    VIOLET_BD,
    VIOLET_BG,
    WHITE,
)

NODE_W = 88.0
NODE_H = 38.0
H_GAP = 14.0
V_GAP = 52.0


@dataclass
class TreeNode:
    id: str
    name: str
    subtitle: str
    variant: str
    x: float
    y: float
    beneficiary_id: int | None = None
    status: str | None = None
    share_label: str | None = None


@dataclass
class TreeEdge:
    from_id: str
    to_id: str


VARIANT_STYLE = {
    "deceased": (GREEN_DEEP, GOLD, WHITE),
    "spouse": (ROSE_BG, ROSE_BD, GREEN_DEEP),
    "parent": (SKY_BG, SKY_BD, GREEN_DEEP),
    "child": (EMERALD_BG, EMERALD_BD, GREEN_DEEP),
    "sibling": (ORANGE_BG, ORANGE_BD, GREEN_DEEP),
    "indirect": (VIOLET_BG, VIOLET_BD, GREEN_DEEP),
    "default": (WHITE, MUTED, GREEN_DEEP),
}


def _variant_for(relation: str) -> str:
    r = (relation or "").upper()
    if r == "SPOUSE":
        return "spouse"
    if r == "PARENT":
        return "parent"
    if r == "CHILD":
        return "child"
    if r == "SIBLING":
        return "sibling"
    if r in ("OTHER", "GRANDCHILD", "NEPHEW", ""):
        return "indirect"
    return "default"


def layout_genealogy_tree(
    *,
    deceased_name: str,
    family_members: list[dict],
    decisions: list[dict] | None = None,
    mode: str = "base",
    page_width: float = 515,
) -> tuple[list[TreeNode], list[TreeEdge], float]:
    decisions = decisions or []
    status_by_ben: dict[int, str] = {}
    share_by_ben: dict[int, str] = {}
    for d in decisions:
        bid = d.get("beneficiary")
        if bid is None:
            continue
        status_by_ben[int(bid)] = str(d.get("status") or "")
        parts: list[str] = []
        sf = d.get("share_fraction")
        if sf not in (None, ""):
            try:
                parts.append(f"{float(sf) * 100:.1f} %")
            except (TypeError, ValueError):
                pass
        if d.get("share_amount"):
            parts.append(str(d["share_amount"]))
        if parts:
            share_by_ben[int(bid)] = " · ".join(parts)

    members = list(family_members or [])
    if mode == "final":
        accepted_ids = {
            int(d["beneficiary"])
            for d in decisions
            if d.get("status") == "ACCEPTED" and d.get("beneficiary") is not None
        }
        members = [m for m in members if int(m.get("id", 0)) in accepted_ids]

    parents = [m for m in members if (m.get("relation_to_donor") or "").upper() == "PARENT"]
    spouses = [m for m in members if (m.get("relation_to_donor") or "").upper() == "SPOUSE"]
    siblings = [m for m in members if (m.get("relation_to_donor") or "").upper() == "SIBLING"]
    children = [m for m in members if (m.get("relation_to_donor") or "").upper() == "CHILD"]
    others = [
        m
        for m in members
        if (m.get("relation_to_donor") or "").upper()
        not in ("PARENT", "SPOUSE", "SIBLING", "CHILD")
    ]

    def _name(m: dict) -> str:
        return f"{m.get('first_name', '')} {m.get('last_name', '')}".strip() or "—"

    def _sub(m: dict) -> str:
        label = m.get("relation_to_donor_label") or m.get("relation_to_donor") or ""
        bid = m.get("id")
        if mode == "final" and bid is not None and int(bid) in share_by_ben:
            return share_by_ben[int(bid)]
        if mode == "decisions" and bid is not None and int(bid) in status_by_ben:
            st = status_by_ben[int(bid)]
            tag = {"ACCEPTED": "retenu", "REJECTED": "exclu", "PENDING": "attente"}.get(
                st, st
            )
            return f"{label} · {tag}" if label else tag
        return str(label)[:28]

    rows: list[list[dict | None]] = []
    if parents:
        rows.append(parents[:6])
    mid: list[dict | None] = [None]
    mid.extend(spouses[:3])
    mid.extend(siblings[:4])
    rows.append(mid)
    if children:
        rows.append(children[:8])
    if others:
        rows.append(others[:8])

    nodes: list[TreeNode] = []
    edges: list[TreeEdge] = []
    y = 0.0
    row_centers: list[list[tuple[str, float]]] = []
    pad_x = 8.0

    for row in rows:
        n = max(len(row), 1)
        total_w = n * NODE_W + (n - 1) * H_GAP
        start_x = max(pad_x, (page_width - total_w) / 2)
        centers: list[tuple[str, float]] = []
        for i, item in enumerate(row):
            x = start_x + i * (NODE_W + H_GAP)
            if item is None:
                nid = "deceased"
                nodes.append(
                    TreeNode(
                        id=nid,
                        name=(deceased_name or "Le défunt")[:20],
                        subtitle="de cujus",
                        variant="deceased",
                        x=x,
                        y=y,
                    )
                )
                centers.append((nid, x + NODE_W / 2))
            else:
                bid = int(item["id"])
                nid = f"b-{bid}"
                nodes.append(
                    TreeNode(
                        id=nid,
                        name=_name(item)[:20],
                        subtitle=_sub(item)[:26],
                        variant=_variant_for(str(item.get("relation_to_donor") or "")),
                        x=x,
                        y=y,
                        beneficiary_id=bid,
                        status=status_by_ben.get(bid),
                        share_label=share_by_ben.get(bid),
                    )
                )
                centers.append((nid, x + NODE_W / 2))
                for parent_key in ("father", "mother"):
                    pid = item.get(parent_key)
                    if pid:
                        edges.append(TreeEdge(f"b-{int(pid)}", nid))
        row_centers.append(centers)
        y += NODE_H + V_GAP

    parents_row = 0 if parents else -1
    deceased_row_idx = 1 if parents else 0

    if parents and parents_row == 0:
        for nid, _cx in row_centers[0]:
            edges.append(TreeEdge(nid, "deceased"))

    for ri in range(deceased_row_idx + 1, len(row_centers)):
        for nid, _cx in row_centers[ri]:
            if not any(e.to_id == nid for e in edges):
                edges.append(TreeEdge("deceased", nid))

    for nid, _cx in row_centers[deceased_row_idx]:
        if nid != "deceased":
            edges.append(TreeEdge("deceased", nid))

    height = y - V_GAP + 8 if nodes else 40
    for n in nodes:
        n.y = height - NODE_H - n.y
    return nodes, edges, height


def draw_genealogy_tree(
    c: Canvas,
    *,
    origin_x: float,
    origin_y: float,
    nodes: list[TreeNode],
    edges: list[TreeEdge],
    height: float,
    width: float = 515,
) -> float:
    """Dessine l'arbre ; origin_y = bas de la bande. Retourne hauteur totale consommée."""
    by_id = {n.id: n for n in nodes}
    pad = 10.0

    c.setFillColor(WHITE)
    c.setStrokeColor(CREAM_DARK)
    c.setLineWidth(0.9)
    c.roundRect(
        origin_x - pad,
        origin_y - pad,
        width + 2 * pad,
        height + 2 * pad,
        10,
        fill=1,
        stroke=1,
    )

    c.setStrokeColor(GREEN_MID)
    c.setLineWidth(1.1)
    for e in edges:
        a, b = by_id.get(e.from_id), by_id.get(e.to_id)
        if not a or not b:
            continue
        x1 = origin_x + a.x + NODE_W / 2
        y1 = origin_y + a.y + NODE_H / 2
        x2 = origin_x + b.x + NODE_W / 2
        y2 = origin_y + b.y + NODE_H / 2
        mid_y = (y1 + y2) / 2
        c.line(x1, y1, x1, mid_y)
        c.line(x1, mid_y, x2, mid_y)
        c.line(x2, mid_y, x2, y2)

    for n in nodes:
        fill, border, text = VARIANT_STYLE.get(n.variant, VARIANT_STYLE["default"])
        x = origin_x + n.x
        y = origin_y + n.y
        c.setFillColor(fill)
        c.setStrokeColor(border)
        c.setLineWidth(1.3)
        c.roundRect(x, y, NODE_W, NODE_H, 6, fill=1, stroke=1)
        c.setFillColor(text)
        c.setFont(FONT_BOLD, 7.5)
        c.drawCentredString(x + NODE_W / 2, y + NODE_H / 2 + 4, n.name)
        c.setFont(FONT_REG, 6)
        c.setFillColor(GOLD if n.variant == "deceased" else MUTED)
        c.drawCentredString(x + NODE_W / 2, y + NODE_H / 2 - 8, n.subtitle or "")

        if n.status in ("ACCEPTED", "REJECTED"):
            stamp = "RETENU" if n.status == "ACCEPTED" else "EXCLU"
            c.setFillColor(GREEN_SOFT if n.status == "ACCEPTED" else RED_SOFT)
            c.roundRect(x + NODE_W - 36, y + NODE_H - 11, 34, 10, 3, fill=1, stroke=0)
            c.setFillColor(GREEN_DEEP)
            c.setFont(FONT_BOLD, 5)
            c.drawCentredString(x + NODE_W - 19, y + NODE_H - 8, stamp)

    return height + 2 * pad
