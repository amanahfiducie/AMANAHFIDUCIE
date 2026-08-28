from accounts.models import UserRole
from cases.permissions import get_user_roles, user_is_internal

PORTAL_FAMILY_ROLES = {UserRole.FAMILLE_TUTEUR}
PORTAL_NOTARY_ROLES = {UserRole.NOTAIRE}
PORTAL_JUDGE_ROLES = {UserRole.JUGE}

PORTAL_ROLE_MAP = {
    "portal": PORTAL_FAMILY_ROLES,
    "notaire": PORTAL_NOTARY_ROLES,
    "juge": PORTAL_JUDGE_ROLES,
}


def user_can_access_portal(user, portal_kind: str) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return False
    if user_is_internal(user):
        return False
    allowed = PORTAL_ROLE_MAP.get(portal_kind, set())
    return bool(get_user_roles(user) & allowed)
