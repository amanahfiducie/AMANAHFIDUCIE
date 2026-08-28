from accounts.models import UserRole
from cases.permissions import get_user_roles

ENTERPRISE_FINANCE_READ_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.COMPTABLE_FIDUCIAIRE,
}

ENTERPRISE_FINANCE_WRITE_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.COMPTABLE_FIDUCIAIRE,
}


def user_can_access_enterprise_finance(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & ENTERPRISE_FINANCE_READ_ROLES)


def user_can_manage_enterprise_finance(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & ENTERPRISE_FINANCE_WRITE_ROLES)
