from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from cases.access import ensure_case_writable, get_accessible_case_or_404
from cases.services import record_timeline_event
from cases.models import TimelineEventType
from mandates.models import Mandate, MandateValidation
from mandates.permissions import user_can_validate_mandate
from mandates.serializers import (
    MandateCreateSerializer,
    MandateSerializer,
    MandateUpdateSerializer,
    MandateValidateSerializer,
    MandateValidationSerializer,
)


class CaseMandateViewSet(
    mixins.ListModelMixin,
    mixins.CreateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def get_case(self):
        return get_accessible_case_or_404(self.request.user, self.kwargs["case_pk"])

    def get_queryset(self):
        return Mandate.objects.filter(case_id=self.kwargs["case_pk"]).select_related(
            "created_by", "case"
        ).prefetch_related("validations__validated_by")

    def get_serializer_class(self):
        if self.action == "create":
            return MandateCreateSerializer
        return MandateSerializer

    @extend_schema(tags=("Mandats",))
    def list(self, request, *args, **kwargs):
        self.get_case()
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Mandats",))
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        case = self.get_case()
        ensure_case_writable(request.user, case)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        mandate = Mandate.objects.create(
            case=case,
            created_by=request.user,
            **serializer.validated_data,
        )
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Mandat ajouté : {mandate.title}",
            actor=request.user,
            metadata={"mandate_id": mandate.pk},
        )
        log_audit(
            request=request,
            action="MANDATE_CREATED",
            entity_type="Mandate",
            entity_id=mandate.pk,
            case=case,
            metadata={"mandate_type": mandate.mandate_type},
        )
        return Response(
            MandateSerializer(mandate).data,
            status=status.HTTP_201_CREATED,
        )


class MandateViewSet(
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Mandate.objects.select_related("case", "created_by").prefetch_related(
        "validations__validated_by"
    )
    http_method_names = ["get", "patch", "post", "head", "options"]

    def get_serializer_class(self):
        if self.action == "partial_update":
            return MandateUpdateSerializer
        if self.action == "validate":
            return MandateValidateSerializer
        return MandateSerializer

    def get_object(self):
        mandate = super().get_object()
        get_accessible_case_or_404(self.request.user, mandate.case_id)
        return mandate

    @extend_schema(tags=("Mandats",))
    def partial_update(self, request, *args, **kwargs):
        mandate = self.get_object()
        ensure_case_writable(request.user, mandate.case)
        serializer = MandateUpdateSerializer(mandate, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        log_audit(
            request=request,
            action="MANDATE_UPDATED",
            entity_type="Mandate",
            entity_id=mandate.pk,
            case=mandate.case,
        )
        return Response(MandateSerializer(mandate).data)

    @extend_schema(
        request=MandateValidateSerializer,
        responses={201: MandateValidationSerializer},
        tags=("Mandats",),
    )
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def validate(self, request, pk=None):
        mandate = self.get_object()
        if not user_can_validate_mandate(request.user):
            raise PermissionDenied("Validation du mandat non autorisée pour votre rôle.")
        serializer = MandateValidateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        validation = MandateValidation.objects.create(
            mandate=mandate,
            validated_by=request.user,
            **serializer.validated_data,
        )
        record_timeline_event(
            case=mandate.case,
            event_type=TimelineEventType.UPDATED,
            message=f"Mandat validé ({validation.decision}) : {mandate.title}",
            actor=request.user,
            metadata={"mandate_id": mandate.pk, "decision": validation.decision},
        )
        log_audit(
            request=request,
            action="MANDATE_VALIDATED",
            entity_type="Mandate",
            entity_id=mandate.pk,
            case=mandate.case,
            metadata={"decision": validation.decision},
        )
        return Response(
            MandateValidationSerializer(validation).data,
            status=status.HTTP_201_CREATED,
        )
