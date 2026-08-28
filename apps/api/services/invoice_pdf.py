"""Facture PDF d'honoraires (ReportLab, identité SOFIGEPAM — présentation pro)."""

from __future__ import annotations

import io
from decimal import Decimal
from typing import Sequence

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas

from reports.pdf_brand import (
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
    WHITE,
    ensure_fonts,
    horizontal_logo_path,
)

PAGE_W, PAGE_H = A4
MARGIN_X = 44.0
CONTENT_W = PAGE_W - 2 * MARGIN_X
FOOTER_Y = 52.0

ISSUER_NAME = "SOFIGEPAM — Amanah Fiducie"
ISSUER_TAGLINE = "Gestion fiduciaire & services islamiques"
ISSUER_LINES = (
    "Dakar, Sénégal",
    "www.amanahfiducie.com",
)


def _fmt_amount(amount: Decimal | str, currency: str = "XOF") -> str:
    value = Decimal(str(amount))
    formatted = f"{value:,.0f}".replace(",", " ")
    return f"{formatted} {currency}"


def _fmt_date(value) -> str:
    if value is None:
        return "—"
    if hasattr(value, "strftime"):
        return value.strftime("%d/%m/%Y")
    text = str(value)
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        y, m, d = text[:10].split("-")
        return f"{d}/{m}/{y}"
    return text


def _truncate(text: str, font: str, size: float, max_width: float) -> str:
    text = (text or "").strip()
    if not text:
        return "—"
    if stringWidth(text, font, size) <= max_width:
        return text
    ellipsis = "…"
    while text and stringWidth(text + ellipsis, font, size) > max_width:
        text = text[:-1]
    return text + ellipsis


def _wrap(text: str, font: str, size: float, max_width: float, max_lines: int = 2) -> list[str]:
    words = (text or "").split()
    if not words:
        return ["—"]
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if stringWidth(candidate, font, size) <= max_width:
            current = candidate
            continue
        if current:
            lines.append(current)
            if len(lines) >= max_lines:
                break
        current = word
    if current and len(lines) < max_lines:
        lines.append(current)
    if len(lines) == max_lines and (
        stringWidth(" ".join(words), font, size)
        > stringWidth(" ".join(lines), font, size) + 1
    ):
        lines[-1] = _truncate(lines[-1], font, size, max_width)
    return lines or ["—"]


def _draw_footer(c: canvas.Canvas, page_num: int, *, page_count: int | None = None) -> None:
    """Pied de page minimal — numéro de page uniquement si multi-pages."""
    if page_count is not None and page_count <= 1 and page_num <= 1:
        return
    c.setFillColor(MUTED)
    c.setFont(FONT_REG, 8)
    label = f"Page {page_num}"
    if page_count and page_count > 1:
        label = f"Page {page_num} / {page_count}"
    c.drawRightString(PAGE_W - MARGIN_X, FOOTER_Y, label)


def _draw_header(
    c: canvas.Canvas,
    *,
    invoice_no: str,
    title: str = "FACTURE D'HONORAIRES",
) -> float:
    """En-tête : logo, titre et numéro de facture."""
    band_h = 86.0
    c.setFillColor(GREEN_DEEP)
    c.rect(0, PAGE_H - band_h, PAGE_W, band_h, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(0, PAGE_H - band_h - 3, PAGE_W, 3, fill=1, stroke=0)

    logo = horizontal_logo_path()
    if logo:
        try:
            c.drawImage(
                ImageReader(str(logo)),
                MARGIN_X,
                PAGE_H - 68,
                width=148,
                height=40,
                mask="auto",
                preserveAspectRatio=True,
                anchor="sw",
            )
        except Exception:  # noqa: BLE001
            c.setFillColor(WHITE)
            c.setFont(FONT_BOLD, 12)
            c.drawString(MARGIN_X, PAGE_H - 48, "AMANAH FIDUCIE")
    else:
        c.setFillColor(WHITE)
        c.setFont(FONT_BOLD, 12)
        c.drawString(MARGIN_X, PAGE_H - 48, "AMANAH FIDUCIE")

    c.setFillColor(GOLD_SOFT)
    c.setFont(FONT_REG, 8)
    c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 34, title)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 13)
    c.drawRightString(PAGE_W - MARGIN_X, PAGE_H - 52, invoice_no)
    return PAGE_H - band_h - 22


def _draw_parties(
    c: canvas.Canvas,
    y: float,
    *,
    client_lines: Sequence[str],
    invoice_date: str = "",
    period_label: str = "",
) -> float:
    """Bloc émetteur / Facturé à (date & période dans la carte Facturé à)."""
    box_h = 118.0 if (invoice_date or period_label) else 104.0
    col_w = (CONTENT_W - 12) / 2
    left_x = MARGIN_X
    right_x = MARGIN_X + col_w + 12

    # Issuer
    c.setFillColor(CREAM)
    c.roundRect(left_x, y - box_h, col_w, box_h, 7, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(left_x, y - 3, 28, 3, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont(FONT_BOLD, 7.5)
    c.drawString(left_x + 12, y - 18, "ÉMETTEUR")
    c.setFillColor(GREEN_DEEP)
    c.setFont(FONT_BOLD, 10)
    c.drawString(left_x + 12, y - 34, ISSUER_NAME)
    c.setFillColor(MUTED)
    c.setFont(FONT_REG, 8.5)
    ty = y - 50
    c.drawString(left_x + 12, ty, ISSUER_TAGLINE)
    for line in ISSUER_LINES:
        ty -= 13
        c.drawString(left_x + 12, ty, line)

    # Client / dossier — Facturé à
    c.setFillColor(CREAM)
    c.roundRect(right_x, y - box_h, col_w, box_h, 7, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(right_x, y - 3, 28, 3, fill=1, stroke=0)
    c.setFillColor(MUTED)
    c.setFont(FONT_BOLD, 7.5)
    c.drawString(right_x + 12, y - 18, "FACTURÉ À")
    c.setFillColor(GREEN_DEEP)
    c.setFont(FONT_BOLD, 10)
    first = client_lines[0] if client_lines else "—"
    for i, wrapped in enumerate(
        _wrap(first, FONT_BOLD, 10, col_w - 24, max_lines=2)
    ):
        c.drawString(right_x + 12, y - 34 - i * 12, wrapped)

    # Date & période juste sous la référence
    ty = y - 34 - 12 * min(2, len(_wrap(first, FONT_BOLD, 10, col_w - 24, 2))) - 2
    if invoice_date or period_label:
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 8)
        meta_bits = []
        if invoice_date:
            meta_bits.append(f"Date : {invoice_date}")
        if period_label:
            meta_bits.append(f"Période : {period_label}")
        meta_text = "  ·  ".join(meta_bits)
        for wrapped in _wrap(meta_text, FONT_REG, 8, col_w - 24, max_lines=2):
            ty -= 12
            c.drawString(right_x + 12, ty, wrapped)
        ty -= 4

    c.setFillColor(MUTED)
    c.setFont(FONT_REG, 8.5)
    for line in client_lines[1:4]:
        for wrapped in _wrap(line, FONT_REG, 8.5, col_w - 24, max_lines=1):
            ty -= 12
            if ty < y - box_h + 10:
                break
            c.drawString(right_x + 12, ty, wrapped)

    return y - box_h - 22


def _draw_table_header(c: canvas.Canvas, y: float) -> float:
    c.setFillColor(GREEN_DEEP)
    c.roundRect(MARGIN_X, y - 20, CONTENT_W, 24, 4, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 8)
    c.drawString(MARGIN_X + 10, y - 13, "#")
    c.drawString(MARGIN_X + 34, y - 13, "Désignation")
    c.drawRightString(PAGE_W - MARGIN_X - 12, y - 13, "Montant")
    return y - 28


def _ensure_space(
    c: canvas.Canvas,
    y: float,
    needed: float,
    *,
    page_num: list[int],
    invoice_no: str,
) -> float:
    if y - needed >= FOOTER_Y + 28:
        return y
    _draw_footer(c, page_num[0])
    c.showPage()
    page_num[0] += 1
    y = _draw_header(c, invoice_no=invoice_no)
    c.setFillColor(GREEN)
    c.setFont(FONT_BOLD, 9)
    c.drawString(MARGIN_X, y, "Suite — prestations")
    y -= 18
    return _draw_table_header(c, y)


def _draw_lines_and_total(
    c: canvas.Canvas,
    y: float,
    *,
    lines: Sequence[dict],
    total: Decimal | str,
    currency: str,
    invoice_no: str,
    notes: str = "",
    page_num: list[int] | None = None,
) -> None:
    if page_num is None:
        page_num = [1]

    c.setFillColor(GREEN)
    c.setFont(FONT_BOLD, 10)
    c.drawString(MARGIN_X, y, "Prestations")
    c.setStrokeColor(GOLD)
    c.setLineWidth(1.1)
    c.line(MARGIN_X, y - 6, MARGIN_X + 88, y - 6)
    y -= 22
    y = _draw_table_header(c, y)

    if not lines:
        y = _ensure_space(c, y, 24, page_num=page_num, invoice_no=invoice_no)
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 9)
        c.drawString(MARGIN_X + 10, y, "Aucune ligne facturée.")
        y -= 28
    else:
        for idx, line in enumerate(lines, start=1):
            label_lines = _wrap(
                line["label"], FONT_REG, 9, CONTENT_W * 0.68, max_lines=2
            )
            row_h = 16 + len(label_lines) * 11
            y = _ensure_space(
                c,
                y,
                row_h + 4,
                page_num=page_num,
                invoice_no=invoice_no,
            )

            if idx % 2 == 0:
                c.setFillColor(CREAM)
                c.rect(MARGIN_X, y - row_h + 8, CONTENT_W, row_h, fill=1, stroke=0)

            c.setFillColor(MUTED)
            c.setFont(FONT_REG, 8)
            c.drawString(MARGIN_X + 10, y, f"{idx:02d}")

            c.setFillColor(GREEN_DEEP)
            c.setFont(FONT_REG, 9)
            ly = y
            for text in label_lines:
                c.drawString(MARGIN_X + 34, ly, text)
                ly -= 11

            c.setFillColor(GREEN_DEEP)
            c.setFont(FONT_BOLD, 9)
            c.drawRightString(
                PAGE_W - MARGIN_X - 12,
                y,
                _fmt_amount(line["amount"], currency),
            )
            y -= row_h

    # Total block
    y = _ensure_space(c, y, 78, page_num=page_num, invoice_no=invoice_no)
    y -= 8
    total_w = 220.0
    total_x = PAGE_W - MARGIN_X - total_w
    c.setStrokeColor(CREAM_DARK)
    c.setLineWidth(0.7)
    c.line(MARGIN_X, y + 14, PAGE_W - MARGIN_X, y + 14)

    c.setFillColor(GREEN_DEEP)
    c.roundRect(total_x, y - 44, total_w, 52, 8, fill=1, stroke=0)
    c.setFillColor(GOLD)
    c.rect(total_x, y - 44, 4, 52, fill=1, stroke=0)
    c.setFillColor(GOLD_SOFT)
    c.setFont(FONT_BOLD, 8)
    c.drawString(total_x + 16, y - 8, "TOTAL À RÉGLER")
    c.setFillColor(WHITE)
    c.setFont(FONT_BOLD, 14)
    c.drawRightString(
        PAGE_W - MARGIN_X - 14,
        y - 30,
        _fmt_amount(total, currency),
    )
    y -= 62

    if notes and notes.strip():
        y = _ensure_space(c, y, 56, page_num=page_num, invoice_no=invoice_no)
        c.setFillColor(CREAM)
        c.roundRect(MARGIN_X, y - 48, CONTENT_W, 52, 7, fill=1, stroke=0)
        c.setFillColor(GREEN_MID)
        c.setFont(FONT_BOLD, 8)
        c.drawString(MARGIN_X + 12, y - 14, "NOTES")
        c.setFillColor(MUTED)
        c.setFont(FONT_REG, 8)
        ny = y - 28
        for line in _wrap(notes.strip(), FONT_REG, 8, CONTENT_W - 24, max_lines=2):
            c.drawString(MARGIN_X + 12, ny, line)
            ny -= 11

    _draw_footer(c, page_num[0], page_count=page_num[0])


def render_billing_charge_invoice_pdf(charge) -> bytes:
    ensure_fonts()
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    case = charge.case
    invoice_no = f"N° {case.reference}-{charge.pk}"
    page_num = [1]

    meta_date = _fmt_date(charge.movement_date)
    meta_period = charge.period_label or meta_date
    y = _draw_header(c, invoice_no=invoice_no)
    client_lines = [
        f"{case.reference}",
        case.title,
        case.get_case_type_display(),
    ]
    y = _draw_parties(
        c,
        y,
        client_lines=client_lines,
        invoice_date=meta_date,
        period_label=meta_period,
    )

    lines = [{"label": charge.label, "amount": charge.amount}]

    _draw_lines_and_total(
        c,
        y,
        lines=lines,
        total=charge.amount,
        currency=charge.currency or "XOF",
        invoice_no=invoice_no,
        notes=charge.notes or "",
        page_num=page_num,
    )
    c.showPage()
    c.save()
    return buf.getvalue()


def billing_charge_invoice_filename(charge) -> str:
    ref = charge.case.reference.replace("/", "-")
    return f"facture-honoraires-{ref}-{charge.pk}.pdf"


def render_period_invoice_pdf(invoice) -> bytes:
    ensure_fonts()
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    case = invoice.case
    invoice_no = f"N° {case.reference}-{invoice.pk}"
    page_num = [1]

    y = _draw_header(c, invoice_no=invoice_no)
    client_lines = [
        case.reference,
        case.title,
        case.get_case_type_display(),
    ]
    if invoice.label:
        client_lines.append(invoice.label)

    y = _draw_parties(
        c,
        y,
        client_lines=client_lines,
        invoice_date=_fmt_date(invoice.movement_date),
        period_label=invoice.period_label or "—",
    )

    currency = invoice.currency or "XOF"
    lines = [
        {"label": line.label, "amount": line.amount}
        for line in invoice.lines.filter(is_selected=True).order_by("sort_order", "id")
    ]

    _draw_lines_and_total(
        c,
        y,
        lines=lines,
        total=invoice.amount,
        currency=currency,
        invoice_no=invoice_no,
        notes=invoice.notes or "",
        page_num=page_num,
    )
    c.showPage()
    c.save()
    return buf.getvalue()


def period_invoice_filename(invoice) -> str:
    ref = invoice.case.reference.replace("/", "-")
    return f"facture-{ref}-{invoice.period_label}-{invoice.pk}.pdf"
