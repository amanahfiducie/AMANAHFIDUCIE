from django.contrib.auth.models import AnonymousUser
from rest_framework.permissions import BasePermission

from accounts.models import RoleAssignment, UserRole


def user_can_manage_users(user) -> bool:
    """Peut créer/modifier utilisateurs ou ajouter des rôles métier."""
    if user is None or isinstance(user, AnonymousUser):
        return False
    if user.is_superuser:
        return True
    return RoleAssignment.objects.filter(user=user, role=UserRole.SUPER_ADMIN).exists()


class CanManageUsersOnly(BasePermission):
    """Réservé aux super‑utilisateurs Django ou aux comptes rôle SUPER_ADMIN."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and user_can_manage_users(request.user)
        )


class UserScopedAccess(BasePermission):
    """Liste création utilisateurs réservées aux admins ; objet = soit soi‑même, soit admin métier."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if view.action in ("list", "create", "destroy"):
            return user_can_manage_users(request.user)
        return True

    def has_object_permission(self, request, view, obj):
        if user_can_manage_users(request.user):
            return True
        if view.action == "partial_update":
            return False
        return obj.id == request.user.id
