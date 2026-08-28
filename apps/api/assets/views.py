from django.db import transaction
from django.http import FileResponse, Http404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from assets.models import (
    Asset,
    AssetEvent,
    AssetEventCategory,
    AssetEventStatus,
    AssetRisk,
    AssetValuation,
)
from assets.serializers import (
    AssetCreateSerializer,
    AssetEventCancelSerializer,
    AssetEventCategoryCreateSerializer,
    AssetEventCategorySerializer,
    AssetEventCreateSerializer,
    AssetEventSerializer,
    AssetEventUpdateSerializer,
    AssetRiskCreateSerializer,
    AssetRiskSerializer,
    AssetSerializer,
    AssetUpdateSerializer,
    AssetValuationCreateSerializer,
    AssetValuationSerializer,
)
from assets.services import (
    get_case_patrimony_summary,
    refresh_asset_valuation_schedule,
)
from cases.access import ensure_case_writable, get_accessible_case_or_404
from cases.models import TimelineEventType
from cases.services import record_timeline_event


def _get_asset_for_user(request, asset_pk: int) -> Asset:
    asset = Asset.objects.select_related("case").filter(pk=asset_pk).first()
    if not asset:
        from rest_framework.exceptions import NotFound

        raise NotFound()
    get_accessible_case_or_404(request.user, asset.case_id)
    return asset


class CasePatrimonySummaryView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Résumé patrimonial du dossier",
        tags=("Patrimoine",),
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        return Response(get_case_patrimony_summary(case))


class CaseAssetViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_case(self):
        return get_accessible_case_or_404(self.request.user, self.kwargs["case_pk"])

    def get_queryset(self):
        return (
            Asset.objects.filter(case_id=self.kwargs["case_pk"], is_active=True)
            .select_related("created_by", "case")
            .prefetch_related(
                "valuations__created_by",
                "risks__created_by",
                "events__created_by",
                "events__category",
            )
        )

    def get_serializer_class(self):
        if self.action == "create":
            return AssetCreateSerializer
        return AssetSerializer

    @extend_schema(tags=("Patrimoine",))
    def list(self, request, *args, **kwargs):
        self.get_case()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Patrimoine",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        case = self.get_case()
        ensure_case_writable(request.user, case)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        asset = Asset.objects.create(
            case=case,
            created_by=request.user,
            **serializer.validated_data,
        )
        refresh_asset_valuation_schedule(asset)
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Actif ajouté : {asset.label}",
            actor=request.user,
            metadata={"asset_id": asset.pk, "asset_type": asset.asset_type},
        )
        log_audit(
            request=request,
            action="ASSET_CREATED",
            entity_type="Asset",
            entity_id=asset.pk,
            case=case,
            metadata={"asset_type": asset.asset_type},
        )
        return Response(AssetSerializer(asset).data, status=status.HTTP_201_CREATED)


class AssetViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Asset.objects.select_related("case", "created_by").prefetch_related(
        "valuations__created_by",
        "risks__created_by",
        "events__created_by",
    )
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "partial_update":
            return AssetUpdateSerializer
        if self.action == "valuations":
            return AssetValuationCreateSerializer
        if self.action == "risks":
            return AssetRiskCreateSerializer
        return AssetSerializer

    def get_object(self):
        asset = super().get_object()
        get_accessible_case_or_404(self.request.user, asset.case_id)
        return asset

    @extend_schema(tags=("Patrimoine",))
    def partial_update(self, request, *args, **kwargs):
        asset = self.get_object()
        ensure_case_writable(request.user, asset.case)
        serializer = AssetUpdateSerializer(asset, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        refresh_asset_valuation_schedule(asset)
        log_audit(
            request=request,
            action="ASSET_UPDATED",
            entity_type="Asset",
            entity_id=asset.pk,
            case=asset.case,
        )
        return Response(AssetSerializer(asset).data)

    @extend_schema(
        request=AssetValuationCreateSerializer,
        responses={201: AssetValuationSerializer},
        tags=("Patrimoine",),
    )
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def valuations(self, request, pk=None):
        asset = self.get_object()
        ensure_case_writable(request.user, asset.case)
        serializer = AssetValuationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        valuation = AssetValuation.objects.create(
            asset=asset,
            created_by=request.user,
            **serializer.validated_data,
        )
        refresh_asset_valuation_schedule(asset, anchor=valuation.valued_at)
        log_audit(
            request=request,
            action="ASSET_VALUATION_CREATED",
            entity_type="AssetValuation",
            entity_id=valuation.pk,
            case=asset.case,
            metadata={"asset_id": asset.pk, "value": str(valuation.value)},
        )
        return Response(
            AssetValuationSerializer(valuation).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(
        request=AssetRiskCreateSerializer,
        responses={201: AssetRiskSerializer},
        tags=("Patrimoine",),
    )
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def risks(self, request, pk=None):
        asset = self.get_object()
        ensure_case_writable(request.user, asset.case)
        serializer = AssetRiskCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        risk = AssetRisk.objects.create(
            asset=asset,
            created_by=request.user,
            **serializer.validated_data,
        )
        log_audit(
            request=request,
            action="ASSET_RISK_CREATED",
            entity_type="AssetRisk",
            entity_id=risk.pk,
            case=asset.case,
            metadata={"asset_id": asset.pk, "risk_level": risk.risk_level},
        )
        return Response(AssetRiskSerializer(risk).data, status=status.HTTP_201_CREATED)


class AssetEventCategoryListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: AssetEventCategorySerializer(many=True)},
        tags=("Patrimoine",),
    )
    def get(self, request, pk: int):
        asset = _get_asset_for_user(request, pk)
        qs = asset.event_categories.order_by("event_type", "name")
        return Response(AssetEventCategorySerializer(qs, many=True).data)

    @extend_schema(
        request=AssetEventCategoryCreateSerializer,
        responses={201: AssetEventCategorySerializer},
        tags=("Patrimoine",),
    )
    @transaction.atomic
    def post(self, request, pk: int):
        asset = _get_asset_for_user(request, pk)
        ensure_case_writable(request.user, asset.case)
        serializer = AssetEventCategoryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        category = AssetEventCategory.objects.create(
            asset=asset,
            created_by=request.user,
            **serializer.validated_data,
        )
        return Response(
            AssetEventCategorySerializer(category).data,
            status=status.HTTP_201_CREATED,
        )


class AssetEventListCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: AssetEventSerializer(many=True)},
        tags=("Patrimoine",),
    )
    def get(self, request, pk: int):
        asset = _get_asset_for_user(request, pk)
        qs = asset.events.select_related("created_by").order_by("-event_date", "-created_at")
        if request.query_params.get("include_cancelled") != "1":
            qs = qs.filter(status=AssetEventStatus.ACTIVE)
        return Response(
            AssetEventSerializer(qs, many=True, context={"request": request}).data,
        )

    @extend_schema(
        request=AssetEventCreateSerializer,
        responses={201: AssetEventSerializer},
        tags=("Patrimoine",),
    )
    @transaction.atomic
    def post(self, request, pk: int):
        asset = _get_asset_for_user(request, pk)
        ensure_case_writable(request.user, asset.case)
        serializer = AssetEventCreateSerializer(
            data=request.data,
            context={"request": request, "asset": asset},
        )
        serializer.is_valid(raise_exception=True)
        event = AssetEvent.objects.create(
            asset=asset,
            created_by=request.user,
            **serializer.validated_data,
        )
        log_audit(
            request=request,
            action="ASSET_EVENT_CREATED",
            entity_type="AssetEvent",
            entity_id=event.pk,
            case=asset.case,
            metadata={"asset_id": asset.pk, "event_type": event.event_type},
        )
        return Response(
            AssetEventSerializer(event, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AssetEventDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=AssetEventUpdateSerializer,
        responses={200: AssetEventSerializer},
        tags=("Patrimoine",),
    )
    @transaction.atomic
    def patch(self, request, pk: int, event_pk: int):
        asset = _get_asset_for_user(request, pk)
        ensure_case_writable(request.user, asset.case)
        event = AssetEvent.objects.filter(asset=asset, pk=event_pk).first()
        if not event:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if event.status != AssetEventStatus.ACTIVE:
            return Response(
                {"detail": "Cet événement est annulé et ne peut plus être modifié."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AssetEventUpdateSerializer(
            event,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        for key, value in serializer.validated_data.items():
            setattr(event, key, value)
        event.updated_by = request.user
        event.save()
        log_audit(
            request=request,
            action="ASSET_EVENT_UPDATED",
            entity_type="AssetEvent",
            entity_id=event.pk,
            case=asset.case,
            metadata={"asset_id": asset.pk},
        )
        return Response(
            AssetEventSerializer(event, context={"request": request}).data,
        )


class AssetEventJustificationPreviewView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Patrimoine",))
    def get(self, request, pk: int, event_pk: int):
        asset = _get_asset_for_user(request, pk)
        event = AssetEvent.objects.filter(asset=asset, pk=event_pk).first()
        if not event or not event.justification_file:
            raise Http404()
        file_handle = event.justification_file.open("rb")
        return FileResponse(
            file_handle,
            content_type="application/pdf",
            as_attachment=False,
            filename=event.justification_file.name.split("/")[-1],
        )


class AssetEventCancelView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=AssetEventCancelSerializer,
        responses={200: AssetEventSerializer},
        tags=("Patrimoine",),
    )
    @transaction.atomic
    def post(self, request, pk: int, event_pk: int):
        asset = _get_asset_for_user(request, pk)
        ensure_case_writable(request.user, asset.case)
        event = AssetEvent.objects.filter(asset=asset, pk=event_pk).first()
        if not event:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if event.status == AssetEventStatus.CANCELLED:
            return Response(
                {"detail": "Cet événement est déjà annulé."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = AssetEventCancelSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        event.status = AssetEventStatus.CANCELLED
        event.cancelled_at = timezone.now()
        event.cancelled_by = request.user
        event.save(
            update_fields=["status", "cancelled_at", "cancelled_by", "updated_at"],
        )
        log_audit(
            request=request,
            action="ASSET_EVENT_CANCELLED",
            entity_type="AssetEvent",
            entity_id=event.pk,
            case=asset.case,
            metadata={"asset_id": asset.pk},
        )
        return Response(
            AssetEventSerializer(event, context={"request": request}).data,
        )
