import mimetypes

from django.core import signing
from django.db import transaction
from django.http import FileResponse, Http404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status, viewsets
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from auditlog.services import log_audit
from cases.access import ensure_case_writable, get_accessible_case_or_404
from cases.models import TimelineEventType
from cases.services import record_timeline_event
from reports.models import (
    ApprovalDecision,
    Report,
    ReportApproval,
    ReportStatus,
    ReportTemplate,
)
from cases.permissions import user_can_access_case
from reports.permissions import (
    CanApproveReport,
    CanGenerateReport,
    user_can_download_report,
)
from reports.serializers import (
    DownloadUrlResponseSerializer,
    ReportApproveSerializer,
    ReportGenerateSerializer,
    ReportRejectSerializer,
    ReportSerializer,
)
from reports.services import create_report_draft, report_pdf_filename
from reports.storage import resolve_report_download_url


class PendingReportsListView(APIView):
    """Rapports en attente d'approbation (direction / juridique)."""

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanApproveReport]

    @extend_schema(
        responses={200: ReportSerializer(many=True)},
        tags=("Rapports",),
    )
    def get(self, request):
        from cases.permissions import user_is_internal

        if not user_is_internal(request.user):
            return Response(status=status.HTTP_403_FORBIDDEN)
        reports = (
            Report.objects.filter(
                deleted_at__isnull=True,
                status__in=(ReportStatus.DRAFT, ReportStatus.PENDING_APPROVAL),
            )
            .select_related("case", "generated_by", "generation_job")
            .order_by("-created_at")[:100]
        )
        accessible = [r for r in reports if user_can_access_case(request.user, r.case)]
        return Response(
            ReportSerializer(accessible, many=True, context={"request": request}).data
        )


class ReportGenerateView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated, CanGenerateReport]

    @extend_schema(
        request=ReportGenerateSerializer,
        responses={201: ReportSerializer},
        tags=("Rapports",),
    )
    @transaction.atomic
    def post(self, request):
        serializer = ReportGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        case = get_accessible_case_or_404(request.user, data["case_id"])
        ensure_case_writable(request.user, case)

        template = None
        if template_id := data.get("template_id"):
            template = ReportTemplate.objects.filter(
                pk=template_id,
                is_active=True,
            ).first()
            if template is None:
                return Response(
                    {"detail": "Modèle de rapport introuvable."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        report = create_report_draft(
            case=case,
            report_type=data["report_type"],
            title=data["title"],
            generated_by=request.user,
            template=template,
            period_start=data.get("period_start"),
            period_end=data.get("period_end"),
        )
        log_audit(
            request=request,
            action="REPORT_GENERATED",
            entity_type="Report",
            entity_id=report.pk,
            case=case,
            metadata={"report_type": report.report_type, "status": report.status},
        )
        return Response(
            ReportSerializer(report, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CaseReportListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: ReportSerializer(many=True)},
        tags=("Rapports",),
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        reports = (
            Report.objects.filter(case=case, deleted_at__isnull=True)
            .select_related(
                "generated_by",
                "approved_by",
                "template",
                "generation_job",
            )
            .order_by("-created_at")
        )
        return Response(
            ReportSerializer(reports, many=True, context={"request": request}).data
        )


class ReportViewSet(viewsets.GenericViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Report.objects.filter(deleted_at__isnull=True).select_related(
        "case",
        "generated_by",
        "approved_by",
        "template",
        "generation_job",
    )

    def get_object(self) -> Report:
        try:
            report = self.queryset.get(pk=self.kwargs["pk"])
        except Report.DoesNotExist as exc:
            raise NotFound("Rapport introuvable.") from exc
        get_accessible_case_or_404(self.request.user, report.case_id)
        return report

    @extend_schema(responses={200: ReportSerializer}, tags=("Rapports",))
    def retrieve(self, request, pk=None):
        report = self.get_object()
        return Response(ReportSerializer(report, context={"request": request}).data)

    @extend_schema(
        request=ReportApproveSerializer,
        responses={200: ReportSerializer},
        tags=("Rapports",),
    )
    @transaction.atomic
    def approve(self, request, pk=None):
        if not CanApproveReport().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)
        report = self.get_object()
        if report.status not in (ReportStatus.DRAFT, ReportStatus.PENDING_APPROVAL):
            return Response(
                {"detail": "Seuls les brouillons peuvent être approuvés."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not report.file:
            return Response(
                {"detail": "Le fichier du rapport est manquant."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body = ReportApproveSerializer(data=request.data)
        body.is_valid(raise_exception=True)

        report.status = ReportStatus.APPROVED
        report.approved_by = request.user
        report.approved_at = timezone.now()
        report.save(update_fields=["status", "approved_by", "approved_at", "updated_at"])

        ReportApproval.objects.create(
            report=report,
            decided_by=request.user,
            decision=ApprovalDecision.APPROVED,
            comment=body.validated_data.get("comment", ""),
        )
        record_timeline_event(
            case=report.case,
            event_type=TimelineEventType.UPDATED,
            message=f"Rapport approuvé : {report.title}",
            actor=request.user,
            metadata={"report_id": report.pk},
        )
        log_audit(
            request=request,
            action="REPORT_APPROVED",
            entity_type="Report",
            entity_id=report.pk,
            case=report.case,
        )
        from notifications.services import notify_report_approved

        notify_report_approved(report)
        return Response(ReportSerializer(report, context={"request": request}).data)

    @extend_schema(
        request=ReportRejectSerializer,
        responses={200: ReportSerializer},
        tags=("Rapports",),
    )
    @transaction.atomic
    def reject(self, request, pk=None):
        if not CanApproveReport().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)
        report = self.get_object()
        if report.status not in (ReportStatus.DRAFT, ReportStatus.PENDING_APPROVAL):
            return Response(
                {"detail": "Ce rapport ne peut plus être rejeté."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        body = ReportRejectSerializer(data=request.data)
        body.is_valid(raise_exception=True)

        report.status = ReportStatus.REJECTED
        report.save(update_fields=["status", "updated_at"])
        ReportApproval.objects.create(
            report=report,
            decided_by=request.user,
            decision=ApprovalDecision.REJECTED,
            comment=body.validated_data.get("comment", ""),
        )
        log_audit(
            request=request,
            action="REPORT_REJECTED",
            entity_type="Report",
            entity_id=report.pk,
            case=report.case,
        )
        return Response(ReportSerializer(report, context={"request": request}).data)

    @extend_schema(responses={200: ReportSerializer}, tags=("Rapports",))
    @transaction.atomic
    def archive(self, request, pk=None):
        if not CanApproveReport().has_permission(request, self):
            return Response(status=status.HTTP_403_FORBIDDEN)
        report = self.get_object()
        if report.status != ReportStatus.APPROVED:
            return Response(
                {"detail": "Seuls les rapports approuvés peuvent être archivés."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        report.status = ReportStatus.ARCHIVED
        report.archived_at = timezone.now()
        report.save(update_fields=["status", "archived_at", "updated_at"])
        log_audit(
            request=request,
            action="REPORT_ARCHIVED",
            entity_type="Report",
            entity_id=report.pk,
            case=report.case,
        )
        return Response(ReportSerializer(report, context={"request": request}).data)

    @extend_schema(
        responses={200: DownloadUrlResponseSerializer},
        tags=("Rapports",),
    )
    def download_url(self, request, pk=None):
        report = self.get_object()
        if not user_can_download_report(request.user, report):
            return Response(
                {"detail": "Rapport non disponible au téléchargement."},
                status=status.HTTP_403_FORBIDDEN,
            )
        # Garantit un PDF A4 premium (cartes, graphiques, arbres) à chaque aperçu
        try:
            from reports.pdf_brand import PDF_ENGINE
            from reports.pdf_premium import refresh_report_pdf_file

            snap = report.metadata_json if isinstance(report.metadata_json, dict) else {}
            if snap.get("version") and snap.get("pdf_engine") != PDF_ENGINE:
                refresh_report_pdf_file(report)
                report.refresh_from_db()
            elif snap.get("version") and not report.file:
                refresh_report_pdf_file(report)
                report.refresh_from_db()
        except Exception:  # noqa: BLE001 — ne bloque pas le téléchargement
            pass

        url, expires = resolve_report_download_url(request, report)
        log_audit(
            request=request,
            action="REPORT_DOWNLOAD_URL",
            entity_type="Report",
            entity_id=report.pk,
            case=report.case,
        )
        filename = report_pdf_filename(report)
        return Response(
            {
                "url": url,
                "expires_in": expires,
                "report_id": report.pk,
                "original_filename": filename,
            }
        )


class ReportSignedDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get("token")
        if not token:
            raise Http404
        try:
            payload = signing.loads(token, salt="report-download", max_age=3600)
        except signing.BadSignature as exc:
            raise Http404 from exc

        try:
            report = Report.objects.get(
                pk=payload["report_id"],
                deleted_at__isnull=True,
            )
        except Report.DoesNotExist as exc:
            raise Http404 from exc

        if not report.file:
            raise Http404

        from reports.services import report_pdf_filename

        content_type = mimetypes.guess_type(report.file.name)[0] or "application/pdf"
        return FileResponse(
            report.file.open("rb"),
            content_type=content_type,
            as_attachment=True,
            filename=report_pdf_filename(report),
        )
