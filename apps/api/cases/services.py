from __future__ import annotations

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from cases.models import (
    CaseAssignment,
    CaseStatus,
    CaseTimelineEvent,
    FiduciaryCase,
    StakeholderRole,
    TimelineEventType,
)


def generate_case_reference() -> str:
    year = timezone.now().year
    prefix = f"REF-{year}-"
    last = (
        FiduciaryCase.objects.filter(reference__startswith=prefix)
        .aggregate(max_ref=Max("reference"))
        .get("max_ref")
    )
    if last:
        try:
            seq = int(last.split("-")[-1]) + 1
        except ValueError:
            seq = 1
    else:
        seq = 1
    return f"{prefix}{seq:05d}"


@transaction.atomic
def record_timeline_event(
    *,
    case: FiduciaryCase,
    event_type: str,
    message: str,
    actor=None,
    metadata: dict | None = None,
) -> CaseTimelineEvent:
    return CaseTimelineEvent.objects.create(
        case=case,
        event_type=event_type,
        actor=actor,
        message=message,
        metadata_json=metadata or {},
    )


def close_current_assignment(case: FiduciaryCase, *, ended_at=None) -> None:
    ended = ended_at or timezone.now()
    CaseAssignment.objects.filter(case=case, ended_at__isnull=True).update(
        ended_at=ended
    )


def open_case_assignment(
    case: FiduciaryCase,
    user,
    *,
    assigned_by=None,
    started_at=None,
) -> CaseAssignment | None:
    if user is None:
        return None
    started = started_at or timezone.now()
    close_current_assignment(case, ended_at=started)
    return CaseAssignment.objects.create(
        case=case,
        user=user,
        assigned_by=assigned_by,
        started_at=started,
    )


@transaction.atomic
def record_assignment_change(
    case: FiduciaryCase,
    new_user,
    *,
    assigned_by,
) -> CaseAssignment | None:
    """Clôture le chargé actuel et ouvre une nouvelle période si besoin."""
    now = timezone.now()
    current = (
        CaseAssignment.objects.filter(case=case, ended_at__isnull=True)
        .select_related("user")
        .first()
    )
    new_id = getattr(new_user, "pk", None) if new_user else None
    if current and current.user_id == new_id:
        return current

    close_current_assignment(case, ended_at=now)
    assignment = open_case_assignment(
        case,
        new_user,
        assigned_by=assigned_by,
        started_at=now,
    )

    if new_user:
        label = getattr(new_user, "username", str(new_user))
        msg = f"Chargé du dossier : {label}"
        case.stakeholders.get_or_create(
            user=new_user,
            role=StakeholderRole.FIDUCIARY_AGENT,
        )
    else:
        msg = "Chargé du dossier retiré"
    if current:
        prev = getattr(current.user, "username", "")
        msg = f"{msg} (remplace {prev})"

    record_timeline_event(
        case=case,
        event_type=TimelineEventType.UPDATED,
        message=msg,
        actor=assigned_by,
        metadata={
            "assignment_change": True,
            "from_user_id": current.user_id if current else None,
            "to_user_id": new_id,
        },
    )
    return assignment


SUBMIT_ALLOWED_FROM = {CaseStatus.DRAFT}
SUBMIT_TARGET = CaseStatus.UNDER_REVIEW

CLOSE_ALLOWED_FROM = {
    CaseStatus.ACTIVE,
    CaseStatus.CLOSING,
    CaseStatus.SUSPENDED,
    CaseStatus.UNDER_REVIEW,
    CaseStatus.LEGAL_REVIEW,
    CaseStatus.COMPLIANCE_REVIEW,
}


def transition_case_status(
    *,
    case: FiduciaryCase,
    new_status: str,
    actor,
    message: str,
) -> FiduciaryCase:
    old_status = case.status
    case.status = new_status
    case.save(update_fields=["status", "updated_at"])
    record_timeline_event(
        case=case,
        event_type=TimelineEventType.STATUS_CHANGED,
        message=message,
        actor=actor,
        metadata={"from_status": old_status, "to_status": new_status},
    )
    return case
