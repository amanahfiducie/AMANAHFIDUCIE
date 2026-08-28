from django.db import transaction
from django.db.models import Prefetch
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from cases.access import ensure_case_writable
from documents.models import Document
from cases.models import CaseStatus, CaseType, FiduciaryCase, StakeholderRole, TimelineEventType
from cases.permissions import (
    CaseAccessPermission,
    user_can_access_case,
    user_can_assign_case_manager,
    user_is_internal,
)
from cases.onboarding import (
    get_onboarding_progress,
    get_steps_for_type,
    mark_step_advanced,
    mark_step_skipped,
    serialize_schema,
    validate_onboarding_complete,
)
from cases.serializers import (
    CaseTimelineEventSerializer,
    FiduciaryCaseCreateSerializer,
    FiduciaryCaseDetailSerializer,
    FiduciaryCaseListSerializer,
    FiduciaryCaseUpdateSerializer,
)
from cases.serializers_onboarding import OnboardingAdvanceSerializer
from assets.models import Asset
from assets.services import process_due_valuation_reminders
from cases.services import (
    CLOSE_ALLOWED_FROM,
    SUBMIT_ALLOWED_FROM,
    SUBMIT_TARGET,
    generate_case_reference,
    open_case_assignment,
    record_assignment_change,
    record_timeline_event,
    transition_case_status,
)


class FiduciaryCaseViewSet(viewsets.ModelViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CaseAccessPermission]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = (
            FiduciaryCase.objects.filter(deleted_at__isnull=True)
            .select_related("created_by", "assigned_to")
            .prefetch_related(
                "stakeholders__user",
                "timeline_events__actor",
                "mandates__validations__validated_by",
                "beneficiaries__guardian",
                "donors__trusted_persons",
                "guardians__user",
                Prefetch(
                    "assets",
                    queryset=Asset.objects.filter(is_active=True).prefetch_related(
                        "valuations",
                        "risks",
                        "events__created_by",
                    ),
                ),
                "assignment_history__user",
                "assignment_history__assigned_by",
                Prefetch(
                    "documents",
                    queryset=Document.objects.filter(deleted_at__isnull=True),
                ),
            )
        )
        if user_is_internal(self.request.user):
            return qs
        return qs.filter(stakeholders__user=self.request.user).distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return FiduciaryCaseCreateSerializer
        if self.action == "partial_update":
            return FiduciaryCaseUpdateSerializer
        if self.action == "retrieve":
            return FiduciaryCaseDetailSerializer
        return FiduciaryCaseListSerializer

    @extend_schema(
        summary="Créer un dossier fiduciaire",
        request=FiduciaryCaseCreateSerializer,
        responses={201: FiduciaryCaseDetailSerializer},
        tags=("Dossiers",),
    )
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        case_type = serializer.validated_data.get(
            "case_type",
            CaseType.MANDAT_FIDUCIAIRE,
        )
        steps = get_steps_for_type(case_type)
        first_step = steps[0].id if steps else "identification"
        next_after_identification = next(
            (s.id for s in steps if s.id != "identification"),
            "donor",
        )
        case = FiduciaryCase.objects.create(
            reference=generate_case_reference(),
            case_type=case_type,
            title=serializer.validated_data["title"],
            case_origin=serializer.validated_data.get("case_origin", ""),
            description=serializer.validated_data.get("description", ""),
            assigned_to=serializer.validated_data.get("assigned_to"),
            created_by=request.user,
            status=CaseStatus.DRAFT,
            onboarding_step=next_after_identification,
            onboarding_data={"completed_steps": ["identification"]},
        )
        case.stakeholders.create(
            user=request.user,
            role=StakeholderRole.FIDUCIARY_AGENT,
        )
        if case.assigned_to_id:
            open_case_assignment(
                case,
                case.assigned_to,
                assigned_by=request.user,
                started_at=case.created_at,
            )
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.CREATED,
            message=f"Dossier créé : {case.title}",
            actor=request.user,
            metadata={"reference": case.reference},
        )
        log_audit(
            request=request,
            action="CASE_CREATED",
            entity_type="FiduciaryCase",
            entity_id=case.pk,
            case=case,
            metadata={"reference": case.reference, "status": case.status},
        )
        return Response(
            FiduciaryCaseDetailSerializer(case).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        summary="Liste des dossiers accessibles",
        responses={200: FiduciaryCaseListSerializer(many=True)},
        tags=("Dossiers",),
    )
    def list(self, request, *args, **kwargs):
        queryset = self.get_queryset()
        status_param = request.query_params.get("status")
        if status_param:
            statuses = [s.strip() for s in status_param.split(",") if s.strip()]
            queryset = queryset.filter(status__in=statuses)
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="Détail d’un dossier",
        responses={200: FiduciaryCaseDetailSerializer},
        tags=("Dossiers",),
    )
    def retrieve(self, request, *args, **kwargs):
        case = self.get_object()
        process_due_valuation_reminders(case)
        serializer = self.get_serializer(case)
        return Response(serializer.data)

    @extend_schema(
        summary="Mise à jour partielle d’un dossier",
        responses={200: FiduciaryCaseDetailSerializer},
        tags=("Dossiers",),
    )
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        case = self.get_object()
        ensure_case_writable(request.user, case)
        old_assigned_id = case.assigned_to_id
        serializer = self.get_serializer(case, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        if "assigned_to" in serializer.validated_data:
            if not user_can_assign_case_manager(request.user):
                raise PermissionDenied(
                    "Seul la direction ou un administrateur peut affecter le chargé de dossier."
                )
        serializer.save()
        if "assigned_to" in serializer.validated_data:
            if case.assigned_to_id != old_assigned_id:
                record_assignment_change(
                    case,
                    case.assigned_to,
                    assigned_by=request.user,
                )
        if (
            "assigned_to" not in serializer.validated_data
            or case.assigned_to_id == old_assigned_id
        ):
            record_timeline_event(
                case=case,
                event_type=TimelineEventType.UPDATED,
                message="Dossier mis à jour",
                actor=request.user,
                metadata={"fields": list(serializer.validated_data.keys())},
            )
        log_audit(
            request=request,
            action="CASE_UPDATED",
            entity_type="FiduciaryCase",
            entity_id=case.pk,
            case=case,
            metadata={"fields": list(serializer.validated_data.keys())},
        )
        case.refresh_from_db()
        return Response(FiduciaryCaseDetailSerializer(case).data)

    @extend_schema(
        summary="Schéma d'enregistrement par type de dossier",
        tags=("Dossiers",),
    )
    @action(detail=False, methods=["get"], url_path="onboarding-schema")
    def onboarding_schema(self, request):
        return Response(serialize_schema())

    @extend_schema(
        summary="Progression d'enregistrement du dossier",
        tags=("Dossiers",),
    )
    @action(detail=True, methods=["get"], url_path="onboarding")
    def onboarding(self, request, pk=None):
        case = self.get_object()
        return Response(get_onboarding_progress(case))

    @extend_schema(
        summary="Agents fiduciaires assignables comme chargé de dossier",
        tags=("Dossiers",),
    )
    @action(detail=True, methods=["get"], url_path="assignable-agents")
    def assignable_agents(self, request, pk=None):
        case = self.get_object()
        if not user_can_assign_case_manager(request.user):
            raise PermissionDenied(
                "Seul la direction ou un administrateur peut consulter la liste des chargés."
            )
        from django.contrib.auth import get_user_model
        from accounts.models import UserRole

        User = get_user_model()
        agents = (
            User.objects.filter(
                is_active=True,
                role_assignments__role=UserRole.AGENT_FIDUCIAIRE,
            )
            .select_related("profile")
            .distinct()
            .order_by("first_name", "last_name", "username")
        )
        payload = []
        for user in agents:
            profile = getattr(user, "profile", None)
            display = (getattr(profile, "display_name", None) or "").strip()
            if not display:
                display = (user.get_full_name() or "").strip() or user.username
            payload.append(
                {
                    "id": user.pk,
                    "username": user.username,
                    "display_name": display,
                    "email": user.email or "",
                    "is_current": case.assigned_to_id == user.pk,
                }
            )
        return Response(payload)

    @extend_schema(
        summary="Marquer une étape d'enregistrement comme terminée",
        tags=("Dossiers",),
    )
    @action(detail=True, methods=["post"], url_path="onboarding/complete-step")
    @transaction.atomic
    def complete_onboarding_step(self, request, pk=None):
        case = self.get_object()
        ensure_case_writable(request.user, case)
        if case.status != CaseStatus.DRAFT:
            raise ValidationError({"status": "Enregistrement modifiable uniquement en brouillon."})

        serializer = OnboardingAdvanceSerializer(
            data=request.data,
            context={"case_type": case.case_type},
        )
        serializer.is_valid(raise_exception=True)
        step_id = serializer.validated_data["step_id"]
        data = dict(case.onboarding_data or {})
        if "onboarding_data" in serializer.validated_data:
            data.update(serializer.validated_data["onboarding_data"])
        case.onboarding_data = data

        if serializer.validated_data.get("skip"):
            try:
                mark_step_skipped(case, step_id)
            except ValueError as exc:
                raise ValidationError({"step_id": str(exc)}) from exc
        else:
            mark_step_advanced(case, step_id)

        steps = get_steps_for_type(case.case_type)
        step_ids = [s.id for s in steps]
        try:
            idx = step_ids.index(step_id)
            next_step = step_ids[idx + 1] if idx + 1 < len(step_ids) else "review"
        except ValueError:
            next_step = case.onboarding_step

        case.onboarding_step = next_step
        progress = get_onboarding_progress(case)
        if progress["completed"] and not case.onboarding_completed_at:
            case.onboarding_completed_at = timezone.now()
        elif progress["pending_tasks"] and case.onboarding_completed_at:
            case.onboarding_completed_at = None
        case.save(
            update_fields=[
                "onboarding_data",
                "onboarding_step",
                "onboarding_completed_at",
                "updated_at",
            ]
        )
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Étape d'enregistrement terminée : {step_id}",
            actor=request.user,
            metadata={"step_id": step_id},
        )
        case.refresh_from_db()
        return Response(get_onboarding_progress(case))

    @extend_schema(
        summary="Soumettre un dossier (brouillon → en revue)",
        responses={200: FiduciaryCaseDetailSerializer},
        tags=("Dossiers",),
    )
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def submit(self, request, pk=None):
        case = self.get_object()
        ensure_case_writable(request.user, case)
        if case.status not in SUBMIT_ALLOWED_FROM:
            raise ValidationError(
                {"status": f"Soumission impossible depuis le statut {case.status}."}
            )
        onboarding_errors = validate_onboarding_complete(case)
        if onboarding_errors:
            raise ValidationError({"onboarding": onboarding_errors})
        if not case.onboarding_completed_at:
            case.onboarding_completed_at = timezone.now()
            case.save(update_fields=["onboarding_completed_at", "updated_at"])
        transition_case_status(
            case=case,
            new_status=SUBMIT_TARGET,
            actor=request.user,
            message="Dossier soumis pour revue",
        )
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.SUBMITTED,
            message="Dossier soumis pour revue",
            actor=request.user,
        )
        log_audit(
            request=request,
            action="CASE_SUBMITTED",
            entity_type="FiduciaryCase",
            entity_id=case.pk,
            case=case,
            metadata={"status": case.status},
        )
        from notifications.services import notify_case_submitted

        notify_case_submitted(case, actor=request.user)
        case.refresh_from_db()
        return Response(FiduciaryCaseDetailSerializer(case).data)

    @extend_schema(
        summary="Clôturer un dossier",
        responses={200: FiduciaryCaseDetailSerializer},
        tags=("Dossiers",),
    )
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def close(self, request, pk=None):
        case = self.get_object()
        if case.status not in CLOSE_ALLOWED_FROM:
            raise ValidationError(
                {"status": f"Clôture impossible depuis le statut {case.status}."}
            )
        transition_case_status(
            case=case,
            new_status=CaseStatus.CLOSED,
            actor=request.user,
            message="Dossier clôturé",
        )
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.CLOSED,
            message="Dossier clôturé",
            actor=request.user,
        )
        log_audit(
            request=request,
            action="CASE_CLOSED",
            entity_type="FiduciaryCase",
            entity_id=case.pk,
            case=case,
            metadata={"status": case.status},
        )
        case.refresh_from_db()
        return Response(FiduciaryCaseDetailSerializer(case).data)

    @extend_schema(
        summary="Chronologie du dossier",
        responses={200: CaseTimelineEventSerializer(many=True)},
        tags=("Dossiers",),
    )
    @action(detail=True, methods=["get"])
    def timeline(self, request, pk=None):
        case = self.get_object()
        if not user_can_access_case(request.user, case):
            return Response(status=status.HTTP_403_FORBIDDEN)
        events = case.timeline_events.select_related("actor").all()
        return Response(CaseTimelineEventSerializer(events, many=True).data)
