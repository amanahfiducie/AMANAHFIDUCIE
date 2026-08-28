from __future__ import annotations

from django.contrib.auth import get_user_model
from django.db.models import Q

from accounts.models import UserRole
from notifications.models import Notification, NotificationPreference, NotificationType

User = get_user_model()


def _preferences_allow_in_app(user) -> bool:
    prefs, _created = NotificationPreference.objects.get_or_create(user=user)
    return prefs.in_app_enabled


def notify_user(
    user,
    *,
    title: str,
    body: str = "",
    case=None,
    notification_type: str = NotificationType.GENERAL,
    action_path: str = "",
    metadata: dict | None = None,
) -> Notification | None:
    if user is None or not getattr(user, "pk", None):
        return None
    if not _preferences_allow_in_app(user):
        return None
    return Notification.objects.create(
        user=user,
        case=case,
        notification_type=notification_type,
        title=title,
        body=body,
        action_path=action_path,
        metadata_json=metadata or {},
    )


def notify_case_submitted(case, *, actor) -> list[Notification]:
    filter_q = Q(
        role_assignments__role__in=[
            UserRole.JURIDIQUE_CONFORMITE,
            UserRole.DIRECTION,
        ],
    )
    if case.assigned_to_id:
        filter_q |= Q(pk=case.assigned_to_id)
    recipients = User.objects.filter(filter_q).distinct()

    created: list[Notification] = []
    for user in recipients:
        note = notify_user(
            user,
            title=f"Dossier soumis : {case.reference}",
            body=case.title,
            case=case,
            notification_type=NotificationType.CASE_SUBMITTED,
            action_path=f"/dossiers/{case.pk}",
            metadata={"submitted_by": getattr(actor, "username", "")},
        )
        if note:
            created.append(note)
    return created


def notify_faraid_review_requested(case, *, actor) -> list[Notification]:
    recipients = (
        User.objects.filter(
            Q(
                role_assignments__role__in=[
                    UserRole.COMITE_CHARAIQUE,
                    UserRole.DIRECTION,
                    UserRole.SUPER_ADMIN,
                ],
            ),
            is_active=True,
        )
        .distinct()
    )

    created: list[Notification] = []
    for user in recipients:
        note = notify_user(
            user,
            title=f"Partage farāʾiḍ à traiter — {case.reference}",
            body=(
                f"Le dossier « {case.title} » a été soumis pour revue successorale. "
                "Attribuez les parts manuellement dans l'espace charaïque."
            ),
            case=case,
            notification_type=NotificationType.FARAID_REVIEW_REQUESTED,
            action_path=f"/charia/dossiers/{case.pk}/partage",
            metadata={"requested_by": getattr(actor, "username", "")},
        )
        if note:
            created.append(note)
    return created


def notify_report_approved(report) -> list[Notification]:
    from cases.models import CaseStakeholder

    stakeholders = CaseStakeholder.objects.filter(case=report.case).select_related(
        "user"
    )
    created: list[Notification] = []
    for sh in stakeholders:
        note = notify_user(
            sh.user,
            title=f"Rapport disponible : {report.title}",
            body=f"Le rapport « {report.title} » a été approuvé pour le dossier {report.case.reference}.",
            case=report.case,
            notification_type=NotificationType.REPORT_APPROVED,
            action_path=f"/portal/dossiers/{report.case_id}",
            metadata={"report_id": report.pk},
        )
        if note:
            created.append(note)
    return created
