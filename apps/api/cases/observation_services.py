from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError

from auditlog.services import log_audit
from cases.models import (
    CaseObservation,
    CaseObservationKind,
    CaseObservationStatus,
    FiduciaryCase,
    TimelineEventType,
)
from cases.observation_permissions import (
    user_can_add_remark,
    user_can_review_observation,
    user_can_submit_observation,
)
from cases.services import record_timeline_event


def create_observation(
    *,
    case: FiduciaryCase,
    author,
    body: str,
    kind: str,
    share: bool = False,
    request=None,
) -> CaseObservation:
    body = body.strip()
    if not body:
        raise ValidationError({"body": "Le texte est obligatoire."})

    if kind == CaseObservationKind.REMARK:
        if not user_can_add_remark(author, case):
            raise PermissionDenied("Seuls la direction et le comité charaïque peuvent ajouter une remarque.")
        observation = CaseObservation.objects.create(
            case=case,
            author=author,
            kind=CaseObservationKind.REMARK,
            status=CaseObservationStatus.APPROVED,
            body=body,
        )
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.REMARK_ADDED,
            message="Remarque interne ajoutée au dossier",
            actor=author,
            metadata={"observation_id": observation.pk},
        )
        if request:
            log_audit(
                request=request,
                action="CASE_REMARK_ADDED",
                entity_type="CaseObservation",
                entity_id=observation.pk,
                case=case,
            )
        return observation

    if not user_can_submit_observation(author, case):
        raise PermissionDenied("Vous ne pouvez pas déposer d'observation sur ce dossier.")

    status = CaseObservationStatus.PENDING if share else CaseObservationStatus.DRAFT
    observation = CaseObservation.objects.create(
        case=case,
        author=author,
        kind=CaseObservationKind.SUBMISSION,
        status=status,
        body=body,
        shared_at=timezone.now() if share else None,
    )
    if share:
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.OBSERVATION_SHARED,
            message="Observation partagée pour validation",
            actor=author,
            metadata={"observation_id": observation.pk},
        )
        if request:
            log_audit(
                request=request,
                action="CASE_OBSERVATION_SHARED",
                entity_type="CaseObservation",
                entity_id=observation.pk,
                case=case,
            )
    return observation


def share_observation(*, observation: CaseObservation, actor, request=None) -> CaseObservation:
    if observation.kind != CaseObservationKind.SUBMISSION:
        raise ValidationError({"kind": "Seules les observations peuvent être partagées."})
    if observation.author_id != actor.pk and not actor.is_superuser:
        raise PermissionDenied("Seul l'auteur peut partager cette observation.")
    if observation.status != CaseObservationStatus.DRAFT:
        raise ValidationError({"status": "Cette observation a déjà été partagée."})

    observation.status = CaseObservationStatus.PENDING
    observation.shared_at = timezone.now()
    observation.save(update_fields=["status", "shared_at", "updated_at"])

    record_timeline_event(
        case=observation.case,
        event_type=TimelineEventType.OBSERVATION_SHARED,
        message="Observation partagée pour validation",
        actor=actor,
        metadata={"observation_id": observation.pk},
    )
    if request:
        log_audit(
            request=request,
            action="CASE_OBSERVATION_SHARED",
            entity_type="CaseObservation",
            entity_id=observation.pk,
            case=observation.case,
        )
    return observation


def review_observation(
    *,
    observation: CaseObservation,
    actor,
    approved: bool,
    review_reason: str = "",
    request=None,
) -> CaseObservation:
    if observation.kind != CaseObservationKind.SUBMISSION:
        raise ValidationError({"kind": "Seules les observations sont soumises à validation."})
    if not user_can_review_observation(actor):
        raise PermissionDenied("Seuls la direction et le comité charaïque peuvent valider ou refuser.")
    if observation.status != CaseObservationStatus.PENDING:
        raise ValidationError({"status": "Cette observation n'est pas en attente de validation."})

    review_reason = review_reason.strip()
    if not approved and not review_reason:
        raise ValidationError({"review_reason": "Le motif du refus est obligatoire."})

    observation.status = (
        CaseObservationStatus.APPROVED if approved else CaseObservationStatus.REJECTED
    )
    observation.reviewed_by = actor
    observation.reviewed_at = timezone.now()
    observation.review_reason = "" if approved else review_reason
    observation.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_reason",
            "updated_at",
        ]
    )

    if approved:
        record_timeline_event(
            case=observation.case,
            event_type=TimelineEventType.OBSERVATION_APPROVED,
            message="Observation retenue et ajoutée au dossier",
            actor=actor,
            metadata={"observation_id": observation.pk},
        )
        action = "CASE_OBSERVATION_APPROVED"
    else:
        record_timeline_event(
            case=observation.case,
            event_type=TimelineEventType.OBSERVATION_REJECTED,
            message="Observation refusée",
            actor=actor,
            metadata={"observation_id": observation.pk, "reason": review_reason},
        )
        action = "CASE_OBSERVATION_REJECTED"

    if request:
        log_audit(
            request=request,
            action=action,
            entity_type="CaseObservation",
            entity_id=observation.pk,
            case=observation.case,
            metadata={"review_reason": review_reason} if not approved else {},
        )
    return observation
