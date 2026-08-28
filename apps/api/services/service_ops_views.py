from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from cases.access import ensure_case_writable, get_accessible_case_or_404
from cases.models import CaseType, TimelineEventType
from cases.services import record_timeline_event
from services.invoice_pdf import (
    billing_charge_invoice_filename,
    period_invoice_filename,
    render_billing_charge_invoice_pdf,
    render_period_invoice_pdf,
)
from services.invoices import (
    cancel_invoice,
    create_or_replace_invoice,
    list_period_invoices,
    post_invoice,
    preview_case_invoice,
    serialize_invoice,
    update_invoice_draft,
)
from services.models import BillingInvoice, CaseBillingCharge, ServiceOffer
from services.periodic import generate_periodic_charges, list_service_billed_cases
from services.permissions import user_can_manage_services, user_can_view_services


class BillingInvoicesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Factures",))
    def get(self, request):
        if not user_can_view_services(request.user):
            raise PermissionDenied("Accès factures non autorisé.")
        return Response(
            {
                "results": list_period_invoices(
                    status=request.query_params.get("status") or None,
                    case_type=request.query_params.get("case_type") or None,
                )
            }
        )

    @extend_schema(tags=("Factures",))
    def post(self, request):
        """Enregistre le brouillon de facture (lignes sélectionnées / montants)."""
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Création réservée à la direction.")
        case_id = request.data.get("case_id")
        if not case_id:
            raise ValidationError({"case_id": "Dossier requis."})
        case = get_accessible_case_or_404(request.user, int(case_id))
        ensure_case_writable(request.user, case)
        lines = request.data.get("lines")
        if not isinstance(lines, list) or not lines:
            raise ValidationError({"lines": "Lignes de facturation requises."})
        invoice = create_or_replace_invoice(
            case=case,
            actor=request.user,
            period_label=request.data.get("period_label") or "",
            lines=lines,
            notes=request.data.get("notes") or "",
            label=request.data.get("label") or "",
        )
        log_audit(
            request=request,
            action="BILLING_INVOICE_SAVED",
            entity_type="BillingInvoice",
            entity_id=invoice.pk,
            case=case,
            metadata={"amount": str(invoice.amount), "period": invoice.period_label},
        )
        return Response(serialize_invoice(invoice), status=status.HTTP_201_CREATED)


class BillingInvoicePreviewView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Factures",))
    def get(self, request):
        if not user_can_view_services(request.user):
            raise PermissionDenied("Accès factures non autorisé.")
        case_id = request.query_params.get("case_id")
        if not case_id:
            raise ValidationError({"case_id": "Dossier requis."})
        case = get_accessible_case_or_404(request.user, int(case_id))
        period = request.query_params.get("period_label") or ""
        return Response(preview_case_invoice(case=case, period_label=period))


class BillingInvoiceDetailView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    def _get(self, request, invoice_pk: int) -> BillingInvoice:
        if not user_can_view_services(request.user):
            raise PermissionDenied("Accès factures non autorisé.")
        invoice = get_object_or_404(
            BillingInvoice.objects.select_related("case", "created_by").prefetch_related(
                "lines"
            ),
            pk=invoice_pk,
        )
        get_accessible_case_or_404(request.user, invoice.case_id)
        return invoice

    @extend_schema(tags=("Factures",))
    def get(self, request, invoice_pk: int):
        return Response(serialize_invoice(self._get(request, invoice_pk)))

    @extend_schema(tags=("Factures",))
    def patch(self, request, invoice_pk: int):
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Modification réservée à la direction.")
        invoice = self._get(request, invoice_pk)
        invoice = update_invoice_draft(
            invoice=invoice,
            lines=request.data.get("lines"),
            notes=request.data.get("notes") if "notes" in request.data else None,
            label=request.data.get("label") if "label" in request.data else None,
            period_label=(
                request.data.get("period_label")
                if "period_label" in request.data
                else None
            ),
        )
        log_audit(
            request=request,
            action="BILLING_INVOICE_UPDATED",
            entity_type="BillingInvoice",
            entity_id=invoice.pk,
            case=invoice.case,
            metadata={"amount": str(invoice.amount)},
        )
        return Response(serialize_invoice(invoice))


class BillingInvoicePostView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Factures",))
    def post(self, request, invoice_pk: int):
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Validation réservée à la direction.")
        invoice = get_object_or_404(
            BillingInvoice.objects.select_related("case").prefetch_related("lines"),
            pk=invoice_pk,
        )
        get_accessible_case_or_404(request.user, invoice.case_id)
        invoice = post_invoice(invoice=invoice, actor=request.user)
        record_timeline_event(
            case=invoice.case,
            event_type=TimelineEventType.UPDATED,
            message=(
                f"Facture {invoice.period_label} validée "
                f"({invoice.amount} {invoice.currency})"
            ),
            actor=request.user,
            metadata={"billing_invoice_id": invoice.pk},
        )
        log_audit(
            request=request,
            action="BILLING_INVOICE_POSTED",
            entity_type="BillingInvoice",
            entity_id=invoice.pk,
            case=invoice.case,
            metadata={"enterprise_movement_id": invoice.enterprise_movement_id},
        )
        return Response(serialize_invoice(invoice))


class BillingInvoiceCancelView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Factures",))
    def post(self, request, invoice_pk: int):
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Annulation réservée à la direction.")
        invoice = get_object_or_404(
            BillingInvoice.objects.select_related("case"),
            pk=invoice_pk,
        )
        get_accessible_case_or_404(request.user, invoice.case_id)
        cancel_invoice(invoice=invoice)
        log_audit(
            request=request,
            action="BILLING_INVOICE_CANCELLED",
            entity_type="BillingInvoice",
            entity_id=invoice.pk,
            case=invoice.case,
        )
        return Response(serialize_invoice(invoice))


class BillingInvoicePdfView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Factures",))
    def get(self, request, invoice_pk: int):
        if not user_can_view_services(request.user):
            raise PermissionDenied("Accès factures non autorisé.")
        invoice = get_object_or_404(
            BillingInvoice.objects.select_related("case").prefetch_related("lines"),
            pk=invoice_pk,
        )
        get_accessible_case_or_404(request.user, invoice.case_id)
        pdf_bytes = render_period_invoice_pdf(invoice)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="{period_invoice_filename(invoice)}"'
        )
        return response


class ServiceCasesView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Services",))
    def get(self, request, case_type: str):
        if not user_can_view_services(request.user):
            raise PermissionDenied("Accès réservé.")
        if case_type not in CaseType.values:
            raise ValidationError({"case_type": "Type de service invalide."})
        get_object_or_404(ServiceOffer, case_type=case_type)
        return Response(list_service_billed_cases(case_type))


class ServiceGeneratePeriodicBillingView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Services",))
    def post(self, request, case_type: str):
        if not user_can_manage_services(request.user):
            raise PermissionDenied("Génération réservée à la direction.")
        if case_type not in CaseType.values:
            raise ValidationError({"case_type": "Type de service invalide."})
        offer = get_object_or_404(ServiceOffer, case_type=case_type)
        rule_ids = request.data.get("rule_ids") or None
        case_ids = request.data.get("case_ids") or None
        result = generate_periodic_charges(
            case_type=case_type,
            actor=request.user,
            period_label=request.data.get("period_label") or "",
            rule_ids=[int(x) for x in rule_ids] if rule_ids else None,
            case_ids=[int(x) for x in case_ids] if case_ids else None,
            post=bool(request.data.get("post", False)),
            dry_run=bool(request.data.get("dry_run", False)),
        )
        log_audit(
            request=request,
            action="SERVICE_PERIODIC_BILLING_GENERATED",
            entity_type="ServiceOffer",
            entity_id=offer.pk,
            metadata={
                "case_type": case_type,
                "created": len(result.created),
                "skipped": len(result.skipped),
                "errors": len(result.errors),
            },
        )
        return Response(
            {
                "created": result.created,
                "skipped": result.skipped,
                "errors": result.errors,
                "summary": {
                    "created": len(result.created),
                    "skipped": len(result.skipped),
                    "errors": len(result.errors),
                },
            }
        )


class CaseBillingChargePdfView(APIView):
    """Compat PDF pour anciennes charges unitaires."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Factures",))
    def get(self, request, case_pk: int, charge_pk: int):
        if not user_can_view_services(request.user):
            raise PermissionDenied("Accès facturation non autorisé.")
        case = get_accessible_case_or_404(request.user, case_pk)
        charge = get_object_or_404(
            CaseBillingCharge.objects.select_related("case", "billing_rule"),
            pk=charge_pk,
            case=case,
        )
        pdf_bytes = render_billing_charge_invoice_pdf(charge)
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="{billing_charge_invoice_filename(charge)}"'
        )
        return response
