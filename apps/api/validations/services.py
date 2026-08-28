from __future__ import annotations

from django.db import transaction

from accounts.models import UserRole
from cases.models import TimelineEventType
from cases.services import record_timeline_event
from finance.models import FinancialMovement, MovementStatus
from validations.models import (
    ValidationDecision,
    ValidationDecisionType,
    ValidationRequest,
    ValidationRequestStatus,
    ValidationStep,
    ValidationStepStatus,
    ValidationSubjectType,
    ValidationType,
)

# Circuit standard : chargé → direction → charaïque → juridique
DOSSIER_VALIDATION_WORKFLOW: list[tuple[str, str]] = [
    (UserRole.AGENT_FIDUCIAIRE, "Chargé du dossier"),
    (UserRole.DIRECTION, "Direction"),
    (UserRole.COMITE_CHARAIQUE, "Comité charaïque"),
    (UserRole.JURIDIQUE_CONFORMITE, "Juridique & conformité"),
]

VALIDATION_WORKFLOW_ROLES: dict[str, list[str]] = {
    ValidationType.LEGAL: [UserRole.JURIDIQUE_CONFORMITE],
    ValidationType.ACCOUNTING: [UserRole.COMPTABLE_FIDUCIAIRE],
    ValidationType.MANAGEMENT: [UserRole.DIRECTION],
    ValidationType.CHARIA: [UserRole.COMITE_CHARAIQUE],
    ValidationType.AUDIT: [UserRole.AUDITEUR],
    ValidationType.CASE_REVIEW: [role for role, _ in DOSSIER_VALIDATION_WORKFLOW],
}

STEP_LABEL_BY_ROLE: dict[str, str] = dict(DOSSIER_VALIDATION_WORKFLOW)
STEP_LABEL_BY_ROLE.update(
    {
        UserRole.JURIDIQUE_CONFORMITE: "Juridique & conformité",
        UserRole.COMPTABLE_FIDUCIAIRE: "Comptable fiduciaire",
        UserRole.COMITE_CHARAIQUE: "Comité charaïque",
        UserRole.AGENT_FIDUCIAIRE: "Chargé du dossier",
        UserRole.DIRECTION: "Direction",
        UserRole.AUDITEUR: "Audit",
    }
)


def uses_observation_workflow(validation_type: str) -> bool:
    return validation_type == ValidationType.CASE_REVIEW


def observation_required_for_decision(validation_type: str, decision: str) -> bool:
    if not uses_observation_workflow(validation_type):
        return False
    # Motif obligatoire uniquement pour rejet / renvoi, pas pour valider.
    return decision in (
        ValidationDecisionType.REJECTED,
        ValidationDecisionType.REQUEST_CHANGES,
    )


def get_current_step(request: ValidationRequest) -> ValidationStep | None:
    return (
        request.steps.filter(status=ValidationStepStatus.PENDING)
        .order_by("step_order")
        .first()
    )


def _step_label_for_role(role: str, custom_labels: dict[str, str] | None) -> str:
    if custom_labels and role in custom_labels:
        return custom_labels[role]
    return STEP_LABEL_BY_ROLE.get(role, role.replace("_", " ").title())


@transaction.atomic
def create_validation_request(
    *,
    case,
    validation_type: str,
    title: str,
    requested_by,
    summary: str = "",
    subject_type: str = ValidationSubjectType.OTHER,
    financial_movement: FinancialMovement | None = None,
    mandate=None,
    workflow_roles: list[str] | None = None,
    workflow_labels: dict[str, str] | None = None,
) -> ValidationRequest:
    if workflow_roles is None and validation_type == ValidationType.CASE_REVIEW:
        workflow_roles = [role for role, _ in DOSSIER_VALIDATION_WORKFLOW]
        workflow_labels = {role: label for role, label in DOSSIER_VALIDATION_WORKFLOW}

    roles = workflow_roles or VALIDATION_WORKFLOW_ROLES.get(
        validation_type, [UserRole.DIRECTION]
    )
    request = ValidationRequest.objects.create(
        case=case,
        validation_type=validation_type,
        subject_type=subject_type,
        title=title,
        summary=summary,
        status=ValidationRequestStatus.PENDING,
        financial_movement=financial_movement,
        mandate=mandate,
        requested_by=requested_by,
    )
    for order, role in enumerate(roles, start=1):
        ValidationStep.objects.create(
            request=request,
            step_order=order,
            assigned_role=role,
            step_label=_step_label_for_role(role, workflow_labels),
            status=ValidationStepStatus.PENDING,
        )
    record_timeline_event(
        case=case,
        event_type=TimelineEventType.UPDATED,
        message=f"Demande de validation créée : {title}",
        actor=requested_by,
        metadata={"validation_request_id": request.pk, "validation_type": validation_type},
    )
    return request


@transaction.atomic
def create_case_review_validation(
    *,
    case,
    title: str,
    requested_by,
    summary: str = "",
    subject_type: str = ValidationSubjectType.CASE,
) -> ValidationRequest:
    return create_validation_request(
        case=case,
        validation_type=ValidationType.CASE_REVIEW,
        title=title,
        summary=summary,
        subject_type=subject_type,
        requested_by=requested_by,
    )


@transaction.atomic
def create_movement_validation(
    movement: FinancialMovement,
    *,
    requested_by,
    validation_type: str = ValidationType.ACCOUNTING,
) -> ValidationRequest:
    existing = ValidationRequest.objects.filter(
        financial_movement=movement,
        status__in=(
            ValidationRequestStatus.PENDING,
            ValidationRequestStatus.IN_PROGRESS,
        ),
    ).exists()
    if existing:
        raise ValueError("Une validation est déjà en cours pour ce mouvement.")

    title = (
        f"Validation mouvement {movement.reference or movement.pk} "
        f"({movement.movement_type})"
    )
    return create_validation_request(
        case=movement.account.case,
        validation_type=validation_type,
        title=title,
        summary=movement.description,
        subject_type=ValidationSubjectType.FINANCIAL_MOVEMENT,
        financial_movement=movement,
        requested_by=requested_by,
    )


def _sync_financial_movement(request: ValidationRequest, movement_status: str) -> None:
    movement = request.financial_movement
    if movement is None:
        return
    movement.status = movement_status
    movement.save(update_fields=["status", "updated_at"])


@transaction.atomic
def apply_step_decision(
    *,
    request: ValidationRequest,
    step: ValidationStep,
    decision: str,
    decided_by,
    comment: str = "",
    return_to_role: str | None = None,
) -> ValidationRequest:
    ValidationDecision.objects.create(
        step=step,
        decision=decision,
        comment=comment,
        decided_by=decided_by,
    )
    step.status = decision
    step.save(update_fields=["status"])

    if decision == ValidationDecisionType.APPROVED:
        next_step = (
            request.steps.filter(status=ValidationStepStatus.PENDING)
            .order_by("step_order")
            .first()
        )
        if next_step:
            request.status = ValidationRequestStatus.IN_PROGRESS
            record_timeline_event(
                case=request.case,
                event_type=TimelineEventType.UPDATED,
                message=(
                    f"Validation « {request.title} » : "
                    f"{step.step_label or step.assigned_role} a validé — "
                    f"en attente de {next_step.step_label or next_step.assigned_role}"
                ),
                actor=decided_by,
                metadata={
                    "validation_request_id": request.pk,
                    "step_order": next_step.step_order,
                },
            )
        else:
            request.status = ValidationRequestStatus.APPROVED
            _sync_financial_movement(request, MovementStatus.APPROVED)
            record_timeline_event(
                case=request.case,
                event_type=TimelineEventType.UPDATED,
                message=f"Validation approuvée : {request.title}",
                actor=decided_by,
                metadata={"validation_request_id": request.pk},
            )
    elif decision in (
        ValidationDecisionType.REJECTED,
        ValidationDecisionType.REQUEST_CHANGES,
    ):
        if return_to_role:
            _reopen_from_role(
                request=request,
                current_step=step,
                return_to_role=return_to_role,
                decided_by=decided_by,
                comment=comment,
                decision=decision,
            )
        elif decision == ValidationDecisionType.REJECTED:
            request.status = ValidationRequestStatus.REJECTED
            for pending in request.steps.filter(status=ValidationStepStatus.PENDING):
                pending.status = ValidationStepStatus.SKIPPED
                pending.save(update_fields=["status"])
            _sync_financial_movement(request, MovementStatus.REJECTED)
            record_timeline_event(
                case=request.case,
                event_type=TimelineEventType.UPDATED,
                message=f"Validation rejetée : {request.title}",
                actor=decided_by,
                metadata={"validation_request_id": request.pk},
            )
        else:
            request.status = ValidationRequestStatus.REQUEST_CHANGES
            for pending in request.steps.filter(status=ValidationStepStatus.PENDING):
                pending.status = ValidationStepStatus.SKIPPED
                pending.save(update_fields=["status"])
            _sync_financial_movement(request, MovementStatus.DRAFT)
            record_timeline_event(
                case=request.case,
                event_type=TimelineEventType.UPDATED,
                message=f"Modifications demandées : {request.title}",
                actor=decided_by,
                metadata={"validation_request_id": request.pk},
            )

    request.save(update_fields=["status", "updated_at"])
    return request


def _reopen_from_role(
    *,
    request: ValidationRequest,
    current_step: ValidationStep,
    return_to_role: str,
    decided_by,
    comment: str,
    decision: str,
) -> None:
    """Renvoie le circuit au pôle choisi pour correction puis revalidation."""
    from rest_framework.exceptions import ValidationError

    target = (
        request.steps.filter(assigned_role=return_to_role)
        .order_by("step_order")
        .first()
    )
    if target is None:
        raise ValidationError(
            {"return_to_role": "Le pôle sélectionné n'appartient pas à ce circuit."}
        )
    if target.step_order > current_step.step_order:
        raise ValidationError(
            {
                "return_to_role": (
                    "Vous ne pouvez renvoyer qu'à un pôle déjà passé "
                    "ou à l'étape en cours."
                )
            }
        )

    # Conservé en historique sur l'étape courante, puis réouverture du tronçon.
    for s in request.steps.filter(step_order__gte=target.step_order):
        s.status = ValidationStepStatus.PENDING
        s.save(update_fields=["status"])

    request.status = (
        ValidationRequestStatus.PENDING
        if target.step_order == 1
        else ValidationRequestStatus.IN_PROGRESS
    )
    _sync_financial_movement(request, MovementStatus.DRAFT)

    target_label = target.step_label or target.assigned_role
    record_timeline_event(
        case=request.case,
        event_type=TimelineEventType.UPDATED,
        message=(
            f"Validation « {request.title} » renvoyée à {target_label} "
            f"pour correction"
            + (f" : {comment}" if comment else "")
        ),
        actor=decided_by,
        metadata={
            "validation_request_id": request.pk,
            "return_to_role": return_to_role,
            "decision": decision,
        },
    )


def get_return_targets(request: ValidationRequest) -> list[dict]:
    """Pôles / personnes vers lesquels on peut renvoyer pour correction."""
    current = get_current_step(request)
    if current is None:
        return []

    case = request.case
    assigned = getattr(case, "assigned_to", None)
    assigned_name = ""
    if assigned is not None:
        profile = getattr(assigned, "profile", None)
        display = (getattr(profile, "display_name", None) or "").strip()
        full = (assigned.get_full_name() or "").strip()
        assigned_name = display or full or assigned.get_username()

    targets: list[dict] = []
    for step in request.steps.filter(step_order__lt=current.step_order).order_by(
        "step_order"
    ):
        label = STEP_LABEL_BY_ROLE.get(
            step.assigned_role,
            step.step_label or step.assigned_role,
        )
        person_name = ""
        person_id = None
        if step.assigned_role == UserRole.AGENT_FIDUCIAIRE and assigned is not None:
            person_name = assigned_name
            person_id = assigned.pk
        elif step.step_order == 1 and request.requested_by_id and person_id is None:
            req_user = request.requested_by
            person_id = req_user.pk
            person_name = (
                (req_user.get_full_name() or "").strip() or req_user.get_username()
            )
            if step.assigned_role != UserRole.AGENT_FIDUCIAIRE:
                label = f"{label} (demandeur)"

        targets.append(
            {
                "role": step.assigned_role,
                "label": label,
                "step_order": step.step_order,
                "user_id": person_id,
                "user_name": person_name,
            }
        )
    return targets
