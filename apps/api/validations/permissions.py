from accounts.models import UserRole
from cases.permissions import CASE_WRITE_ROLES, get_user_roles
from validations.models import ValidationType

VALIDATION_TYPE_ROLES: dict[str, set[str]] = {
    ValidationType.LEGAL: {UserRole.JURIDIQUE_CONFORMITE},
    ValidationType.ACCOUNTING: {UserRole.COMPTABLE_FIDUCIAIRE},
    ValidationType.MANAGEMENT: {UserRole.DIRECTION},
    ValidationType.CHARIA: {UserRole.COMITE_CHARAIQUE},
    ValidationType.AUDIT: {UserRole.AUDITEUR},
    ValidationType.CASE_REVIEW: {
        UserRole.AGENT_FIDUCIAIRE,
        UserRole.DIRECTION,
        UserRole.COMITE_CHARAIQUE,
        UserRole.JURIDIQUE_CONFORMITE,
    },
}

VALIDATION_CREATE_ROLES = CASE_WRITE_ROLES | {
    UserRole.COMPTABLE_FIDUCIAIRE,
    UserRole.JURIDIQUE_CONFORMITE,
    UserRole.DIRECTION,
}


def user_can_create_validation(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & VALIDATION_CREATE_ROLES)


def user_can_decide_step(user, assigned_role: str, *, case=None) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    roles = get_user_roles(user)
    if assigned_role in roles:
        return True
    if (
        case is not None
        and assigned_role == UserRole.AGENT_FIDUCIAIRE
        and case.assigned_to_id == user.pk
    ):
        return True
    return False
