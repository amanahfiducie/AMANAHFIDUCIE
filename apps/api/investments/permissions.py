from accounts.models import UserRole
from cases.permissions import get_user_roles
from rest_framework.permissions import BasePermission

INVESTMENT_ACCESS_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.AGENT_FIDUCIAIRE,
    UserRole.COMITE_CHARAIQUE,
    UserRole.COMPTABLE_FIDUCIAIRE,
}


def user_can_access_investments(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & INVESTMENT_ACCESS_ROLES)


class CanAccessInvestments(BasePermission):
    message = "Accès investissements non autorisé pour votre rôle."

    def has_permission(self, request, view):
        return user_can_access_investments(request.user)
