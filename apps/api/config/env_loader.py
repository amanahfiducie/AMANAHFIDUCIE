"""Charge .env racine monorepo + apps/api/.env (comme le site public)."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# apps/api/config/env_loader.py → apps/api
API_DIR = Path(__file__).resolve().parent.parent
# Racine monorepo (même .env / .dev.vars que le site public)
REPO_ROOT = API_DIR.parent.parent


def normalize_smtp_host(raw: str) -> str:
    """Nettoie SMTP_HOST (guillemets, URL accidentelle, espaces)."""
    h = raw.strip().strip('"').strip("'")
    for prefix in ("https://", "http://", "smtp://"):
        if h.lower().startswith(prefix):
            h = h[len(prefix) :]
    if "/" in h:
        h = h.split("/", 1)[0]
    return h.strip()


def _map_smtp_aliases() -> None:
    """Aligne SMTP_* (racine) sur EMAIL_* (Django)."""
    for key in ("SMTP_HOST", "EMAIL_HOST"):
        val = os.environ.get(key, "").strip()
        if val:
            os.environ[key] = normalize_smtp_host(val)
    pairs = (
        ("SMTP_HOST", "EMAIL_HOST"),
        ("SMTP_PORT", "EMAIL_PORT"),
        ("SMTP_USER", "EMAIL_HOST_USER"),
        ("SMTP_PASS", "EMAIL_HOST_PASSWORD"),
    )
    for src, dest in pairs:
        if os.environ.get(dest, "").strip():
            continue
        val = os.environ.get(src, "").strip()
        if val:
            os.environ[dest] = val
    host = (os.environ.get("SMTP_HOST") or os.environ.get("EMAIL_HOST") or "").lower()
    port = os.environ.get("EMAIL_PORT") or os.environ.get("SMTP_PORT") or ""
    if not port:
        port = "587" if "gmail" in host or "google" in host else "465"
        os.environ["EMAIL_PORT"] = port
        os.environ["SMTP_PORT"] = port
    _sync_smtp_tls_ssl()


def _sync_smtp_tls_ssl() -> None:
    """Port 465 → SSL ; 587 (et autres) → STARTTLS — jamais les deux."""
    port = os.environ.get("EMAIL_PORT") or os.environ.get("SMTP_PORT") or "587"
    if str(port) == "465":
        os.environ["EMAIL_USE_SSL"] = "1"
        os.environ["EMAIL_USE_TLS"] = "0"
    else:
        os.environ["EMAIL_USE_TLS"] = "1"
        os.environ["EMAIL_USE_SSL"] = "0"


def load_project_env() -> None:
    """Charge .env puis .dev.vars — les secrets (.dev.vars) passent en dernier."""
    for path in (
        REPO_ROOT / ".env",
        API_DIR / ".env",
        REPO_ROOT / ".dev.vars",
        API_DIR / ".dev.vars",
    ):
        if path.is_file():
            load_dotenv(path, override=True)
    _map_smtp_aliases()


def pick_env(key: str) -> str:
    return os.environ.get(key, "").strip()


def smtp_pass_is_placeholder(password: str) -> bool:
    p = password.strip()
    if not p:
        return True
    return p in ("your_gmail_app_password", "YOUR_GMAIL_APP_PASSWORD")


def resend_key_is_placeholder(key: str) -> bool:
    k = key.strip()
    if not k.startswith("re_") or len(k) < 12:
        return True
    if k in ("re_your_resend_api_key", "re_your_resend_api_key_here", "YOUR_RESEND_API_KEY"):
        return True
    if k.endswith("_here"):
        return True
    suffix = k[3:]
    if len(suffix) >= 10 and len(set(suffix)) <= 2:
        return True
    return False


def resend_api_key_valid() -> str | None:
    key = pick_env("RESEND_API_KEY")
    if resend_key_is_placeholder(key):
        return None
    return key


def smtp_credentials_valid() -> bool:
    host = pick_env("SMTP_HOST") or pick_env("EMAIL_HOST")
    user = pick_env("SMTP_USER") or pick_env("EMAIL_HOST_USER")
    password = pick_env("SMTP_PASS") or pick_env("EMAIL_HOST_PASSWORD")
    if not host or not user or not password:
        return False
    if smtp_pass_is_placeholder(password):
        return False
    return True


def resend_from_email() -> str:
    return pick_env("RESEND_FROM_EMAIL") or "Amanah Fiducie <onboarding@resend.dev>"


def smtp_from_email() -> str:
    explicit = pick_env("SMTP_FROM_EMAIL")
    if explicit:
        return explicit
    contact = pick_env("CONTACT_TO_EMAIL")
    if contact and "@" in contact:
        return f'"AMANAH Fiducie - Connect" <{contact}>'
    user = pick_env("SMTP_USER") or pick_env("EMAIL_HOST_USER")
    if user and "@" in user and not user.endswith("@smtp-brevo.com"):
        return f'"AMANAH Fiducie - Connect" <{user}>'
    return pick_env("DEFAULT_FROM_EMAIL") or "AMANAH Fiducie <noreply@localhost>"


def login_otp_method() -> str:
    """
    email   — envoi e-mail obligatoire (production / défaut)
    auto    — alias de email (SMTP uniquement, Resend ignoré)
    display — DEBUG uniquement, code à l'écran
    """
    raw = pick_env("LOGIN_OTP_METHOD").lower()
    if raw in ("auto", "display", "email"):
        return raw
    return "email"
