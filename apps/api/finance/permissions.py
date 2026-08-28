from accounts.models import UserRole
from cases.permissions import CASE_CREATE_ROLES, get_user_roles


FINANCE_VIEW_ROLES = CASE_CREATE_ROLES | {UserRole.COMPTABLE_FIDUCIAIRE}

FINANCE_WRITE_ROLES = CASE_CREATE_ROLES | {UserRole.COMPTABLE_FIDUCIAIRE}


def user_can_view_case_finance(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & FINANCE_VIEW_ROLES)


def user_can_manage_finance(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & FINANCE_WRITE_ROLES)
