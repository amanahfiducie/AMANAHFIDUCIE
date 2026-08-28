from accounts.models import UserRole
from cases.permissions import get_user_roles


def user_can_validate_mandate(user) -> bool:
    if user is None or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return bool(
        get_user_roles(user)
        & {
            UserRole.SUPER_ADMIN,
            UserRole.DIRECTION,
            UserRole.JURIDIQUE_CONFORMITE,
        }
    )
