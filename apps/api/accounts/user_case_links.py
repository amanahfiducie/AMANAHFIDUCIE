"""Liens utilisateur ↔ dossiers et types de profil métier."""

from __future__ import annotations

from accounts.models import (ProfileUserAccessRequest,
                             ProfileUserAccessRequestStatus, UserRole)
from accounts.profile_types import PROFILE_TYPES
from beneficiaries.models import Guardian
from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

# Accès transversal à tous les dossiers (pas de liste à rattacher).
GLOBAL_CASE_ACCESS_ROLES = frozenset(
    {
        UserRole.SUPER_ADMIN,
        UserRole.DIRECTION,
        UserRole.COMITE_CHARAIQUE,
    }
)


def user_has_global_case_access(user) -> bool:
    if user is None:
        return False
    if getattr(user, "is_superuser", False):
        return True
    roles = set(
        user.role_assignments.values_list("role", flat=True)
        if hasattr(user, "role_assignments")
        else []
    )
    return bool(roles & GLOBAL_CASE_ACCESS_ROLES)


def _empty_link(case) -> dict:
    return {
        "case_id": case.pk,
        "reference": case.reference,
        "title": case.title,
        "profile_types": [],
        "stakeholder_roles": [],
        "is_case_manager": False,
    }


def build_case_links_by_user_id(user_ids: list[int]) -> dict[int, list[dict]]:
    """Agrège les dossiers rattachés et les types de profil par utilisateur."""
    if not user_ids:
        return {}

    links: dict[int, dict[int, dict]] = {uid: {} for uid in user_ids}

    def add(
        user_id: int,
        case,
        *,
        profile_type: str | None = None,
        stakeholder_role: str | None = None,
        is_case_manager: bool = False,
    ) -> None:
        if user_id not in links:
            return
        bucket = links[user_id].setdefault(case.pk, _empty_link(case))
        if profile_type and profile_type in PROFILE_TYPES:
            types = bucket["profile_types"]
            if profile_type not in types:
                types.append(profile_type)
        if stakeholder_role:
            roles = bucket["stakeholder_roles"]
            if stakeholder_role not in roles:
                roles.append(stakeholder_role)
        if is_case_manager:
            bucket["is_case_manager"] = True

    from cases.models import CaseStakeholder, FiduciaryCase

    for row in (
        CaseStakeholder.objects.filter(user_id__in=user_ids)
        .select_related("case")
        .only("user_id", "case_id", "role", "case__reference", "case__title")
    ):
        add(row.user_id, row.case, stakeholder_role=row.role)

    for case in FiduciaryCase.objects.filter(
        assigned_to_id__in=user_ids,
        deleted_at__isnull=True,
    ).only("id", "reference", "title", "assigned_to_id"):
        add(case.assigned_to_id, case, is_case_manager=True)

    for row in (
        ProfileUserAccessRequest.objects.filter(
            status=ProfileUserAccessRequestStatus.APPROVED,
        )
        .filter(Q(existing_user_id__in=user_ids) | Q(created_user_id__in=user_ids))
        .select_related("case")
        .only(
            "profile_type",
            "existing_user_id",
            "created_user_id",
            "case_id",
            "case__reference",
            "case__title",
        )
    ):
        uid = row.existing_user_id or row.created_user_id
        if uid:
            add(uid, row.case, profile_type=row.profile_type)

    for row in (
        Guardian.objects.filter(user_id__in=user_ids)
        .select_related("case")
        .only("user_id", "case_id", "case__reference", "case__title")
    ):
        add(row.user_id, row.case, profile_type="guardian")

    result: dict[int, list[dict]] = {}
    for uid, by_case in links.items():
        items = list(by_case.values())
        items.sort(key=lambda x: x["reference"])
        for item in items:
            item["profile_types"].sort()
            item["stakeholder_roles"].sort()
        result[uid] = items
    return result


def revoke_user_case_access(*, user, case, actor=None) -> dict:
    """
    Retire l'accès explicite d'un utilisateur à un dossier
    (parties prenantes + charge de dossier le cas échéant).
    """
    from cases.models import CaseStakeholder, TimelineEventType
    from cases.services import close_current_assignment, record_timeline_event

    removed_stakeholders = CaseStakeholder.objects.filter(
        user=user,
        case=case,
    ).delete()[0]

    cleared_manager = False
    if case.assigned_to_id == user.pk:
        close_current_assignment(case)
        case.assigned_to = None
        case.save(update_fields=["assigned_to", "updated_at"])
        cleared_manager = True

    if removed_stakeholders or cleared_manager:
        display = (user.get_full_name() or "").strip() or user.username
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Accès suspendu pour {display}",
            actor=actor,
            metadata={
                "revoked_user_id": user.pk,
                "removed_stakeholders": removed_stakeholders,
                "cleared_manager": cleared_manager,
            },
        )

    return {
        "removed_stakeholders": removed_stakeholders,
        "cleared_manager": cleared_manager,
    }


def filter_users_by_profile_type(queryset, profile_type: str):
    if profile_type not in PROFILE_TYPES:
        return queryset.none()
    q = Q()
    if profile_type == "guardian":
        q |= Q(guardian_profiles__isnull=False)
    q |= Q(
        profile_access_requests_as_existing__status=ProfileUserAccessRequestStatus.APPROVED,
        profile_access_requests_as_existing__profile_type=profile_type,
    )
    q |= Q(
        profile_access_requests_created__status=ProfileUserAccessRequestStatus.APPROVED,
        profile_access_requests_created__profile_type=profile_type,
    )
    return queryset.filter(q).distinct()


def filter_users_by_search(queryset, query: str):
    q = query.strip()
    if not q:
        return queryset
    term = q
    return queryset.filter(
        Q(username__icontains=term)
        | Q(email__icontains=term)
        | Q(first_name__icontains=term)
        | Q(last_name__icontains=term)
        | Q(profile__display_name__icontains=term)
        | Q(profile__phone__icontains=term)
        | Q(case_stakeholders__case__reference__icontains=term)
        | Q(case_stakeholders__case__title__icontains=term)
        | Q(cases_assigned__reference__icontains=term)
        | Q(cases_assigned__title__icontains=term)
        | Q(guardian_profiles__case__reference__icontains=term)
        | Q(guardian_profiles__case__title__icontains=term)
        | Q(
            profile_access_requests_as_existing__case__reference__icontains=term,
            profile_access_requests_as_existing__status=ProfileUserAccessRequestStatus.APPROVED,
        )
        | Q(
            profile_access_requests_as_existing__case__title__icontains=term,
            profile_access_requests_as_existing__status=ProfileUserAccessRequestStatus.APPROVED,
        )
        | Q(
            profile_access_requests_created__case__reference__icontains=term,
            profile_access_requests_created__status=ProfileUserAccessRequestStatus.APPROVED,
        )
        | Q(
            profile_access_requests_created__case__title__icontains=term,
            profile_access_requests_created__status=ProfileUserAccessRequestStatus.APPROVED,
        )
    ).distinct()


INTERNAL_USER_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.AGENT_FIDUCIAIRE,
    UserRole.JURIDIQUE_CONFORMITE,
    UserRole.COMPTABLE_FIDUCIAIRE,
    UserRole.COMITE_CHARAIQUE,
    UserRole.AUDITEUR,
}

EXTERNAL_USER_ROLES = {
    UserRole.FAMILLE_TUTEUR,
    UserRole.NOTAIRE,
    UserRole.JUGE,
}


def filter_users_by_role(queryset, role: str):
    valid = {c.value for c in UserRole}
    if role not in valid:
        return queryset.none()
    return queryset.filter(role_assignments__role=role).distinct()


def filter_users_by_scope(queryset, scope: str):
    if scope == "internal":
        return queryset.filter(role_assignments__role__in=INTERNAL_USER_ROLES).distinct()
    if scope == "external":
        return queryset.filter(role_assignments__role__in=EXTERNAL_USER_ROLES).distinct()
    return queryset


def filter_users_by_account_status(queryset, status: str):
    if status == "active":
        return queryset.filter(is_active=True)
    if status == "blocked":
        return queryset.filter(is_active=False)
    return queryset
