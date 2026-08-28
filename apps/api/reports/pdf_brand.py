"""Identité visuelle PDF (alignée sur le front SOFIGEPAM Connect)."""

from __future__ import annotations

from pathlib import Path

from reportlab.lib.colors import HexColor, white
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

PDF_ENGINE = "premium_v4"

GREEN_DEEP = HexColor("#0f2418")
GREEN = HexColor("#1a3d2a")
GREEN_MID = HexColor("#245a3c")
GREEN_LIGHT = HexColor("#3d7a55")
GOLD = HexColor("#c9a227")
GOLD_SOFT = HexColor("#e8d5a3")
CREAM = HexColor("#f8f6f0")
CREAM_DARK = HexColor("#ebe6da")
WHITE = white
MUTED = HexColor("#6b7c70")
ROSE_BG = HexColor("#fff1f2")
ROSE_BD = HexColor("#fda4af")
EMERALD_BG = HexColor("#ecfdf5")
EMERALD_BD = HexColor("#6ee7b7")
SKY_BG = HexColor("#f0f9ff")
SKY_BD = HexColor("#7dd3fc")
ORANGE_BG = HexColor("#fff7ed")
ORANGE_BD = HexColor("#fdba74")
VIOLET_BG = HexColor("#f5f3ff")
VIOLET_BD = HexColor("#c4b5fd")
AMBER_BG = HexColor("#fffbeb")
RED_SOFT = HexColor("#fecaca")
GREEN_SOFT = HexColor("#bbf7d0")
NON_INVESTED = HexColor("#94A3B8")

# Aligné sur apps/web/src/lib/investment-labels.ts
ASSET_CLASS_COLORS = {
    "immobilier": HexColor("#B45309"),
    "actions-halal": HexColor("#7C3AED"),
    "sukuk": HexColor("#2563EB"),
    "or": HexColor("#C9A227"),
    "liquidites": HexColor("#0891B2"),
    "activites-revenus": HexColor("#059669"),
    "non-investi": NON_INVESTED,
}

ASSET_CLASS_LABELS = {
    "immobilier": "Immobilier",
    "sukuk": "Sukuk",
    "actions-halal": "Actions halal",
    "or": "Or",
    "liquidites": "Liquidités",
    "activites-revenus": "Activités revenus",
    "non-investi": "Non investi",
}

CHART_PALETTE = [
    HexColor("#245a3c"),
    HexColor("#c9a227"),
    HexColor("#3d7a55"),
    HexColor("#1a3d2a"),
    HexColor("#8a6d1c"),
    HexColor("#5a8f6e"),
    HexColor("#d4b84a"),
    HexColor("#163322"),
]


def asset_class_color(slug: str, index: int = 0):
    if slug in ASSET_CLASS_COLORS:
        return ASSET_CLASS_COLORS[slug]
    return CHART_PALETTE[index % len(CHART_PALETTE)]


def asset_class_label(slug: str) -> str:
    return ASSET_CLASS_LABELS.get(slug, slug or "—")

FONT_REG = "Helvetica"
FONT_BOLD = "Helvetica-Bold"
_FONTS_READY = False


def ensure_fonts() -> tuple[str, str]:
    """Enregistre une police Unicode si disponible (accents, farāʾiḍ)."""
    global FONT_REG, FONT_BOLD, _FONTS_READY
    if _FONTS_READY:
        return FONT_REG, FONT_BOLD

    candidates = [
        (
            "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
            None,
        ),
        (
            "/Library/Fonts/Arial Unicode.ttf",
            None,
        ),
        (
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ),
        (
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        ),
        (
            str(Path(__file__).resolve().parent / "fonts" / "DejaVuSans.ttf"),
            str(Path(__file__).resolve().parent / "fonts" / "DejaVuSans-Bold.ttf"),
        ),
    ]
    for regular, bold in candidates:
        if not Path(regular).is_file():
            continue
        try:
            pdfmetrics.registerFont(TTFont("SFReport", regular))
            if bold and Path(bold).is_file():
                pdfmetrics.registerFont(TTFont("SFReport-Bold", bold))
                FONT_BOLD = "SFReport-Bold"
            else:
                # Même fichier en gras approximatif
                pdfmetrics.registerFont(TTFont("SFReport-Bold", regular))
                FONT_BOLD = "SFReport-Bold"
            FONT_REG = "SFReport"
            break
        except Exception:  # noqa: BLE001
            continue

    _FONTS_READY = True
    return FONT_REG, FONT_BOLD


def _first_existing(*paths: Path) -> Path | None:
    for p in paths:
        if p.is_file():
            return p
    return None


def _static_dir() -> Path:
    return Path(__file__).resolve().parent / "static"


def _web_brand_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "web" / "public" / "brand"


def horizontal_logo_path() -> Path | None:
    """Logo horizontal officiel (icône + AMANAH / FIDUCIE), fond transparent."""
    d, w = _static_dir(), _web_brand_dir()
    return _first_existing(
        d / "logo-horizontal.png",
        w / "logo-horizontal.png",
    )


def icon_logo_path() -> Path | None:
    """Icône officielle seule (sceau hexagonal)."""
    d, w = _static_dir(), _web_brand_dir()
    return _first_existing(
        d / "logo-icon-official.png",
        w / "logo-icon-official.png",
        d / "logo-seal.png",
        w / "logo-seal.png",
    )


def logo_path() -> Path | None:
    return horizontal_logo_path() or icon_logo_path() or _first_existing(
        Path(__file__).resolve().parents[1]
        / "accounts"
        / "static"
        / "email"
        / "logo-icon.png",
    )


def qr_path() -> Path | None:
    d, w = _static_dir(), _web_brand_dir()
    return _first_existing(
        d / "qr-amanahfiducie.png",
        w / "qr-amanahfiducie.png",
    )


def seal_path() -> Path | None:
    """Compat : préfère l’icône officielle, sinon ancien sceau."""
    return icon_logo_path()
