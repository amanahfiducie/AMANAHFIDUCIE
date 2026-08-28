from accounts.models import UserRole
from cases.permissions import get_user_roles, user_is_internal

AUDIT_READ_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.AUDITEUR,
    UserRole.JURIDIQUE_CONFORMITE,
}


def user_can_read_audit_logs(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & AUDIT_READ_ROLES)


def user_can_read_global_audit(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    roles = get_user_roles(user)
    return UserRole.AUDITEUR in roles or UserRole.DIRECTION in roles
