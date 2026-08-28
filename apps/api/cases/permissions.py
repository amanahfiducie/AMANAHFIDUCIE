from django.contrib.auth.models import AnonymousUser
from rest_framework.permissions import BasePermission

from accounts.models import RoleAssignment, UserRole
from cases.models import CaseStakeholder, FiduciaryCase

INTERNAL_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.AGENT_FIDUCIAIRE,
    UserRole.JURIDIQUE_CONFORMITE,
    UserRole.COMPTABLE_FIDUCIAIRE,
    UserRole.COMITE_CHARAIQUE,
    UserRole.AUDITEUR,
}

CASE_CREATE_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.AGENT_FIDUCIAIRE,
}

CASE_WRITE_ROLES = CASE_CREATE_ROLES


CASE_ASSIGN_MANAGER_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
}


def get_user_roles(user) -> set[str]:
    if user is None or isinstance(user, AnonymousUser):
        return set()
    if user.is_superuser:
        return {UserRole.SUPER_ADMIN}
    return set(
        RoleAssignment.objects.filter(user=user).values_list("role", flat=True)
    )


def user_is_internal(user) -> bool:
    return bool(get_user_roles(user) & INTERNAL_ROLES) or (
        user is not None
        and not isinstance(user, AnonymousUser)
        and user.is_superuser
    )


def user_can_create_case(user) -> bool:
    if user is None or isinstance(user, AnonymousUser):
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & CASE_CREATE_ROLES)


def user_can_write_case(user) -> bool:
    if user is None or isinstance(user, AnonymousUser):
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & CASE_WRITE_ROLES)


def user_can_assign_case_manager(user) -> bool:
    """Direction / super-admin uniquement : affecter le chargé de dossier."""
    if user is None or isinstance(user, AnonymousUser):
        return False
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & CASE_ASSIGN_MANAGER_ROLES)


def user_can_access_case(user, case: FiduciaryCase) -> bool:
    if case.is_deleted:
        return user_is_internal(user) and (
            user.is_superuser or UserRole.SUPER_ADMIN in get_user_roles(user)
        )
    if user_is_internal(user):
        return True
    return CaseStakeholder.objects.filter(case=case, user=user).exists()


class CaseAccessPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if view.action == "create":
            return user_can_create_case(request.user)
        return True

    def has_object_permission(self, request, view, obj: FiduciaryCase):
        if not user_can_access_case(request.user, obj):
            return False
        if view.action in ("update", "partial_update", "submit", "close"):
            return user_can_write_case(request.user)
        return True
