from django.db import transaction
from django.db.models import Count, Prefetch, Q
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from services.models import BillingFormula, BillingPeriodicity, ServiceBillingRule, ServiceOffer
from services.permissions import user_can_manage_services, user_can_view_services
from services.serializers import (
    ServiceBillingRuleSerializer,
    ServiceBillingRuleWriteSerializer,
    ServiceOfferDetailSerializer,
    ServiceOfferListSerializer,
    ServiceOfferUpdateSerializer,
)


class ServiceOfferViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "patch", "head", "options"]
    lookup_field = "case_type"
    lookup_value_regex = r"[A-Z_]+"

    def get_queryset(self):
        qs = ServiceOffer.objects.all().annotate(
            _active_rules_count=Count(
                "billing_rules",
                filter=Q(billing_rules__is_active=True),
            )
        )
        if self.action == "retrieve":
            qs = qs.prefetch_related(
                Prefetch(
                    "billing_rules",
                    queryset=ServiceBillingRule.objects.select_related("created_by").order_by(
                        "sort_order", "id"
                    ),
                )
            )
        return qs

    def get_serializer_class(self):
        if self.action in ("partial_update", "update"):
            return ServiceOfferUpdateSerializer
        if self.action == "retrieve":
            return ServiceOfferDetailSerializer
        return ServiceOfferListSerializer

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not user_can_view_services(request.user):
            raise PermissionDenied("Accès réservé à la direction, l'admin ou la comptabilité.")

    @extend_schema(tags=("Services",), responses={200: ServiceOfferListSerializer(many=True)})
    def list(self, request, *args, **kwargs):
        return super().list(request, *args, **kwargs)

    @extend_schema(tags=("Services",), responses={200: ServiceOfferDetailSerializer})
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, *args, **kwargs)

    @extend_schema(tags=("Services",), responses={200: ServiceOfferDetailSerializer})
    def partial_update(self, request, *args, **kwargs):
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Modification réservée à la direction ou à l'administrateur.")
        response = super().partial_update(request, *args, **kwargs)
        if response.status_code < 400:
            offer = (
                ServiceOffer.objects.prefetch_related(
                    Prefetch(
                        "billing_rules",
                        queryset=ServiceBillingRule.objects.select_related(
                            "created_by"
                        ).order_by("sort_order", "id"),
                    )
                ).get(pk=self.get_object().pk)
            )
            log_audit(
                request=request,
                action="SERVICE_OFFER_UPDATED",
                entity_type="ServiceOffer",
                entity_id=offer.pk,
                metadata={"case_type": offer.case_type},
            )
            return Response(ServiceOfferDetailSerializer(offer).data)
        return response

    @extend_schema(tags=("Services",))
    @action(detail=False, methods=["get"], url_path="meta")
    def meta(self, request):
        return Response(
            {
                "formulas": [
                    {"value": c.value, "label": c.label} for c in BillingFormula
                ],
                "periodicities": [
                    {"value": c.value, "label": c.label} for c in BillingPeriodicity
                ],
            }
        )


class ServiceBillingRuleViewSet(
    mixins.CreateModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    http_method_names = ["post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        return ServiceBillingRule.objects.filter(
            service__case_type=self.kwargs["case_type"]
        ).select_related("service", "created_by")

    def get_serializer_class(self):
        if self.action in ("create", "partial_update", "update"):
            return ServiceBillingRuleWriteSerializer
        return ServiceBillingRuleSerializer

    def get_service(self) -> ServiceOffer:
        try:
            return ServiceOffer.objects.get(case_type=self.kwargs["case_type"])
        except ServiceOffer.DoesNotExist as exc:
            raise NotFound("Service introuvable.") from exc

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not user_can_manage_services(request.user):
            raise PermissionDenied(
                "Gestion des tarifs réservée à la direction ou à l'administrateur."
            )

    @extend_schema(tags=("Services",), responses={201: ServiceBillingRuleSerializer})
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        service = self.get_service()
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rule = ServiceBillingRule.objects.create(
            service=service,
            created_by=request.user,
            **serializer.validated_data,
        )
        log_audit(
            request=request,
            action="SERVICE_BILLING_RULE_CREATED",
            entity_type="ServiceBillingRule",
            entity_id=rule.pk,
            metadata={"case_type": service.case_type, "formula": rule.formula},
        )
        return Response(
            ServiceBillingRuleSerializer(rule).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(tags=("Services",), responses={200: ServiceBillingRuleSerializer})
    @transaction.atomic
    def partial_update(self, request, *args, **kwargs):
        response = super().partial_update(request, *args, **kwargs)
        if response.status_code < 400:
            rule = self.get_object()
            log_audit(
                request=request,
                action="SERVICE_BILLING_RULE_UPDATED",
                entity_type="ServiceBillingRule",
                entity_id=rule.pk,
                metadata={"case_type": rule.service.case_type},
            )
            return Response(ServiceBillingRuleSerializer(rule).data)
        return response

    @extend_schema(tags=("Services",))
    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        rule = self.get_object()
        case_type = rule.service.case_type
        rule_id = rule.pk
        rule.delete()
        log_audit(
            request=request,
            action="SERVICE_BILLING_RULE_DELETED",
            entity_type="ServiceBillingRule",
            entity_id=rule_id,
            metadata={"case_type": case_type},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
