from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from cases.access import ensure_case_writable, get_accessible_case_or_404
from cases.models import TimelineEventType
from cases.services import record_timeline_event
from finance.models import FinancialMovement, FiduciaryAccount, MovementStatus
from cases.permissions import user_can_access_case, user_is_internal
from finance.permissions import user_can_manage_finance, user_can_view_case_finance
from finance.serializers import (
    FinancialMovementCreateSerializer,
    FinancialMovementOverviewSerializer,
    FinancialMovementSerializer,
    FinancialMovementUpdateSerializer,
    FiduciaryAccountCreateSerializer,
    FiduciaryAccountSerializer,
)
from finance.services import get_case_financial_summary


class CaseFinancialSummaryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Résumé financier du dossier", tags=("Finance",))
    def get(self, request, case_pk: int):
        if not user_can_view_case_finance(request.user):
            raise PermissionDenied("Accès finance non autorisé pour votre rôle.")
        case = get_accessible_case_or_404(request.user, case_pk)
        return Response(get_case_financial_summary(case))


class CaseFiduciaryAccountViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_case(self):
        return get_accessible_case_or_404(self.request.user, self.kwargs["case_pk"])

    def get_queryset(self):
        return FiduciaryAccount.objects.filter(
            case_id=self.kwargs["case_pk"]
        ).select_related("created_by", "case")

    def get_serializer_class(self):
        if self.action == "create":
            return FiduciaryAccountCreateSerializer
        return FiduciaryAccountSerializer

    @extend_schema(tags=("Finance",))
    def list(self, request, *args, **kwargs):
        if not user_can_view_case_finance(request.user):
            raise PermissionDenied("Accès finance non autorisé pour votre rôle.")
        self.get_case()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Finance",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if not user_can_manage_finance(request.user):
            raise PermissionDenied("Création de compte non autorisée pour votre rôle.")
        case = self.get_case()
        ensure_case_writable(request.user, case)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = FiduciaryAccount.objects.create(
            case=case,
            created_by=request.user,
            **serializer.validated_data,
        )
        log_audit(
            request=request,
            action="FIDUCIARY_ACCOUNT_CREATED",
            entity_type="FiduciaryAccount",
            entity_id=account.pk,
            case=case,
        )
        return Response(
            FiduciaryAccountSerializer(account).data,
            status=status.HTTP_201_CREATED,
        )


class AccountMovementViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_account(self) -> FiduciaryAccount:
        account = FiduciaryAccount.objects.select_related("case").get(
            pk=self.kwargs["account_pk"]
        )
        get_accessible_case_or_404(self.request.user, account.case_id)
        return account

    def get_queryset(self):
        return FinancialMovement.objects.filter(
            account_id=self.kwargs["account_pk"]
        ).select_related("category", "document", "created_by")

    def get_serializer_class(self):
        if self.action == "create":
            return FinancialMovementCreateSerializer
        return FinancialMovementSerializer

    @extend_schema(tags=("Finance",))
    def list(self, request, *args, **kwargs):
        if not user_can_view_case_finance(request.user):
            raise PermissionDenied("Accès finance non autorisé pour votre rôle.")
        self.get_account()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Finance",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if not user_can_manage_finance(request.user):
            raise PermissionDenied("Enregistrement de mouvement non autorisé.")
        account = self.get_account()
        ensure_case_writable(request.user, account.case)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data.get("document") and data["document"].case_id != account.case_id:
            raise ValidationError(
                {"document": "Le justificatif doit appartenir au même dossier."}
            )
        movement = FinancialMovement.objects.create(
            account=account,
            created_by=request.user,
            currency=data.get("currency") or account.currency,
            status=MovementStatus.DRAFT,
            **{k: v for k, v in data.items() if k != "currency"},
        )
        record_timeline_event(
            case=account.case,
            event_type=TimelineEventType.UPDATED,
            message=f"Mouvement enregistré : {movement.movement_type} {movement.amount}",
            actor=request.user,
            metadata={"movement_id": movement.pk},
        )
        log_audit(
            request=request,
            action="FINANCIAL_MOVEMENT_CREATED",
            entity_type="FinancialMovement",
            entity_id=movement.pk,
            case=account.case,
        )
        return Response(
            FinancialMovementSerializer(movement).data,
            status=status.HTTP_201_CREATED,
        )


class FinancialMovementViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = FinancialMovement.objects.select_related("account__case", "category")
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "partial_update":
            return FinancialMovementUpdateSerializer
        return FinancialMovementSerializer

    def get_object(self):
        movement = super().get_object()
        get_accessible_case_or_404(self.request.user, movement.account.case_id)
        return movement

    def partial_update(self, request, *args, **kwargs):
        movement = self.get_object()
        ensure_case_writable(request.user, movement.account.case)
        return super().partial_update(request, *args, **kwargs)

    @extend_schema(tags=("Finance",))
    @action(detail=True, methods=["post"], url_path="submit-validation")
    @transaction.atomic
    def submit_validation(self, request, pk=None):
        movement = self.get_object()
        ensure_case_writable(request.user, movement.account.case)
        if not user_can_manage_finance(request.user):
            raise PermissionDenied("Soumission non autorisée.")
        if movement.status != MovementStatus.DRAFT:
            raise ValidationError(
                {"status": "Seuls les mouvements en brouillon peuvent être soumis."}
            )
        movement.status = MovementStatus.PENDING_VALIDATION
        movement.save(update_fields=["status", "updated_at"])
        from validations.services import create_movement_validation

        try:
            create_movement_validation(movement, requested_by=request.user)
        except ValueError as exc:
            raise ValidationError({"status": str(exc)}) from exc
        record_timeline_event(
            case=movement.account.case,
            event_type=TimelineEventType.UPDATED,
            message=f"Mouvement soumis à validation : {movement.reference or movement.pk}",
            actor=request.user,
            metadata={"movement_id": movement.pk},
        )
        log_audit(
            request=request,
            action="FINANCIAL_MOVEMENT_SUBMITTED",
            entity_type="FinancialMovement",
            entity_id=movement.pk,
            case=movement.account.case,
        )
        return Response(FinancialMovementSerializer(movement).data)


class FinanceAccountListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: FiduciaryAccountSerializer(many=True)},
        tags=("Finance",),
    )
    def get(self, request):
        if not user_can_view_case_finance(request.user):
            raise PermissionDenied("Accès finance non autorisé pour votre rôle.")
        if not user_is_internal(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = FiduciaryAccount.objects.filter(is_active=True).select_related(
            "case", "created_by"
        )
        accessible = [a for a in qs if user_can_access_case(request.user, a.case)]
        return Response(FiduciaryAccountSerializer(accessible, many=True).data)


class FinanceMovementListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: FinancialMovementOverviewSerializer(many=True)},
        tags=("Finance",),
    )
    def get(self, request):
        if not user_can_view_case_finance(request.user):
            raise PermissionDenied("Accès finance non autorisé pour votre rôle.")
        if not user_is_internal(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        qs = FinancialMovement.objects.select_related(
            "account__case", "category", "created_by"
        ).order_by("-movement_date", "-created_at")
        status_param = request.query_params.get("status")
        if status_param:
            statuses = [s.strip() for s in status_param.split(",") if s.strip()]
            qs = qs.filter(status__in=statuses)
        limit = min(int(request.query_params.get("limit", 100)), 300)
        movements = [
            m
            for m in qs[: limit * 2]
            if user_can_access_case(request.user, m.account.case)
        ][:limit]
        return Response(FinancialMovementOverviewSerializer(movements, many=True).data)
