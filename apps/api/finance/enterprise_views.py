from django.db import transaction
from django.db.models import Count
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from finance.enterprise_permissions import (
    user_can_access_enterprise_finance,
    user_can_manage_enterprise_finance,
)
from finance.enterprise_serializers import (
    EnterpriseAccountCreateSerializer,
    EnterpriseAccountSerializer,
    EnterpriseJustificatifSerializer,
    EnterpriseMovementCreateSerializer,
    EnterpriseMovementSerializer,
    EnterpriseMovementUpdateSerializer,
    MovementCategoryCreateSerializer,
    MovementCategorySerializer,
    MovementCategoryUpdateSerializer,
)
from finance.enterprise_services import get_default_enterprise_account, get_enterprise_financial_summary
from finance.models import EnterpriseAccount, EnterpriseJustificatif, EnterpriseMovement, MovementCategory, MovementStatus


class EnterpriseFinancePermissionMixin:
    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not user_can_access_enterprise_finance(request.user):
            raise PermissionDenied("Accès réservé à la comptabilité entreprise.")


class EnterpriseSummaryView(EnterpriseFinancePermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Synthèse comptable SOFIGEPAM", tags=("Comptabilité entreprise",))
    def get(self, request):
        year = request.query_params.get("year")
        month = request.query_params.get("month")
        return Response(
            get_enterprise_financial_summary(
                year=int(year) if year else None,
                month=int(month) if month else None,
            )
        )


class EnterpriseCategoryViewSet(
    EnterpriseFinancePermissionMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = MovementCategory.objects.all()
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return MovementCategoryCreateSerializer
        if self.action in ("partial_update", "update"):
            return MovementCategoryUpdateSerializer
        return MovementCategorySerializer

    def get_queryset(self):
        qs = MovementCategory.objects.annotate(
            movement_count=Count("enterprise_movements"),
        )
        scope = self.request.query_params.get("scope")
        movement_type = self.request.query_params.get("movement_type")
        if scope:
            qs = qs.filter(scope=scope)
        if movement_type:
            qs = qs.filter(movement_type=movement_type)
        if self.request.query_params.get("include_inactive") != "1":
            qs = qs.filter(is_active=True)
        return qs

    @extend_schema(
        responses={200: MovementCategorySerializer(many=True)},
        tags=("Comptabilité entreprise",),
    )
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(
        request=MovementCategoryCreateSerializer,
        responses={201: MovementCategorySerializer},
        tags=("Comptabilité entreprise",),
    )
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if not user_can_manage_enterprise_finance(request.user):
            raise PermissionDenied("Création de catégorie non autorisée.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = serializer.save()
        log_audit(
            request=request,
            action="ENTERPRISE_CATEGORY_CREATED",
            entity_type="MovementCategory",
            entity_id=category.pk,
        )
        refreshed = MovementCategory.objects.annotate(
            movement_count=Count("enterprise_movements"),
        ).get(pk=category.pk)
        return Response(
            MovementCategorySerializer(refreshed).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=MovementCategoryUpdateSerializer,
        responses={200: MovementCategorySerializer},
        tags=("Comptabilité entreprise",),
    )
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        if not user_can_manage_enterprise_finance(request.user):
            raise PermissionDenied("Modification de catégorie non autorisée.")
        category = self.get_object()
        serializer = MovementCategoryUpdateSerializer(category, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(
            request=request,
            action="ENTERPRISE_CATEGORY_UPDATED",
            entity_type="MovementCategory",
            entity_id=category.pk,
        )
        refreshed = self.get_queryset().get(pk=category.pk)
        return Response(MovementCategorySerializer(refreshed).data)


class EnterpriseAccountViewSet(
    EnterpriseFinancePermissionMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = EnterpriseAccount.objects.filter(is_active=True).select_related("created_by")

    def get_serializer_class(self):
        if self.action == "create":
            return EnterpriseAccountCreateSerializer
        return EnterpriseAccountSerializer

    @extend_schema(tags=("Comptabilité entreprise",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if not user_can_manage_enterprise_finance(request.user):
            raise PermissionDenied("Création de compte entreprise non autorisée.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = EnterpriseAccount.objects.create(
            created_by=request.user,
            **serializer.validated_data,
        )
        log_audit(
            request=request,
            action="ENTERPRISE_ACCOUNT_CREATED",
            entity_type="EnterpriseAccount",
            entity_id=account.pk,
        )
        return Response(
            EnterpriseAccountSerializer(account).data,
            status=status.HTTP_201_CREATED,
        )


class EnterpriseMovementViewSet(
    EnterpriseFinancePermissionMixin,
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = EnterpriseMovement.objects.select_related(
        "account",
        "category",
        "created_by",
    ).prefetch_related("justificatifs", "justificatifs__uploaded_by")
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_serializer_class(self):
        if self.action == "create":
            return EnterpriseMovementCreateSerializer
        if self.action == "partial_update":
            return EnterpriseMovementUpdateSerializer
        return EnterpriseMovementSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx["request"] = self.request
        return ctx

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get("status")
        if status_param:
            statuses = [s.strip() for s in status_param.split(",") if s.strip()]
            qs = qs.filter(status__in=statuses)
        movement_type = self.request.query_params.get("movement_type")
        if movement_type:
            types = [t.strip() for t in movement_type.split(",") if t.strip()]
            qs = qs.filter(movement_type__in=types)
        account_id = self.request.query_params.get("account")
        if account_id:
            qs = qs.filter(account_id=account_id)
        year = self.request.query_params.get("year")
        if year:
            qs = qs.filter(movement_date__year=int(year))
        month = self.request.query_params.get("month")
        if month:
            qs = qs.filter(movement_date__month=int(month))
        if self.action == "list":
            limit = min(int(self.request.query_params.get("limit", 200)), 500)
            return qs[:limit]
        return qs

    @extend_schema(tags=("Comptabilité entreprise",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        if not user_can_manage_enterprise_finance(request.user):
            raise PermissionDenied("Enregistrement de mouvement entreprise non autorisé.")
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = dict(serializer.validated_data)
        account = data.pop("account", None) or get_default_enterprise_account(
            created_by=request.user,
        )
        movement = EnterpriseMovement.objects.create(
            created_by=request.user,
            account=account,
            currency=account.currency,
            status=MovementStatus.DRAFT,
            **data,
        )
        log_audit(
            request=request,
            action="ENTERPRISE_MOVEMENT_CREATED",
            entity_type="EnterpriseMovement",
            entity_id=movement.pk,
        )
        return Response(
            EnterpriseMovementSerializer(movement, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(tags=("Comptabilité entreprise",))
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        if not user_can_manage_enterprise_finance(request.user):
            raise PermissionDenied("Modification non autorisée.")
        return super().partial_update(request, *args, **kwargs)


def _get_movement_or_404(pk: int) -> EnterpriseMovement:
    try:
        return EnterpriseMovement.objects.select_related("account").get(pk=pk)
    except EnterpriseMovement.DoesNotExist as exc:
        raise NotFound("Mouvement introuvable.") from exc


class EnterpriseJustificatifListCreateView(EnterpriseFinancePermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        responses={200: EnterpriseJustificatifSerializer(many=True)},
        tags=("Comptabilité entreprise",),
    )
    def get(self, request, movement_pk: int):
        movement = _get_movement_or_404(movement_pk)
        items = movement.justificatifs.select_related("uploaded_by").all()
        return Response(
            EnterpriseJustificatifSerializer(
                items, many=True, context={"request": request}
            ).data
        )

    @extend_schema(tags=("Comptabilité entreprise",))
    @transaction.atomic
    def post(self, request, movement_pk: int):
        if not user_can_manage_enterprise_finance(request.user):
            raise PermissionDenied("Téléversement non autorisé.")
        movement = _get_movement_or_404(movement_pk)
        uploaded = request.FILES.get("file")
        if not uploaded:
            raise ValidationError({"file": "Le fichier justificatif est obligatoire."})
        title = (request.data.get("title") or uploaded.name or "Justificatif").strip()
        justificatif = EnterpriseJustificatif.objects.create(
            movement=movement,
            title=title[:255],
            file=uploaded,
            original_filename=uploaded.name[:255],
            mime_type=getattr(uploaded, "content_type", "") or "",
            size_bytes=uploaded.size,
            uploaded_by=request.user,
        )
        log_audit(
            request=request,
            action="ENTERPRISE_JUSTIFICATIF_UPLOADED",
            entity_type="EnterpriseJustificatif",
            entity_id=justificatif.pk,
        )
        return Response(
            EnterpriseJustificatifSerializer(justificatif, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class EnterpriseJustificatifDownloadView(EnterpriseFinancePermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Comptabilité entreprise",))
    def get(self, request, pk: int):
        try:
            item = EnterpriseJustificatif.objects.get(pk=pk)
        except EnterpriseJustificatif.DoesNotExist as exc:
            raise NotFound("Justificatif introuvable.") from exc
        from django.http import FileResponse

        return FileResponse(
            item.file.open("rb"),
            as_attachment=True,
            filename=item.original_filename,
            content_type=item.mime_type or "application/octet-stream",
        )
