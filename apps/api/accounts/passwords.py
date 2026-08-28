"""Génération de mots de passe provisoires (lisibles, copiables depuis un e-mail)."""

from __future__ import annotations

import secrets
import string

from django.contrib.auth.password_validation import validate_password

# Sans caractères ambigus (0/O, 1/l/I) ni symboles URL
_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"


def generate_initial_password(length: int = 14) -> str:
    """Mot de passe provisoire validé par les règles Django."""
    for _ in range(32):
        password = "".join(secrets.choice(_PASSWORD_ALPHABET) for _ in range(length))
        try:
            validate_password(password)
            return password
        except Exception:
            continue
    raise ValueError("Impossible de générer un mot de passe conforme.")
