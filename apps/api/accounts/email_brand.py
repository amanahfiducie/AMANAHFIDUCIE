"""Charte e-mail SOFIGEPAM Connect — couleurs et logo (globals.css uniquement)."""

from __future__ import annotations

import base64
from pathlib import Path

from config.env_loader import pick_env

# Aligné strictement sur apps/web/src/app/globals.css (:root)
SF_GREEN_DEEP = "#0f2418"
SF_GREEN = "#1a3d2a"
SF_GREEN_MID = "#245a3c"
SF_GOLD = "#c9a227"
SF_GOLD_SOFT = "#e8d5a3"
SF_CREAM = "#f8f6f0"
SF_CREAM_DARK = "#ebe6da"
SF_BACKGROUND = "#f4f6f3"
SF_FOREGROUND = "#1a2e1f"

EMAIL_STATIC_DIR = Path(__file__).resolve().parent / "static" / "email"
LOGO_ICON_PATH = EMAIL_STATIC_DIR / "logo-icon.png"
LOGO_FALLBACK_PATH = EMAIL_STATIC_DIR / "logo-48.png"

BRAND_LOGO_CONTENT_ID = "brand-logo@amanah-fiducie.sn"
DEFAULT_BRAND_SITE = "https://amanahfiducie.sn"


def brand_site_url() -> str:
    raw = pick_env("BRAND_SITE_URL") or DEFAULT_BRAND_SITE
    url = raw.strip().rstrip("/")
    if not url.startswith(("http://", "https://")):
        url = f"https://{url}"
    return url


def brand_logo_path() -> Path:
    if LOGO_ICON_PATH.is_file():
        return LOGO_ICON_PATH
    return LOGO_FALLBACK_PATH


def brand_logo_url() -> str:
    explicit = pick_env("BRAND_LOGO_URL")
    if explicit:
        return explicit.strip()
    connect = pick_env("CONNECT_PUBLIC_URL") or pick_env("FRONTEND_PUBLIC_URL")
    if connect:
        return f"{connect.strip().rstrip('/')}/brand/logo-icon.png"
    return f"{brand_site_url()}/brand/logo-icon.png"


def brand_logo_cid_src() -> str:
    """Référence inline pour SMTP / Resend (pièce jointe Content-ID)."""
    return f"cid:{BRAND_LOGO_CONTENT_ID}"


def brand_logo_html_src() -> str:
    """
    Source <img> pour les e-mails transactionnels.
    Par défaut : CID (Gmail/Outlook bloquent les data: URI).
    EMAIL_LOGO_USE_URL=1 : URL absolue (site ou Connect).
    """
    if pick_env("EMAIL_LOGO_USE_URL") == "1":
        return brand_logo_url()
    if brand_logo_path().is_file():
        return brand_logo_cid_src()
    return brand_logo_url()


def brand_logo_bytes() -> tuple[bytes, str] | None:
    path = brand_logo_path()
    if not path.is_file():
        return None
    data = path.read_bytes()
    suffix = path.suffix.lower()
    subtype = "png" if suffix == ".png" else "jpeg"
    return data, subtype


def connect_login_url() -> str:
    """URL de connexion SOFIGEPAM Connect (app web)."""
    raw = pick_env("CONNECT_PUBLIC_URL") or pick_env("FRONTEND_PUBLIC_URL") or ""
    base = raw.strip().rstrip("/")
    if base:
        return f"{base}/login"
    return brand_site_url()


def brand_logo_attachment_base64() -> dict[str, str] | None:
    """Pièce jointe inline pour l'API Resend."""
    loaded = brand_logo_bytes()
    if not loaded:
        return None
    data, subtype = loaded
    ext = "png" if subtype == "png" else "jpg"
    return {
        "filename": f"logo.{ext}",
        "content": base64.b64encode(data).decode("ascii"),
        "content_id": BRAND_LOGO_CONTENT_ID,
        "content_type": f"image/{subtype}",
    }
