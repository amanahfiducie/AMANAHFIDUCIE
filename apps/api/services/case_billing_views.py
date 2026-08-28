from datetime import date
from decimal import Decimal, InvalidOperation

from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from cases.access import ensure_case_writable, get_accessible_case_or_404
from cases.models import TimelineEventType
from cases.services import record_timeline_event
from services.billing import (
    build_case_billing_overview,
    cancel_case_billing_charge,
    compute_charge_from_rule,
    create_case_billing_charge,
    post_case_billing_charge,
)
from services.models import CaseBillingCharge, ServiceBillingRule
from services.permissions import user_can_manage_services, user_can_view_services


def _parse_optional_decimal(value, field: str) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValidationError({field: "Montant invalide."}) from exc


def _parse_optional_date(value) -> date | None:
    if value is None or value == "":
        return None
    if isinstance(value, date):
        return value
    parsed = parse_date(str(value))
    if parsed is None:
        raise ValidationError({"movement_date": "Date invalide (AAAA-MM-JJ)."})
    return parsed


class CaseBillingOverviewView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Facturation dossier",))
    def get(self, request, case_pk: int):
        if not user_can_view_services(request.user):
            raise PermissionDenied("Accès facturation non autorisé.")
        case = get_accessible_case_or_404(request.user, case_pk)
        return Response(build_case_billing_overview(case))


class CaseBillingPreviewView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Facturation dossier",))
    def post(self, request, case_pk: int):
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Prévisualisation réservée à la direction.")
        case = get_accessible_case_or_404(request.user, case_pk)
        rule_id = request.data.get("billing_rule_id")
        rule = get_object_or_404(ServiceBillingRule, pk=rule_id)
        computed = compute_charge_from_rule(
            case=case,
            rule=rule,
            period_label=request.data.get("period_label") or "",
            base_override=_parse_optional_decimal(
                request.data.get("base_amount"), "base_amount"
            ),
            rate_override=_parse_optional_decimal(
                request.data.get("rate_percent"), "rate_percent"
            ),
            fixed_override=_parse_optional_decimal(
                request.data.get("fixed_amount"), "fixed_amount"
            ),
        )
        return Response(
            {
                "formula": computed.formula,
                "label": computed.label,
                "amount": str(computed.amount),
                "currency": computed.currency,
                "base_amount": (
                    str(computed.base_amount)
                    if computed.base_amount is not None
                    else None
                ),
                "rate_percent": (
                    str(computed.rate_percent)
                    if computed.rate_percent is not None
                    else None
                ),
                "period_label": computed.period_label,
                "notes": computed.notes,
            }
        )


class CaseBillingChargeCreateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Facturation dossier",))
    def post(self, request, case_pk: int):
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Création de charge réservée à la direction.")
        case = get_accessible_case_or_404(request.user, case_pk)
        ensure_case_writable(request.user, case)
        rule = get_object_or_404(
            ServiceBillingRule,
            pk=request.data.get("billing_rule_id"),
        )
        charge = create_case_billing_charge(
            case=case,
            rule=rule,
            actor=request.user,
            period_label=request.data.get("period_label") or "",
            movement_date=_parse_optional_date(request.data.get("movement_date")),
            base_override=_parse_optional_decimal(
                request.data.get("base_amount"), "base_amount"
            ),
            rate_override=_parse_optional_decimal(
                request.data.get("rate_percent"), "rate_percent"
            ),
            fixed_override=_parse_optional_decimal(
                request.data.get("fixed_amount"), "fixed_amount"
            ),
            notes=request.data.get("notes") or "",
        )
        auto_post = bool(request.data.get("post", False))
        if auto_post:
            charge = post_case_billing_charge(charge=charge, actor=request.user)
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Facturation : {charge.label} ({charge.amount} {charge.currency})",
            actor=request.user,
            metadata={"billing_charge_id": charge.pk, "status": charge.status},
        )
        log_audit(
            request=request,
            action="CASE_BILLING_CHARGE_CREATED",
            entity_type="CaseBillingCharge",
            entity_id=charge.pk,
            case=case,
            metadata={"amount": str(charge.amount), "status": charge.status},
        )
        return Response(
            build_case_billing_overview(case),
            status=status.HTTP_201_CREATED,
        )


class CaseBillingChargePostView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Facturation dossier",))
    def post(self, request, case_pk: int, charge_pk: int):
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Comptabilisation réservée à la direction.")
        case = get_accessible_case_or_404(request.user, case_pk)
        charge = get_object_or_404(CaseBillingCharge, pk=charge_pk, case=case)
        charge = post_case_billing_charge(charge=charge, actor=request.user)
        log_audit(
            request=request,
            action="CASE_BILLING_CHARGE_POSTED",
            entity_type="CaseBillingCharge",
            entity_id=charge.pk,
            case=case,
            metadata={"enterprise_movement_id": charge.enterprise_movement_id},
        )
        return Response(build_case_billing_overview(case))


class CaseBillingChargeCancelView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Facturation dossier",))
    def post(self, request, case_pk: int, charge_pk: int):
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Annulation réservée à la direction.")
        case = get_accessible_case_or_404(request.user, case_pk)
        charge = get_object_or_404(CaseBillingCharge, pk=charge_pk, case=case)
        cancel_case_billing_charge(charge=charge)
        log_audit(
            request=request,
            action="CASE_BILLING_CHARGE_CANCELLED",
            entity_type="CaseBillingCharge",
            entity_id=charge.pk,
            case=case,
        )
        return Response(build_case_billing_overview(case))
