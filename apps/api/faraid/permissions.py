from django.contrib.auth.models import AnonymousUser

from accounts.models import RoleAssignment, UserRole

FARAID_REVIEW_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.COMITE_CHARAIQUE,
}


def user_can_review_faraid(user) -> bool:
    if user is None or isinstance(user, AnonymousUser):
        return False
    if user.is_superuser:
        return True
    roles = set(RoleAssignment.objects.filter(user=user).values_list("role", flat=True))
    return bool(roles & FARAID_REVIEW_ROLES)
