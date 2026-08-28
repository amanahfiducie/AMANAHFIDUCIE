from accounts.models import UserRole
from cases.permissions import get_user_roles

SERVICES_VIEW_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.COMPTABLE_FIDUCIAIRE,
}

SERVICES_MANAGE_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
}


def user_can_view_services(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & SERVICES_VIEW_ROLES)


def user_can_manage_services(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & SERVICES_MANAGE_ROLES)
