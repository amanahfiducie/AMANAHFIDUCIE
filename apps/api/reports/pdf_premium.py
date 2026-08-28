"""Rendu PDF A4 premium — présentation visuelle fidèle à l'aperçu HTML."""

from __future__ import annotations

import io
from typing import Any

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

from reports.pdf_brand import (
    AMBER_BG,
    CHART_PALETTE,
    CREAM,
    CREAM_DARK,
    FONT_BOLD,
    FONT_REG,
    GOLD,
    GOLD_SOFT,
    GREEN,
    GREEN_DEEP,
    GREEN_MID,
    MUTED,
    NON_INVESTED,
    PDF_ENGINE,
    WHITE,
    asset_class_color,
    asset_class_label,
    ensure_fonts,
    horizontal_logo_path,
    icon_logo_path,
    qr_path,
)
from reports.pdf_genealogy import draw_genealogy_tree, layout_genealogy_tree

PAGE_W, PAGE_H = A4
MARGIN_X = 40.0
CONTENT_W = PAGE_W - 2 * MARGIN_X
HEADER_H_FIRST = 118.0
HEADER_H_NEXT = 52.0
FOOTER_H = 36.0


class PremiumReportPdf:
    def __init__(self, report, snapshot: dict[str, Any]):
        ensure_fonts()
        self.report = report
        self.snap = snapshot
        self.buf = io.BytesIO()
        self.c = canvas.Canvas(self.buf, pagesize=A4)
        self.page = 1
        self.y = PAGE_H - HEADER_H_FIRST - 16

        self.case = snapshot.get("case") or {}
        self.period = snapshot.get("period") or {}
        self.kpis = snapshot.get("kpis") or {}
        self.currency = self.kpis.get("currency") or "XOF"
        self.service = snapshot.get("service") or {}
        if not self.service:
            from reports.service_profiles import get_service_report_profile

            self.service = get_service_report_profile(self.case.get("case_type"))
        self.sections = self.service.get("sections") or {}

    def build(self) -> bytes:
        self._paint_page_chrome(first=True)
        self._draw_cover_meta()
        self._draw_kpis()

        # Ordre aligné sur l'aperçu HTML (case-report-preview)
        if self.sections.get("waqf") and self.snap.get("waqf"):
            self._draw_waqf()
        if self.sections.get("zakat") and self.snap.get("zakat"):
            self._draw_zakat()
        if self.sections.get("genealogy") and self.snap.get("genealogy"):
            self._draw_genealogy_section()
        if self.sections.get("faraid") and self.snap.get("faraid"):
            self._draw_faraid()
        if self.sections.get("finance") and self.snap.get("finance"):
            self._draw_finance()
        if self.sections.get("patrimony") and self.snap.get("patrimony"):
            self._draw_patrimony()
        if self.sections.get("investments") and self.snap.get("investments"):
            self._draw_investments()
        if self.sections.get("people"):
            self._draw_people()
        if self.sections.get("mandates"):
            self._draw_mandates()

        self._draw_closing()
        self._finish_page()
        self.c.save()
        return self.buf.getvalue()

    # ── chrome ──────────────────────────────────────────────


    def _paint_page_chrome(self, first: bool = False) -> None:
        c = self.c
        c.setFillColor(WHITE)
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

        if first:
            self._draw_letterhead()
            header_h = HEADER_H_FIRST
        else:
            self._draw_letterhead_compact()
            header_h = HEADER_H_NEXT

        c.setFillColor(GREEN_DEEP)
        c.rect(0, 0, PAGE_W, FOOTER_H, fill=1, stroke=0)
        c.setFillColor(GOLD)
        c.rect(0, FOOTER_H, PAGE_W, 1.5, fill=1, stroke=0)
        c.setFillColor(GOLD_SOFT)
        c.setFont(FONT_REG, 7)
        c.drawString(
            MARGIN_X,
            14,
            "Document confidentiel — Amanah Fiducie  ·  amanahfiducie.sn",
        )
        c.drawRightString(PAGE_W - MARGIN_X, 14, f"Page {self.page}")
        self.y = PAGE_H - header_h - 14

    def _draw_letterhead(self) -> None:
        """En-tête premium page 1 — logo horizontal officiel, claim, QR."""
        c = self.c
        top = PAGE_H

        c.setFillColor(GOLD)
        c.rect(0, top - 3, PAGE_W, 3, fill=1, stroke=0)
        c.setFillColor(GREEN_DEEP)
        c.rect(0, top - 4.5, PAGE_W, 1.5, fill=1, stroke=0)

        band_bottom = top - HEADER_H_FIRST
        c.setFillColor(WHITE)
        c.rect(0, band_bottom, PAGE_W, HEADER_H_FIRST - 4.5, fill=1, stroke=0)

        logo = horizontal_logo_path() or icon_logo_path()
        logo_right = MARGIN_X
        if logo:
            try:
                img = ImageReader(str(logo))
                # Logo horizontal ~1024×311 → largeur ~168, hauteur ~51
                logo_w, logo_h = 168.0, 51.0
                if "icon" in logo.name:
                    logo_w, logo_h = 48.0, 48.0
                c.drawImage(
                    img,
                    MARGIN_X,
                    top - 18 - logo_h,
                    width=logo_w,
                    height=logo_h,
                    mask="auto",
                    preserveAspectRatio=True,
                )
                logo_right = MARGIN_X + logo_w + 14
            except Exception:
                pass

        claim_x = max(logo_right, 210)
        c.setFillColor(GOLD)
        c.setFont(FONT_BOLD, 7.5)
        c.drawString(
            claim_x,
            top - 36,
            "PREMIÈRE SOCIÉTÉ FIDUCIAIRE ISLAMIQUE AU SÉNÉGAL",
        )
        c.setStrokeColor(GREEN_DEEP)
        c.setLineWidth(1)
        c.line(claim_x, top - 42, min(claim_x + 268, PAGE_W - MARGIN_X - 56), top - 42)
        c.setFillColor(GREEN_DEEP)
        c.setFont(FONT_REG, 8)
        c.drawString(
            claim_x,
            top - 56,
            "Protéger, gérer et transmettre avec confiance.",
        )

        title = (self.report.title or self.service.get("report_name") or "Rapport")[:70]
        c.setFillColor(GREEN_DEEP)
        c.setFont(FONT_BOLD, 9)
        c.drawString(MARGIN_X, top - 96, title[:80])
        period_label = self.period.get("label") or "—"
        ref = self.case.get("reference") or ""
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 7.5)
        c.drawString(
            MARGIN_X,
            top - 108,
            f"Période : {period_label}   ·   Dossier {ref}",
        )

        qr = qr_path()
        if qr:
            try:
                img = ImageReader(str(qr))
                qr_size = 46
                c.drawImage(
                    img,
                    PAGE_W - MARGIN_X - qr_size,
                    top - 72,
                    width=qr_size,
                    height=qr_size,
                    mask="auto",
                    preserveAspectRatio=True,
                )
                c.setFillColor(MUTED)
                c.setFont(FONT_REG, 5.5)
                c.drawRightString(PAGE_W - MARGIN_X, top - 80, "amanahfiducie.sn")
            except Exception:
                pass

        c.setFillColor(GREEN_DEEP)
        c.rect(0, band_bottom + 3, PAGE_W, 2, fill=1, stroke=0)
        c.setFillColor(GOLD)
        c.rect(0, band_bottom, PAGE_W, 3, fill=1, stroke=0)

    def _draw_letterhead_compact(self) -> None:
        """En-tête réduit pages suivantes — icône officielle + titre."""
        c = self.c
        top = PAGE_H
        c.setFillColor(GOLD)
        c.rect(0, top - 2, PAGE_W, 2, fill=1, stroke=0)
        c.setFillColor(GREEN_DEEP)
        c.rect(0, top - HEADER_H_NEXT, PAGE_W, HEADER_H_NEXT - 2, fill=1, stroke=0)

        text_x = MARGIN_X
        icon = icon_logo_path()
        if icon:
            try:
                img = ImageReader(str(icon))
                c.drawImage(
                    img,
                    MARGIN_X,
                    top - 42,
                    width=28,
                    height=28,
                    mask="auto",
                    preserveAspectRatio=True,
                )
                text_x = MARGIN_X + 36
            except Exception:
                pass

        c.setFillColor(GOLD_SOFT)
        c.setFont(FONT_BOLD, 9)
        c.drawString(text_x, top - 22, "AMANAH FIDUCIE")
        title = (self.report.title or self.service.get("report_name") or "Rapport")[:55]
        c.setFillColor(WHITE)
        c.setFont(FONT_REG, 8)
        c.drawString(text_x, top - 38, title)
        c.setFillColor(GOLD)
        c.rect(0, top - HEADER_H_NEXT - 2, PAGE_W, 2, fill=1, stroke=0)

    def _finish_page(self) -> None:
        self.c.showPage()

    def _new_page(self) -> None:
        self._finish_page()
        self.page += 1
        self._paint_page_chrome(first=False)

    def _ensure(self, need: float) -> None:
        if self.y - need < FOOTER_H + 24:
            self._new_page()

    # ── primitives ──────────────────────────────────────────

    def _section_title(self, title: str, subtitle: str = "") -> None:
        self._ensure(36)
        c = self.c
        c.setFillColor(GREEN_DEEP)
        c.setFont(FONT_BOLD, 11)
        c.drawString(MARGIN_X, self.y, title)
        self.y -= 4
        c.setStrokeColor(GOLD)
        c.setLineWidth(1.5)
        c.line(MARGIN_X, self.y, MARGIN_X + 120, self.y)
        self.y -= 12
        if subtitle:
            c.setFillColor(MUTED)
            c.setFont(FONT_REG, 8)
            c.drawString(MARGIN_X, self.y, subtitle[:110])
            self.y -= 14

    def _card(self, x: float, y: float, w: float, h: float) -> None:
        c = self.c
        c.setFillColor(WHITE)
        c.setStrokeColor(CREAM_DARK)
        c.setLineWidth(0.8)
        c.roundRect(x, y, w, h, 8, fill=1, stroke=1)
        c.setFillColor(GOLD)
        c.roundRect(x, y + 6, 3.5, h - 12, 1.5, fill=1, stroke=0)

    def _money(self, value: Any) -> str:
        if value is None:
            return "—"
        try:
            n = float(value)
            if abs(n) >= 1000:
                s = f"{n:,.0f}".replace(",", " ")
            else:
                s = f"{n:,.2f}".replace(",", " ")
            return f"{s} {self.currency}"
        except (TypeError, ValueError):
            return f"{value} {self.currency}"

    def _text(self, text: str, size: int = 9, color=GREEN, bold: bool = False) -> None:
        self._ensure(14)
        self.c.setFillColor(color)
        self.c.setFont(FONT_BOLD if bold else FONT_REG, size)
        self.c.drawString(MARGIN_X, self.y, text[:110])
        self.y -= size + 5

    # ── cover / KPIs ────────────────────────────────────────

    def _draw_cover_meta(self) -> None:
        c = self.c
        self._ensure(54)
        box_h = 48
        self._card(MARGIN_X, self.y - box_h, CONTENT_W, box_h)
        c.setFillColor(GREEN_DEEP)
        c.setFont(FONT_BOLD, 9)
        c.drawString(
            MARGIN_X + 14,
            self.y - 16,
            f"{self.case.get('reference', '')} — {self.case.get('title', '')}"[:80],
        )
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 8)
        line2 = (
            f"{self.case.get('case_type_label', '')}  ·  "
            f"{self.case.get('status_label', '')}"
        )
        if self.case.get("assigned_to_name"):
            line2 += f"  ·  Chargé : {self.case['assigned_to_name']}"
        c.drawString(MARGIN_X + 14, self.y - 30, line2[:100])
        gen = str(self.snap.get("generated_at") or "")[:19].replace("T", " ")
        c.drawString(MARGIN_X + 14, self.y - 42, f"Généré le {gen}" if gen else "")
        self.y -= box_h + 16

    def _draw_kpis(self) -> None:
        labels = {
            "patrimony_total": "Patrimoine estimé",
            "liquidities": "Liquidités",
            "invested_amount": "Investi",
            "available_amount": "Disponible",
            "annual_yield_percent": "Rendement annuel",
            "period_net_flow": "Flux net période",
            "period_patrimony_net": "Résultat patrimonial",
            "minors_count": "Mineurs protégés",
            "heirs_count": "Héritiers",
            "beneficiaries_count": "Bénéficiaires",
            "zakatable_wealth": "Assiette zakatable",
            "zakat_due": "Zakat due",
            "faraid_share_total": "Somme parts farāʾiḍ",
        }
        keys = [k for k in (self.service.get("kpis") or []) if self.kpis.get(k) is not None]
        if not keys:
            return
        self._section_title("Indicateurs clés", "Synthèse de la période")
        cols = min(4, len(keys))
        gap = 10
        card_w = (CONTENT_W - gap * (cols - 1)) / cols
        card_h = 54
        rows = (len(keys) + cols - 1) // cols
        self._ensure(rows * (card_h + gap) + 8)

        for i, key in enumerate(keys):
            col = i % cols
            row = i // cols
            x = MARGIN_X + col * (card_w + gap)
            y = self.y - (row + 1) * card_h - row * gap
            self._card(x, y, card_w, card_h)
            val = self.kpis.get(key)
            if key == "annual_yield_percent":
                display = f"{val} %"
            elif key in (
                "minors_count",
                "heirs_count",
                "beneficiaries_count",
                "faraid_share_total",
            ):
                display = str(val)
            elif key == "invested_amount":
                display = self._money(val)
                pct = self.kpis.get("invested_percent")
                if pct is not None:
                    display = f"{display} ({pct} %)"
            else:
                display = self._money(val)
            self.c.setFillColor(MUTED)
            self.c.setFont(FONT_BOLD, 6.5)
            self.c.drawString(x + 12, y + card_h - 14, (labels.get(key) or key).upper())
            self.c.setFillColor(GREEN_DEEP)
            self.c.setFont(FONT_BOLD, 9)
            self.c.drawString(x + 12, y + 16, display[:28])

        self.y -= rows * (card_h + gap) + 10

    # ── charts ──────────────────────────────────────────────

    def _draw_donut(
        self,
        cx: float,
        cy: float,
        radius: float,
        slices: list[tuple[str, float, Any]],
        center_label: str,
    ) -> None:
        c = self.c
        total = sum(max(0.0, v) for _, v, _ in slices) or 1.0
        start = 90.0
        for _label, value, color in slices:
            extent = -360.0 * (max(0.0, value) / total)
            if abs(extent) < 0.1:
                continue
            c.setFillColor(color)
            c.wedge(
                cx - radius,
                cy - radius,
                cx + radius,
                cy + radius,
                start,
                extent,
                fill=1,
                stroke=0,
            )
            start += extent
        c.setFillColor(CREAM)
        c.circle(cx, cy, radius * 0.58, fill=1, stroke=0)
        c.setFillColor(GREEN_DEEP)
        c.setFont(FONT_BOLD, 8)
        c.drawCentredString(cx, cy - 3, center_label[:14])

    def _draw_semicircle_gauge(
        self,
        cx: float,
        cy: float,
        radius: float,
        percent: float,
        invested_label: str,
        available_label: str,
    ) -> None:
        """Jauge demi-cercle — miroir SemiCircleGauge de l'aperçu HTML."""
        c = self.c
        pct = max(0.0, min(100.0, float(percent or 0)))
        # Fond (180° → 0°)
        c.setStrokeColor(CREAM_DARK)
        c.setLineWidth(10)
        c.setLineCap(1)
        c.arc(cx - radius, cy - radius, cx + radius, cy + radius, 180, -180)
        # Remplissage investi
        if pct > 0.5:
            c.setStrokeColor(GREEN_MID)
            c.arc(
                cx - radius,
                cy - radius,
                cx + radius,
                cy + radius,
                180,
                -180 * (pct / 100.0),
            )
        c.setFillColor(GREEN_DEEP)
        c.setFont(FONT_BOLD, 14)
        c.drawCentredString(cx, cy + 8, f"{pct:.0f} %")
        c.setFont(FONT_REG, 7)
        c.setFillColor(MUTED)
        c.drawCentredString(cx, cy - 6, "investi")
        c.setFillColor(GREEN_DEEP)
        c.setFont(FONT_BOLD, 7)
        c.drawString(cx - radius, cy - radius - 14, f"Investi  {invested_label}"[:36])
        c.setFillColor(MUTED)
        c.drawRightString(
            cx + radius, cy - radius - 14, f"Dispo  {available_label}"[:36]
        )

    def _draw_hbar_legend(
        self,
        x: float,
        y_top: float,
        rows: list[tuple[str, float, Any]],
        width: float = 240,
    ) -> float:
        """Légende + barres ; retourne hauteur consommée."""
        c = self.c
        y = y_top
        for label, value, color in rows[:8]:
            c.setFillColor(color)
            c.roundRect(x, y - 8, 8, 8, 2, fill=1, stroke=0)
            c.setFillColor(GREEN_DEEP)
            c.setFont(FONT_REG, 7)
            c.drawString(x + 12, y - 7, f"{label[:22]}  {value:.1f} %")
            bar_w = max(4.0, (width - 12) * (value / 100.0))
            c.setFillColor(CREAM_DARK)
            c.roundRect(x + 12, y - 18, width - 12, 6, 3, fill=1, stroke=0)
            c.setFillColor(color)
            c.roundRect(x + 12, y - 18, bar_w, 6, 3, fill=1, stroke=0)
            y -= 28
        return y_top - y

    def _draw_allocation_stacked(
        self,
        x: float,
        y_top: float,
        rows: list[dict],
        width: float,
    ) -> float:
        """Barres empilées investi vs reste — miroir AllocationStackedBar."""
        c = self.c
        y = y_top
        for i, r in enumerate(rows[:8]):
            slug = str(r.get("slug") or "")
            label = asset_class_label(slug)
            try:
                target = float(r.get("target_amount") or 0)
                invested = float(r.get("invested_amount") or 0)
                remaining = float(r.get("remaining_amount") or 0)
            except (TypeError, ValueError):
                target, invested, remaining = 0.0, 0.0, 0.0
            total = target if target > 0 else (invested + remaining) or 1.0
            color = asset_class_color(slug, i)
            c.setFillColor(GREEN_DEEP)
            c.setFont(FONT_BOLD, 7)
            c.drawString(x, y - 8, f"{label}  ·  cible {r.get('target_percent', 0)} %")
            c.setFillColor(CREAM_DARK)
            c.roundRect(x, y - 22, width, 10, 4, fill=1, stroke=0)
            inv_w = max(0.0, width * (invested / total))
            rem_w = max(0.0, width * (remaining / total))
            if inv_w > 0:
                c.setFillColor(color)
                c.roundRect(x, y - 22, inv_w, 10, 4, fill=1, stroke=0)
            if rem_w > 0:
                c.setFillColor(NON_INVESTED)
                c.roundRect(x + inv_w, y - 22, rem_w, 10, 4, fill=1, stroke=0)
            c.setFillColor(MUTED)
            c.setFont(FONT_REG, 6)
            c.drawString(
                x,
                y - 34,
                f"Investi {self._money(invested)}  ·  Reste {self._money(remaining)}",
            )
            y -= 46
        return y_top - y

    def _draw_evolution_line(
        self,
        x: float,
        y_bottom: float,
        width: float,
        height: float,
        points: list[dict],
    ) -> None:
        """Courbe d'évolution du patrimoine investi."""
        c = self.c
        vals = []
        for p in points:
            try:
                vals.append(float(p.get("value") or 0))
            except (TypeError, ValueError):
                vals.append(0.0)
        if len(vals) < 2:
            return
        vmin, vmax = min(vals), max(vals)
        span = (vmax - vmin) or 1.0
        c.setStrokeColor(CREAM_DARK)
        c.setLineWidth(0.6)
        c.rect(x, y_bottom, width, height, fill=0, stroke=1)
        coords = []
        n = len(vals)
        for i, v in enumerate(vals):
            px = x + (width * i / (n - 1))
            py = y_bottom + height * ((v - vmin) / span)
            coords.append((px, py))
        c.setStrokeColor(GREEN_MID)
        c.setLineWidth(1.8)
        p = c.beginPath()
        p.moveTo(coords[0][0], coords[0][1])
        for px, py in coords[1:]:
            p.lineTo(px, py)
        c.drawPath(p, stroke=1, fill=0)
        c.setFillColor(GOLD)
        for px, py in coords:
            c.circle(px, py, 2.2, fill=1, stroke=0)
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 6)
        c.drawString(x + 4, y_bottom + height - 10, self._money(vmax)[:20])
        c.drawString(x + 4, y_bottom + 4, self._money(vmin)[:20])
        if points:
            c.drawString(x + 4, y_bottom - 10, str(points[0].get("date") or "")[:12])
            c.drawRightString(
                x + width - 4,
                y_bottom - 10,
                str(points[-1].get("date") or "")[:12],
            )

    # ── sections ────────────────────────────────────────────

    def _draw_genealogy_section(self) -> None:
        gene = self.snap["genealogy"]
        trees = gene.get("trees") or {"base": True}
        self._section_title(
            "Arbres généalogiques",
            f"Défunt : {gene.get('deceased_name', '')}  ·  "
            f"{gene.get('member_count', 0)} membre(s)",
        )

        specs: list[tuple[str, str, str]] = [
            ("base", "Arbre généalogique de base", "Vue complète de la famille"),
        ]
        if trees.get("with_decisions"):
            specs.append(
                (
                    "decisions",
                    "Arbre avec décisions du comité",
                    gene.get("review_status_label")
                    or "Tampons : héritiers retenus ou exclus",
                )
            )
        if trees.get("final_share"):
            specs.append(
                (
                    "final",
                    "Arbre final du partage",
                    "Parts farāʾiḍ validées sous chaque héritier",
                )
            )

        for mode, title, sub in specs:
            nodes, edges, tree_h = layout_genealogy_tree(
                deceased_name=gene.get("deceased_name") or "Le défunt",
                family_members=gene.get("family_members") or [],
                decisions=gene.get("decisions") or [],
                mode=mode,
                page_width=CONTENT_W - 20,
            )
            band = tree_h + 20 + 28
            self._ensure(band + 10)
            self.c.setFillColor(GREEN_DEEP)
            self.c.setFont(FONT_BOLD, 9)
            self.c.drawString(MARGIN_X, self.y, title)
            self.y -= 12
            self.c.setFillColor(MUTED)
            self.c.setFont(FONT_REG, 7.5)
            self.c.drawString(MARGIN_X, self.y, sub[:100])
            self.y -= 10
            origin_y = self.y - tree_h
            used = draw_genealogy_tree(
                self.c,
                origin_x=MARGIN_X + 10,
                origin_y=origin_y,
                nodes=nodes,
                edges=edges,
                height=tree_h,
                width=CONTENT_W - 20,
            )
            self.y = origin_y - 18
            # used includes pad; keep spacing
            _ = used

    def _draw_faraid(self) -> None:
        faraid = self.snap["faraid"]
        self._section_title(
            "Farāʾiḍ",
            f"{faraid.get('heirs_count', 0)} héritier(s)  ·  "
            f"somme des parts {faraid.get('share_total', 0)}",
        )
        review = faraid.get("review") or {}
        if review:
            self._text(
                f"Revue comité : {review.get('status_label') or review.get('status', '')}"
                + (
                    f"  ·  patrimoine net {self._money(review.get('net_estate'))}"
                    if review.get("net_estate")
                    else ""
                ),
                size=8,
                color=MUTED,
            )

        heirs = faraid.get("heirs") or []
        if not heirs:
            return
        row_h = 18
        self._ensure(24 + min(len(heirs), 12) * row_h)
        # table header
        self.c.setFillColor(GREEN_DEEP)
        self.c.roundRect(MARGIN_X, self.y - row_h, CONTENT_W, row_h, 4, fill=1, stroke=0)
        self.c.setFillColor(GOLD_SOFT)
        self.c.setFont(FONT_BOLD, 7)
        self.c.drawString(MARGIN_X + 8, self.y - 12, "HÉRITIER")
        self.c.drawString(MARGIN_X + 220, self.y - 12, "LIEN")
        self.c.drawRightString(MARGIN_X + CONTENT_W - 8, self.y - 12, "PART")
        self.y -= row_h

        for i, h in enumerate(heirs[:15]):
            self._ensure(row_h + 4)
            bg = WHITE if i % 2 == 0 else AMBER_BG
            self.c.setFillColor(bg)
            self.c.rect(MARGIN_X, self.y - row_h, CONTENT_W, row_h, fill=1, stroke=0)
            self.c.setFillColor(GREEN_DEEP)
            self.c.setFont(FONT_REG, 8)
            self.c.drawString(MARGIN_X + 8, self.y - 12, str(h.get("full_name", ""))[:32])
            self.c.setFillColor(MUTED)
            self.c.drawString(
                MARGIN_X + 220,
                self.y - 12,
                str(h.get("relationship_label", ""))[:28],
            )
            self.c.setFillColor(GREEN_DEEP)
            self.c.setFont(FONT_BOLD, 8)
            self.c.drawRightString(
                MARGIN_X + CONTENT_W - 8,
                self.y - 12,
                f"{float(h.get('share_percent') or 0):.2f} %",
            )
            self.y -= row_h
        self.y -= 10

    def _draw_waqf(self) -> None:
        waqf = self.snap["waqf"]
        self._section_title("Waqf", waqf.get("waqf_type_label") or "")
        self._ensure(60)
        self._card(MARGIN_X, self.y - 56, CONTENT_W, 56)
        self.c.setFillColor(GREEN_DEEP)
        self.c.setFont(FONT_BOLD, 8)
        self.c.drawString(MARGIN_X + 14, self.y - 18, "Objet")
        self.c.setFont(FONT_REG, 8)
        self.c.setFillColor(MUTED)
        self.c.drawString(MARGIN_X + 14, self.y - 32, str(waqf.get("waqf_object") or "—")[:90])
        self.c.setFillColor(GREEN_DEEP)
        self.c.setFont(FONT_BOLD, 8)
        self.c.drawString(MARGIN_X + 14, self.y - 46, "Répartition")
        self.c.setFont(FONT_REG, 7)
        self.c.setFillColor(MUTED)
        self.c.drawString(
            MARGIN_X + 80,
            self.y - 46,
            str(waqf.get("waqf_distribution_rules") or "—")[:70],
        )
        self.y -= 70

    def _draw_zakat(self) -> None:
        zakat = self.snap["zakat"]
        latest = zakat.get("latest") or {}
        self._section_title("Zakat", "Assiettes et montants dus")
        if latest:
            self._ensure(60)
            cards = [
                ("Année", str(latest.get("year", "—"))),
                ("Assiette", self._money(latest.get("zakatable_wealth"))),
                ("Zakat due", self._money(latest.get("zakat_due"))),
            ]
            cw = (CONTENT_W - 20) / 3
            for i, (lab, val) in enumerate(cards):
                x = MARGIN_X + i * (cw + 10)
                self._card(x, self.y - 50, cw, 50)
                self.c.setFillColor(MUTED)
                self.c.setFont(FONT_BOLD, 6.5)
                self.c.drawString(x + 12, self.y - 16, lab.upper())
                self.c.setFillColor(GREEN_DEEP)
                self.c.setFont(FONT_BOLD, 10)
                self.c.drawString(x + 12, self.y - 36, val[:22])
            self.y -= 66

    def _draw_finance(self) -> None:
        finance = self.snap["finance"]
        flows = finance.get("period_flows") or {}
        self._section_title("Finance — période", "Flux fiduciaires")
        self._ensure(70)
        items = [
            ("Recettes", flows.get("income_total")),
            ("Dépenses", flows.get("expense_total")),
            ("Net", flows.get("net_flow")),
            ("Solde comptes", finance.get("total_balance")),
        ]
        cw = (CONTENT_W - 30) / 4
        for i, (lab, val) in enumerate(items):
            x = MARGIN_X + i * (cw + 10)
            self._card(x, self.y - 50, cw, 50)
            self.c.setFillColor(MUTED)
            self.c.setFont(FONT_BOLD, 6)
            self.c.drawString(x + 10, self.y - 16, lab.upper())
            self.c.setFillColor(GREEN_DEEP)
            self.c.setFont(FONT_BOLD, 8)
            self.c.drawString(x + 10, self.y - 34, self._money(val)[:18])
        self.y -= 64
        self._text(
            f"{finance.get('account_count', 0)} compte(s)  ·  "
            f"{flows.get('movement_count', 0)} mouvement(s) sur la période",
            size=7,
            color=MUTED,
        )

        movements = flows.get("movements") or []
        if movements:
            self._section_title(
                "Mouvements de la période",
                f"{flows.get('movement_count', len(movements))} opération(s)",
            )
            # En-tête tableau
            row_h = 16
            self._ensure(24 + min(len(movements), 20) * row_h)
            self.c.setFillColor(GREEN_DEEP)
            self.c.roundRect(
                MARGIN_X, self.y - row_h, CONTENT_W, row_h, 3, fill=1, stroke=0
            )
            self.c.setFillColor(GOLD_SOFT)
            self.c.setFont(FONT_BOLD, 7)
            self.c.drawString(MARGIN_X + 6, self.y - 11, "DATE")
            self.c.drawString(MARGIN_X + 70, self.y - 11, "LIBELLÉ")
            self.c.drawString(MARGIN_X + 340, self.y - 11, "TYPE")
            self.c.drawRightString(MARGIN_X + CONTENT_W - 6, self.y - 11, "MONTANT")
            self.y -= row_h
            for i, mv in enumerate(movements[:25]):
                self._ensure(row_h + 4)
                bg = WHITE if i % 2 == 0 else AMBER_BG
                self.c.setFillColor(bg)
                self.c.rect(
                    MARGIN_X, self.y - row_h, CONTENT_W, row_h, fill=1, stroke=0
                )
                self.c.setFillColor(MUTED)
                self.c.setFont(FONT_REG, 7)
                self.c.drawString(
                    MARGIN_X + 6, self.y - 11, str(mv.get("date") or "—")[:12]
                )
                self.c.setFillColor(GREEN_DEEP)
                label = str(mv.get("label") or mv.get("category") or "—")[:48]
                self.c.drawString(MARGIN_X + 70, self.y - 11, label)
                self.c.setFillColor(MUTED)
                self.c.drawString(
                    MARGIN_X + 340, self.y - 11, str(mv.get("type") or "—")[:12]
                )
                self.c.setFillColor(GREEN_DEEP)
                self.c.setFont(FONT_BOLD, 7)
                self.c.drawRightString(
                    MARGIN_X + CONTENT_W - 6,
                    self.y - 11,
                    self._money(mv.get("amount"))[:18],
                )
                self.y -= row_h
            self.y -= 8

    def _draw_patrimony(self) -> None:
        patrimony = self.snap["patrimony"]
        self._section_title(
            "Patrimoine",
            "Répartition et résultat sur la période",
        )
        pe = patrimony.get("period_events") or {}
        # Cartes période — comme l'aperçu HTML
        period_cards = [
            ("Gains période", pe.get("period_gains")),
            ("Dépenses période", pe.get("period_expenses")),
            ("Net patrimonial", pe.get("period_net")),
        ]
        if any(v is not None for _, v in period_cards):
            self._ensure(60)
            cw = (CONTENT_W - 20) / 3
            for i, (lab, val) in enumerate(period_cards):
                x = MARGIN_X + i * (cw + 10)
                self._card(x, self.y - 50, cw, 50)
                self.c.setFillColor(MUTED)
                self.c.setFont(FONT_BOLD, 6)
                self.c.drawString(x + 10, self.y - 16, lab.upper())
                self.c.setFillColor(GREEN_DEEP)
                self.c.setFont(FONT_BOLD, 9)
                self.c.drawString(x + 10, self.y - 34, self._money(val)[:18])
            self.y -= 64

        slices_raw = patrimony.get("by_type_slices") or []
        chart_rows: list[tuple[str, float, Any]] = []
        for i, s in enumerate(slices_raw[:8]):
            try:
                pct = float(s.get("percent") or 0)
            except (TypeError, ValueError):
                pct = 0.0
            # Prefer amount weight for donut fidelity with HTML
            try:
                amount = float(s.get("amount") or 0)
            except (TypeError, ValueError):
                amount = pct
            weight = amount if amount > 0 else pct
            chart_rows.append(
                (
                    str(s.get("label") or "—"),
                    weight,
                    CHART_PALETTE[i % len(CHART_PALETTE)],
                )
            )

        if chart_rows:
            self._ensure(150)
            band_top = self.y
            self._card(MARGIN_X, self.y - 140, CONTENT_W, 140)
            total_w = sum(w for _, w, _ in chart_rows) or 1.0
            legend_pct = [
                (lab, 100.0 * w / total_w, col) for lab, w, col in chart_rows
            ]
            self._draw_donut(
                MARGIN_X + 90,
                self.y - 70,
                48,
                chart_rows,
                str(patrimony.get("asset_count") or "Actifs"),
            )
            self._draw_hbar_legend(
                MARGIN_X + 170,
                self.y - 24,
                legend_pct,
                width=CONTENT_W - 200,
            )
            self.y = band_top - 152
        else:
            self._text("Aucun actif valorisé.", size=8, color=MUTED)

        assets = patrimony.get("assets") or []
        case_type = (self.case.get("case_type") or "").upper()
        if assets and (
            case_type in ("TUTELLE_CANTONNEMENT", "MANDAT_FIDUCIAIRE")
            or self.sections.get("minors_focus")
        ):
            title = (
                "Biens cantonnés"
                if case_type == "TUTELLE_CANTONNEMENT"
                else "Inventaire des biens"
            )
            self._section_title(title, f"{len(assets)} bien(s) enregistré(s)")
            for a in assets[:20]:
                self._text(
                    f"• {a.get('label', '')} "
                    f"({a.get('asset_type', '')}) — "
                    f"{self._money(a.get('latest_value'))}",
                    size=8,
                    color=GREEN,
                )

    def _draw_investments(self) -> None:
        """Miroir fidèle de l'aperçu : jauge, donuts cible/investi, allocation, évolution."""
        inv = self.snap["investments"]
        summary = inv.get("summary") or {}
        charts = inv.get("charts") or {}
        policy = inv.get("policy") or {}
        cat = policy.get("patrimony_category") or {}
        iva = charts.get("invested_vs_available") or {}

        subtitle = (
            f"Type {cat.get('code')}"
            if cat.get("code")
            else f"Valeur {self._money(summary.get('total_value'))}"
        )
        self._section_title("Investi / non investi", subtitle)

        try:
            invested_pct = float(self.kpis.get("invested_percent") or 0)
        except (TypeError, ValueError):
            invested_pct = 0.0
        invested_amt = self.kpis.get("invested_amount") or iva.get("invested_amount") or "0"
        available_amt = self.kpis.get("available_amount") or iva.get("available_amount") or "0"

        # Jauge demi-cercle
        self._ensure(120)
        top = self.y
        self._card(MARGIN_X, self.y - 110, CONTENT_W, 110)
        self._draw_semicircle_gauge(
            MARGIN_X + CONTENT_W / 2,
            self.y - 48,
            52,
            invested_pct,
            self._money(invested_amt),
            self._money(available_amt),
        )
        self.y = top - 122

        # Donut répartition cible
        targets = cat.get("allocation_targets") or {}
        planned = 0.0
        try:
            planned = float(policy.get("planned_investment_amount") or 0)
        except (TypeError, ValueError):
            planned = 0.0
        target_slices: list[tuple[str, float, Any]] = []
        for i, (slug, pct) in enumerate(targets.items()):
            try:
                p = float(pct or 0)
            except (TypeError, ValueError):
                p = 0.0
            if p <= 0:
                continue
            amount = (planned * p / 100.0) if planned > 0 else p
            target_slices.append(
                (asset_class_label(str(slug)), amount, asset_class_color(str(slug), i))
            )
        if target_slices:
            self._ensure(140)
            top = self.y
            self._card(MARGIN_X, self.y - 130, CONTENT_W, 130)
            self.c.setFillColor(MUTED)
            self.c.setFont(FONT_BOLD, 7)
            self.c.drawString(MARGIN_X + 14, self.y - 16, "RÉPARTITION CIBLE")
            total_t = sum(v for _, v, _ in target_slices) or 1.0
            legend = [
                (lab, 100.0 * v / total_t, col) for lab, v, col in target_slices
            ]
            self._draw_donut(
                MARGIN_X + 90,
                self.y - 72,
                42,
                target_slices,
                str(cat.get("code") or "Type"),
            )
            self._draw_hbar_legend(
                MARGIN_X + 170, self.y - 28, legend, width=CONTENT_W - 200
            )
            self.y = top - 142

        # Donut positions investies (+ non investi)
        rows = inv.get("allocation_rows") or []
        invested_slices: list[tuple[str, float, Any]] = []
        for i, r in enumerate(rows):
            try:
                amt = float(r.get("invested_amount") or 0)
            except (TypeError, ValueError):
                amt = 0.0
            if amt <= 0:
                continue
            slug = str(r.get("slug") or "")
            invested_slices.append(
                (asset_class_label(slug), amt, asset_class_color(slug, i))
            )
        try:
            available_f = float(available_amt)
        except (TypeError, ValueError):
            available_f = 0.0
        if available_f > 0:
            invested_slices.append(
                ("Non investi", available_f, NON_INVESTED)
            )
        if invested_slices:
            self._ensure(140)
            top = self.y
            self._card(MARGIN_X, self.y - 130, CONTENT_W, 130)
            self.c.setFillColor(MUTED)
            self.c.setFont(FONT_BOLD, 7)
            self.c.drawString(MARGIN_X + 14, self.y - 16, "POSITIONS INVESTIES")
            total_i = sum(v for _, v, _ in invested_slices) or 1.0
            legend = [
                (lab, 100.0 * v / total_i, col) for lab, v, col in invested_slices
            ]
            self._draw_donut(
                MARGIN_X + 90,
                self.y - 72,
                42,
                invested_slices,
                f"{invested_pct:.0f} %",
            )
            self._draw_hbar_legend(
                MARGIN_X + 170, self.y - 28, legend, width=CONTENT_W - 200
            )
            self.y = top - 142

        # Allocation empilée par classe
        if rows:
            self._section_title(
                "Allocation par classe",
                "Investi vs reste à investir",
            )
            needed = min(len(rows), 8) * 46 + 20
            self._ensure(needed)
            top = self.y
            used = self._draw_allocation_stacked(
                MARGIN_X + 8, self.y, rows, CONTENT_W - 16
            )
            self.y = top - used - 12

        # Évolution
        evo = charts.get("patrimony_evolution") or []
        if len(evo) >= 2:
            self._section_title(
                "Évolution du patrimoine investi",
                "Historique des valorisations",
            )
            self._ensure(130)
            top = self.y
            self._card(MARGIN_X, self.y - 120, CONTENT_W, 120)
            self._draw_evolution_line(
                MARGIN_X + 16,
                self.y - 108,
                CONTENT_W - 32,
                78,
                evo[:40],
            )
            self.y = top - 132

        if summary.get("annual_yield_percent") is not None:
            self._text(
                f"Rendement annuel moyen : {summary['annual_yield_percent']} %",
                size=8,
                color=MUTED,
            )

        positions = inv.get("positions") or []
        if positions:
            self._text("Positions", size=8, bold=True, color=GREEN_DEEP)
            for pos in positions[:10]:
                self._text(
                    f"• {pos.get('label', '')} ({pos.get('asset_class_label', '')}) — "
                    f"{self._money(pos.get('current_value'))}",
                    size=7,
                    color=GREEN,
                )

    def _draw_people(self) -> None:
        people = self.snap.get("people") or {}
        title = people.get("label") or self.service.get("people_label") or "Personnes"
        donor_label = (
            people.get("donor_label")
            or self.service.get("donor_label")
            or "Donateurs"
        )
        self._section_title(title, donor_label)
        line = (
            f"{people.get('donors_count', 0)} {donor_label.lower()}  ·  "
            f"{people.get('beneficiaries_count', 0)} {title.lower()}"
        )
        if self.sections.get("minors_focus"):
            line += f"  ·  {people.get('minors_count', 0)} mineur(s)"
        if self.sections.get("mandates"):
            line += f"  ·  {people.get('mandates_count', 0)} mandat(s)"
        self._text(line, size=8, color=MUTED)

        beneficiaries = people.get("beneficiaries") or []
        if self.sections.get("minors_focus"):
            minors = [b for b in beneficiaries if b.get("is_minor")]
            others = [b for b in beneficiaries if not b.get("is_minor")]
            if minors:
                self._text("Mineurs protégés", size=8, bold=True, color=GREEN_DEEP)
                for b in minors[:12]:
                    self._text(f"• {b.get('name', '')} (mineur)", size=8, color=GREEN)
            if others:
                self._text("Autres protégés / bénéficiaires", size=8, bold=True, color=GREEN_DEEP)
                for b in others[:12]:
                    self._text(f"• {b.get('name', '')}", size=8, color=GREEN)
        else:
            for b in beneficiaries[:12]:
                minor = " (mineur)" if b.get("is_minor") else ""
                self._text(f"• {b.get('name', '')}{minor}", size=8, color=GREEN)

    def _draw_mandates(self) -> None:
        people = self.snap.get("people") or {}
        self._section_title(self.service.get("mandate_label") or "Mandats")
        for m in (people.get("mandates") or [])[:8]:
            self._text(
                f"• {m.get('title', '')}  [{m.get('status', '')}]",
                size=8,
                color=GREEN,
            )

    def _draw_closing(self) -> None:
        status = getattr(self.report, "status", "") or ""
        notes = {
            "DRAFT": "Brouillon — publication après validation humaine.",
            "PENDING_APPROVAL": "En revue interne.",
            "APPROVED": "Approuvé — visible sur les portails autorisés.",
            "ARCHIVED": "Document archivé.",
            "REJECTED": "Document rejeté.",
        }
        note = notes.get(str(status), "Document généré par SOFIGEPAM Connect.")
        self._ensure(40)
        self.y -= 8
        self.c.setFillColor(GREEN_MID)
        self.c.setFont(FONT_REG, 8)
        self.c.drawString(MARGIN_X, self.y, note)
        self.y -= 14
        self.c.setFillColor(MUTED)
        self.c.setFont(FONT_REG, 7)
        self.c.drawString(
            MARGIN_X,
            self.y,
            "Présentation A4 premium — alignée sur l'aperçu interactif du dossier.",
        )


def render_premium_report_pdf(report, snapshot: dict[str, Any] | None = None) -> bytes:
    snap = snapshot if isinstance(snapshot, dict) else {}
    if not snap.get("version"):
        snap = report.metadata_json if isinstance(report.metadata_json, dict) else {}
    return PremiumReportPdf(report, snap).build()


def refresh_report_pdf_file(report) -> bool:
    """Régénère le fichier PDF premium depuis le snapshot existant."""
    from django.core.files.base import ContentFile

    snap = report.metadata_json if isinstance(report.metadata_json, dict) else {}
    if not snap.get("version"):
        return False

    pdf_bytes = render_premium_report_pdf(report, snap)
    from reports.services import report_pdf_filename

    filename = report_pdf_filename(report)
    report.file.save(filename, ContentFile(pdf_bytes), save=True)
    snap = dict(snap)
    snap["pdf_engine"] = PDF_ENGINE
    report.metadata_json = snap
    report.save(update_fields=["file", "metadata_json", "updated_at"])
    return True
