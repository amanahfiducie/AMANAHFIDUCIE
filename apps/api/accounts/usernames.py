"""Génération d'identifiants de connexion (préfixe métier + numéro unique)."""

from __future__ import annotations

import re
import unicodedata

from django.contrib.auth import get_user_model

from accounts.models import ExternalPartyType, UserRole

User = get_user_model()

# Lettre = rôle dans le dossier (profils créés depuis un dossier)
PROFILE_TYPE_PREFIX: dict[str, str] = {
    "donor": "D",
    "beneficiary": "H",
    "guardian": "T",
    "trusted_person": "P",
}

# Lettre = profil principal (visible sur l'identifiant de connexion)
ROLE_PREFIX: dict[str, str] = {
    UserRole.SUPER_ADMIN: "A",  # Administration
    UserRole.DIRECTION: "D",
    UserRole.AGENT_FIDUCIAIRE: "F",  # Fiduciaire
    UserRole.JURIDIQUE_CONFORMITE: "J",
    UserRole.COMPTABLE_FIDUCIAIRE: "C",
    UserRole.COMITE_CHARAIQUE: "K",  # charaïque
    UserRole.AUDITEUR: "U",
    UserRole.NOTAIRE: "N",
    UserRole.JUGE: "G",  # juge
    UserRole.FAMILLE_TUTEUR: "H",  # défaut si pas de sous-type
}

PARTY_TYPE_PREFIX: dict[str, str] = {
    ExternalPartyType.FAMILLE: "H",  # Héritier / famille
    ExternalPartyType.TUTEUR: "T",  # Tuteur
}

# Priorité si plusieurs rôles (le plus spécifique l'emporte)
ROLE_PRIORITY: tuple[str, ...] = (
    UserRole.JUGE,
    UserRole.NOTAIRE,
    UserRole.FAMILLE_TUTEUR,
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.AGENT_FIDUCIAIRE,
    UserRole.JURIDIQUE_CONFORMITE,
    UserRole.COMPTABLE_FIDUCIAIRE,
    UserRole.COMITE_CHARAIQUE,
    UserRole.AUDITEUR,
)

IDENTIFIER_WIDTH = 6  # ex. H000042


def resolve_username_prefix(
    roles: list[str],
    *,
    party_type: str | None = None,
) -> str:
    roles_set = {r for r in roles if r}
    if UserRole.FAMILLE_TUTEUR in roles_set:
        if party_type and party_type in PARTY_TYPE_PREFIX:
            return PARTY_TYPE_PREFIX[party_type]
        return ROLE_PREFIX[UserRole.FAMILLE_TUTEUR]
    for role in ROLE_PRIORITY:
        if role in roles_set:
            return ROLE_PREFIX[role]
    return ROLE_PREFIX[UserRole.AGENT_FIDUCIAIRE]


def _max_sequence_for_prefix(prefix: str) -> int:
    prefix = prefix.upper()
    max_num = 0
    for username in User.objects.filter(username__istartswith=prefix).values_list(
        "username", flat=True
    ):
        suffix = username[len(prefix) :]
        if len(suffix) == IDENTIFIER_WIDTH and suffix.isdigit():
            max_num = max(max_num, int(suffix))
    return max_num


def generate_unique_username(
    roles: list[str],
    *,
    party_type: str | None = None,
) -> str:
    """Ex. H000001 (Héritier), T000012 (Tuteur), A000003 (Admin)."""
    prefix = resolve_username_prefix(roles, party_type=party_type)
    next_num = _max_sequence_for_prefix(prefix) + 1
    if next_num > 10**IDENTIFIER_WIDTH - 1:
        raise ValueError(f"Limite d'identifiants atteinte pour le préfixe {prefix}.")
    candidate = f"{prefix}{next_num:0{IDENTIFIER_WIDTH}d}"
    if User.objects.filter(username__iexact=candidate).exists():
        # Collision rare — essai suivant
        return generate_unique_username_after(roles, party_type=party_type, start=next_num + 1)
    return candidate


def generate_unique_username_after(
    roles: list[str],
    *,
    party_type: str | None = None,
    start: int,
) -> str:
    prefix = resolve_username_prefix(roles, party_type=party_type)
    for num in range(start, 10**IDENTIFIER_WIDTH):
        candidate = f"{prefix}{num:0{IDENTIFIER_WIDTH}d}"
        if not User.objects.filter(username__iexact=candidate).exists():
            return candidate
    raise ValueError(f"Impossible de générer un identifiant pour {prefix}.")


def slugify_username_part(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", (value or "").strip())
    ascii_only = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_only).strip("_")
    return slug or "utilisateur"


def profile_type_username_prefix(profile_type: str) -> str:
    letter = PROFILE_TYPE_PREFIX.get(profile_type)
    if not letter:
        raise ValueError(f"Type de profil dossier inconnu : {profile_type}")
    return letter


def build_case_profile_username(
    profile_type: str,
    first_name: str,
    last_name: str,
    entity_id: int,
) -> str:
    """Ex. T_moussa_ba_42 — lettre du rôle, prénom, nom, id utilisateur."""
    letter = profile_type_username_prefix(profile_type)
    first = slugify_username_part(first_name)
    last = slugify_username_part(last_name)
    return f"{letter}_{first}_{last}_{entity_id}"


def ensure_unique_username(base: str, *, exclude_user_id: int | None = None) -> str:
    base = base[:150]
    qs = User.objects.all()
    if exclude_user_id:
        qs = qs.exclude(pk=exclude_user_id)

    def taken(name: str) -> bool:
        return qs.filter(username__iexact=name).exists()

    if not taken(base):
        return base
    for suffix in range(2, 100):
        candidate = f"{base}_{suffix}"[:150]
        if not taken(candidate):
            return candidate
    raise ValueError(f"Impossible de générer un identifiant unique pour {base}.")


def assign_case_profile_username(
    user,
    *,
    profile_type: str,
    first_name: str,
    last_name: str,
) -> str:
    """Attribue l'identifiant dossier après création du compte (id = pk utilisateur)."""
    base = build_case_profile_username(
        profile_type,
        first_name,
        last_name,
        user.pk,
    )
    username = ensure_unique_username(base, exclude_user_id=user.pk)
    if user.username != username:
        user.username = username
        user.save(update_fields=["username"])
    return username
