from auditlog.services import log_audit
from cases.access import get_accessible_case_or_404
from django.db import transaction
from drf_spectacular.utils import extend_schema
from finance.models import FinancialMovement
from mandates.models import Mandate
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication
from validations.models import (
    ValidationDecisionType,
    ValidationRequest,
    ValidationRequestStatus,
    ValidationStepStatus,
    ValidationType,
)
from validations.permissions import user_can_create_validation, user_can_decide_step
from validations.serializers import (
    CaseValidationCreateSerializer,
    ValidationDecisionInputSerializer,
    ValidationRequestCreateSerializer,
    ValidationRequestSerializer,
)
from validations.services import (
    apply_step_decision,
    create_case_review_validation,
    create_validation_request,
    get_current_step,
)


class ValidationRequestViewSet(
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = ValidationRequest.objects.select_related(
        "case",
        "case__assigned_to",
        "case__assigned_to__profile",
        "requested_by",
        "financial_movement",
        "mandate",
    ).prefetch_related("steps__decisions__decided_by__profile")

    def get_serializer_class(self):
        if self.action == "create":
            return ValidationRequestCreateSerializer
        return ValidationRequestSerializer

    def get_object(self):
        obj = super().get_object()
        get_accessible_case_or_404(self.request.user, obj.case_id)
        return obj

    @extend_schema(tags=("Validations",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if not user_can_create_validation(request.user):
            raise PermissionDenied("Création de validation non autorisée.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        case = get_accessible_case_or_404(request.user, data.pop("case_id"))

        movement = None
        movement_id = data.pop("financial_movement_id", None)
        if movement_id:
            movement = FinancialMovement.objects.select_related("account__case").get(
                pk=movement_id
            )
            if movement.account.case_id != case.pk:
                raise ValidationError(
                    {"financial_movement_id": "Le mouvement n'appartient pas à ce dossier."}
                )

        mandate = None
        mandate_id = data.pop("mandate_id", None)
        if mandate_id:
            mandate = Mandate.objects.get(pk=mandate_id)
            if mandate.case_id != case.pk:
                raise ValidationError(
                    {"mandate_id": "Le mandat n'appartient pas à ce dossier."}
                )

        validation = create_validation_request(
            case=case,
            requested_by=request.user,
            financial_movement=movement,
            mandate=mandate,
            **data,
        )
        log_audit(
            request=request,
            action="VALIDATION_REQUEST_CREATED",
            entity_type="ValidationRequest",
            entity_id=validation.pk,
            case=case,
        )
        return Response(
            ValidationRequestSerializer(validation).data,
            status=status.HTTP_201_CREATED,
        )

    def _decide(self, request, decision: str):
        validation = self.get_object()
        if validation.status not in (
            ValidationRequestStatus.PENDING,
            ValidationRequestStatus.IN_PROGRESS,
        ):
            raise ValidationError({"status": "Cette demande n'est plus en cours."})

        step = get_current_step(validation)
        if step is None:
            raise ValidationError({"status": "Aucune étape en attente."})

        if not user_can_decide_step(
            request.user, step.assigned_role, case=validation.case
        ):
            raise PermissionDenied("Vous n'êtes pas habilité à traiter cette étape.")

        input_serializer = ValidationDecisionInputSerializer(
            data=request.data,
            context={"validation_request": validation, "decision": decision},
        )
        input_serializer.is_valid(raise_exception=True)
        comment = input_serializer.validated_data.get("comment", "")
        return_to_role = input_serializer.validated_data.get("return_to_role") or None

        # Rejet avec destinataire = renvoi pour correction (pas un refus définitif).
        effective_decision = decision
        if (
            decision == ValidationDecisionType.REJECTED
            and return_to_role
        ):
            effective_decision = ValidationDecisionType.REQUEST_CHANGES

        apply_step_decision(
            request=validation,
            step=step,
            decision=effective_decision,
            decided_by=request.user,
            comment=comment,
            return_to_role=return_to_role,
        )
        audit_action = {
            ValidationDecisionType.APPROVED: "VALIDATION_APPROVED",
            ValidationDecisionType.REJECTED: "VALIDATION_REJECTED",
            ValidationDecisionType.REQUEST_CHANGES: "VALIDATION_CHANGES_REQUESTED",
        }[effective_decision]
        log_audit(
            request=request,
            action=audit_action,
            entity_type="ValidationRequest",
            entity_id=validation.pk,
            case=validation.case,
            metadata={
                "step_id": step.pk,
                "decision": effective_decision,
                "return_to_role": return_to_role or "",
            },
        )
        validation.refresh_from_db()
        return Response(
            ValidationRequestSerializer(
                validation, context={"request": request}
            ).data
        )

    @extend_schema(tags=("Validations",))
    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        return self._decide(request, ValidationDecisionType.APPROVED)

    @extend_schema(tags=("Validations",))
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        return self._decide(request, ValidationDecisionType.REJECTED)

    @extend_schema(tags=("Validations",))
    @action(detail=True, methods=["post"], url_path="request-changes")
    def request_changes(self, request, pk=None):
        return self._decide(request, ValidationDecisionType.REQUEST_CHANGES)


class MyValidationQueueView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="File d'attente des validations pour mes rôles",
        tags=("Validations",),
    )
    def get(self, request):
        from accounts.models import RoleAssignment

        roles = set(
            RoleAssignment.objects.filter(user=request.user).values_list(
                "role", flat=True
            )
        )
        if request.user.is_superuser:
            roles.add("SUPER_ADMIN")

        queryset = (
            ValidationRequest.objects.filter(
                status__in=(
                    ValidationRequestStatus.PENDING,
                    ValidationRequestStatus.IN_PROGRESS,
                ),
                steps__status=ValidationStepStatus.PENDING,
                steps__assigned_role__in=roles,
            )
            .select_related(
                "case",
                "case__assigned_to",
                "case__assigned_to__profile",
                "requested_by",
            )
            .prefetch_related("steps__decisions__decided_by__profile")
            .distinct()
            .order_by("-created_at")
        )
        from cases.permissions import user_can_access_case

        accessible = []
        for validation in queryset:
            if not user_can_access_case(request.user, validation.case):
                continue
            step = get_current_step(validation)
            if step and user_can_decide_step(
                request.user, step.assigned_role, case=validation.case
            ):
                accessible.append(validation)

        return Response(
            ValidationRequestSerializer(
                accessible, many=True, context={"request": request}
            ).data
        )


class ValidationInboxView(APIView):
    """Validations des pôles concernés (en cours et déjà tranchées), filtrables."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Boîte de validation (dossiers / demandes) pour mes pôles",
        tags=("Validations",),
    )
    def get(self, request):
        from django.db.models import Q

        from accounts.models import RoleAssignment, UserRole
        from cases.permissions import user_can_access_case

        roles = set(
            RoleAssignment.objects.filter(user=request.user).values_list(
                "role", flat=True
            )
        )
        if request.user.is_superuser:
            roles.add(UserRole.SUPER_ADMIN)

        broad_access = bool(
            roles
            & {
                UserRole.SUPER_ADMIN,
                UserRole.DIRECTION,
            }
        ) or request.user.is_superuser

        queryset = ValidationRequest.objects.select_related(
            "case",
            "case__assigned_to",
            "case__assigned_to__profile",
            "requested_by",
        ).prefetch_related("steps__decisions__decided_by__profile")

        if not broad_access:
            queryset = queryset.filter(steps__assigned_role__in=roles)

        scope = (request.query_params.get("scope") or "").strip().upper()
        validation_type = (request.query_params.get("validation_type") or "").strip()
        if scope == "DOSSIERS" or validation_type == ValidationType.CASE_REVIEW:
            queryset = queryset.filter(validation_type=ValidationType.CASE_REVIEW)
        elif scope == "DEMANDES":
            queryset = queryset.exclude(validation_type=ValidationType.CASE_REVIEW)
            if validation_type and validation_type != ValidationType.CASE_REVIEW:
                queryset = queryset.filter(validation_type=validation_type)
        elif validation_type:
            queryset = queryset.filter(validation_type=validation_type)

        status_filter = (request.query_params.get("status") or "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        q = (request.query_params.get("q") or "").strip()
        if q:
            queryset = queryset.filter(
                Q(case__reference__icontains=q)
                | Q(case__title__icontains=q)
                | Q(title__icontains=q)
                | Q(summary__icontains=q)
            )

        actionable = (request.query_params.get("actionable") or "").strip().lower()
        if actionable in ("1", "true", "yes"):
            queryset = queryset.filter(
                status__in=(
                    ValidationRequestStatus.PENDING,
                    ValidationRequestStatus.IN_PROGRESS,
                ),
                steps__status=ValidationStepStatus.PENDING,
                steps__assigned_role__in=roles,
            )

        queryset = queryset.distinct().order_by("-updated_at", "-created_at")[:200]

        accessible = [
            validation
            for validation in queryset
            if user_can_access_case(request.user, validation.case)
        ]
        return Response(
            ValidationRequestSerializer(
                accessible, many=True, context={"request": request}
            ).data
        )


class CaseValidationListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ValidationRequestSerializer(many=True)},
        tags=("Validations",),
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        qs = (
            ValidationRequest.objects.filter(case=case)
            .select_related(
                "case",
                "case__assigned_to",
                "case__assigned_to__profile",
                "requested_by",
            )
            .prefetch_related("steps__decisions__decided_by__profile")
            .order_by("-created_at")
        )
        return Response(
            ValidationRequestSerializer(
                qs, many=True, context={"request": request}
            ).data
        )

    @extend_schema(
        request=CaseValidationCreateSerializer,
        responses={201: ValidationRequestSerializer},
        tags=("Validations",),
    )
    @transaction.atomic
    def post(self, request, case_pk: int):
        if not user_can_create_validation(request.user):
            raise PermissionDenied("Création de validation non autorisée.")
        case = get_accessible_case_or_404(request.user, case_pk)
        serializer = CaseValidationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        validation = create_case_review_validation(
            case=case,
            title=data["title"],
            summary=data.get("summary", ""),
            subject_type=data.get("subject_type"),
            requested_by=request.user,
        )
        log_audit(
            request=request,
            action="VALIDATION_REQUEST_CREATED",
            entity_type="ValidationRequest",
            entity_id=validation.pk,
            case=case,
            metadata={"validation_type": validation.validation_type},
        )
        validation = (
            ValidationRequest.objects.filter(pk=validation.pk)
            .select_related("case", "requested_by")
            .prefetch_related("steps__decisions__decided_by__profile")
            .first()
        )
        return Response(
            ValidationRequestSerializer(validation).data,
            status=status.HTTP_201_CREATED,
        )
