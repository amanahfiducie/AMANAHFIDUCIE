"""Nommage standardisé des pièces d'identité du donateur."""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path


def normalize_name_part(value: str) -> str:
    """Retire les accents et caractères non alphanumériques (séparateur _)."""
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value.strip())
    ascii_only = "".join(c for c in normalized if not unicodedata.combining(c))
    slug = re.sub(r"[^A-Za-z0-9]+", "_", ascii_only)
    return slug.strip("_")


def build_donor_identity_filename(
    identity_kind: str,
    first_name: str,
    last_name: str,
    original_filename: str,
) -> str:
    """
    Ex. CNI_Amadou_DIOP.pdf, EN_Fatou_SARR.pdf
    - Type en majuscules
    - Prénom en Title Case
    - Nom en MAJUSCULES
    - Extension toujours .pdf
    """
    kind = normalize_name_part(identity_kind).upper() or "PIECE"
    first = normalize_name_part(first_name).title() or "Donateur"
    last = normalize_name_part(last_name).upper() or "INCONNU"
    return f"{kind}_{first}_{last}.pdf"


def build_donor_identity_title(
    identity_kind: str,
    first_name: str,
    last_name: str,
) -> str:
    """Titre lisible aligné sur le nom de fichier (sans extension)."""
    filename = build_donor_identity_filename(
        identity_kind, first_name, last_name, "x.pdf"
    )
    return Path(filename).stem


def build_beneficiary_identity_filename(
    identity_kind: str,
    first_name: str,
    last_name: str,
    original_filename: str,
) -> str:
    """Ex. CNI_BEN_Amadou_DIOP.pdf — évite les collisions avec le donateur."""
    _ = original_filename
    kind = normalize_name_part(identity_kind).upper() or "PIECE"
    first = normalize_name_part(first_name).title() or "Beneficiaire"
    last = normalize_name_part(last_name).upper() or "INCONNU"
    return f"{kind}_BEN_{first}_{last}.pdf"


def build_beneficiary_identity_title(
    identity_kind: str,
    first_name: str,
    last_name: str,
) -> str:
    return Path(
        build_beneficiary_identity_filename(
            identity_kind, first_name, last_name, "x.pdf"
        )
    ).stem


def build_guardian_identity_filename(
    identity_kind: str,
    first_name: str,
    last_name: str,
    original_filename: str,
) -> str:
    """Ex. CNI_TUT_Amadou_DIOP.pdf."""
    _ = original_filename
    kind = normalize_name_part(identity_kind).upper() or "PIECE"
    first = normalize_name_part(first_name).title() or "Tuteur"
    last = normalize_name_part(last_name).upper() or "INCONNU"
    return f"{kind}_TUT_{first}_{last}.pdf"


def build_guardian_identity_title(
    identity_kind: str,
    first_name: str,
    last_name: str,
) -> str:
    return Path(
        build_guardian_identity_filename(identity_kind, first_name, last_name, "x.pdf")
    ).stem


def build_mandate_document_filename(
    mandate_type: str,
    title: str,
    reference_number: str,
    original_filename: str,
) -> str:
    """Ex. MANDAT_FAMILIAL_Mandat_Protection_REF2024.pdf."""
    _ = original_filename
    type_slug = normalize_name_part(mandate_type).upper() or "MANDAT"
    title_slug = normalize_name_part(title).title() or "Sans_Titre"
    ref_slug = normalize_name_part(reference_number).upper() or "SANS_REF"
    return f"MANDAT_{type_slug}_{title_slug}_{ref_slug}.pdf"


def build_mandate_document_title(
    mandate_type: str,
    title: str,
    reference_number: str,
) -> str:
    return Path(
        build_mandate_document_filename(mandate_type, title, reference_number, "x.pdf")
    ).stem
