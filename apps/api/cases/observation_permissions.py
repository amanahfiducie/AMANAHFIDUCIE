from django.contrib.auth.models import AnonymousUser

from accounts.models import UserRole
from cases.models import CaseObservation, CaseObservationKind, CaseObservationStatus, FiduciaryCase
from cases.permissions import get_user_roles, user_can_access_case, user_is_internal

OBSERVATION_SUBMIT_ROLES = {
    UserRole.JURIDIQUE_CONFORMITE,
    UserRole.JUGE,
    UserRole.NOTAIRE,
    UserRole.FAMILLE_TUTEUR,
}

REMARK_AUTHOR_ROLES = {
    UserRole.AGENT_FIDUCIAIRE,
    UserRole.COMITE_CHARAIQUE,
}

OBSERVATION_REVIEW_ROLES = {
    UserRole.DIRECTION,
    UserRole.COMITE_CHARAIQUE,
}


def _is_super(user) -> bool:
    return user is not None and not isinstance(user, AnonymousUser) and user.is_superuser


def user_is_case_manager(user, case: FiduciaryCase) -> bool:
    if user is None or isinstance(user, AnonymousUser):
        return False
    if case.assigned_to_id == user.pk:
        return True
    return UserRole.AGENT_FIDUCIAIRE in get_user_roles(user)


def user_can_submit_observation(user, case: FiduciaryCase) -> bool:
    if not user_can_access_case(user, case):
        return False
    if _is_super(user):
        return True
    roles = get_user_roles(user)
    if roles & OBSERVATION_SUBMIT_ROLES:
        return True
    if not user_is_internal(user):
        return True
    return False


def user_can_add_remark(user, case: FiduciaryCase) -> bool:
    """Remarques internes : direction et comité charaïque."""
    if not user_can_access_case(user, case):
        return False
    if _is_super(user):
        return True
    return bool(get_user_roles(user) & OBSERVATION_REVIEW_ROLES)


def user_can_review_observation(user) -> bool:
    if user is None or isinstance(user, AnonymousUser):
        return False
    if _is_super(user):
        return True
    return bool(get_user_roles(user) & OBSERVATION_REVIEW_ROLES)


def user_can_view_observation(user, observation: CaseObservation) -> bool:
    case = observation.case
    if not user_can_access_case(user, case):
        return False
    if observation.kind == CaseObservationKind.REMARK:
        return True
    if observation.status in (
        CaseObservationStatus.APPROVED,
        CaseObservationStatus.PENDING,
    ):
        return True
    if observation.author_id == user.pk:
        return True
    if user_can_review_observation(user):
        return True
    if user_is_internal(user) and observation.status == CaseObservationStatus.PENDING:
        return True
    return False


def observations_visible_to_user(user, case: FiduciaryCase):
    from django.db.models import Q

    from cases.models import CaseObservation

    if not user_can_access_case(user, case):
        return CaseObservation.objects.none()

    qs = CaseObservation.objects.filter(case=case).select_related(
        "author",
        "reviewed_by",
    )

    can_see_remarks = _is_super(user) or user_can_review_observation(user)
    if not can_see_remarks:
        qs = qs.exclude(kind=CaseObservationKind.REMARK)

    if _is_super(user) or user_can_review_observation(user):
        return qs

    visibility = Q(kind=CaseObservationKind.REMARK) | Q(status=CaseObservationStatus.APPROVED)
    visibility |= Q(author=user)
    if user_is_internal(user):
        visibility |= Q(status=CaseObservationStatus.PENDING)

    return qs.filter(visibility)
