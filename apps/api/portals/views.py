import mimetypes

from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from assets.services import (
    build_case_patrimony_evolution,
    get_case_patrimony_summary,
)
from auditlog.services import log_audit
from cases.models import TimelineEventType
from cases.services import record_timeline_event
from documents.models import Document, DocumentAccessAction, DocumentVersion
from documents.serializers import DocumentUploadSerializer
from documents.services import log_document_access
from documents.storage import resolve_download_url
from portals.access import (
    get_accessible_portal_case_or_404,
    get_portal_documents_queryset,
    get_stakeholder_cases_queryset,
)
from portals.permissions import user_can_access_portal
from reports.models import Report, ReportStatus
from reports.permissions import user_can_download_report
from reports.storage import resolve_report_download_url
from portals.serializers import (
    PortalCaseDetailSerializer,
    PortalCaseListSerializer,
    PortalDocumentSerializer,
    PortalReportSerializer,
)


class PortalPermissionMixin:
    portal_kind: str = "portal"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not user_can_access_portal(request.user, self.portal_kind):
            raise PermissionDenied("Accès réservé à ce portail externe.")


def _serialize_case_list(case) -> dict:
    return {
        "id": case.pk,
        "reference": case.reference,
        "title": case.title,
        "status": case.status,
        "case_type": case.case_type,
        "case_type_label": case.get_case_type_display(),
        "updated_at": case.updated_at,
    }


def _serialize_patrimony(case) -> dict:
    summary = get_case_patrimony_summary(case)
    return {
        "asset_count": summary["asset_count"],
        "total_estimated_value": summary["total_estimated_value"],
        "currency": summary.get("currency", "XOF"),
    }


def _serialize_case_detail(case, portal_kind: str) -> dict:
    summary = _serialize_patrimony(case)
    data = {
        "id": case.pk,
        "reference": case.reference,
        "title": case.title,
        "status": case.status,
        "case_type": case.case_type,
        "case_type_label": case.get_case_type_display(),
        "description": case.description,
        "updated_at": case.updated_at,
        "patrimony_summary": summary,
        "patrimony_evolution": build_case_patrimony_evolution(case),
    }
    if portal_kind in ("notaire", "juge"):
        data["mandates"] = list(
            case.mandates.values(
                "id",
                "mandate_type",
                "title",
                "reference_number",
                "issuing_authority",
                "signed_at",
                "effective_from",
                "effective_to",
            )
        )
    if portal_kind == "portal":
        data["beneficiaries"] = list(
            case.beneficiaries.values(
                "id",
                "first_name",
                "last_name",
                "date_of_birth",
                "nationality",
                "is_minor",
            )
        )
    return data


class PortalCaseListView(PortalPermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PortalCaseListSerializer(many=True)}, tags=("Portail",))
    def get(self, request):
        cases = get_stakeholder_cases_queryset(request.user).order_by("-updated_at")
        payload = [_serialize_case_list(c) for c in cases]
        return Response(payload)


class PortalCaseDetailView(PortalPermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PortalCaseDetailSerializer}, tags=("Portail",))
    def get(self, request, case_pk: int):
        case = get_accessible_portal_case_or_404(request.user, case_pk)
        case = (
            get_stakeholder_cases_queryset(request.user)
            .prefetch_related("mandates", "beneficiaries")
            .get(pk=case.pk)
        )
        return Response(_serialize_case_detail(case, self.portal_kind))


class PortalCaseDocumentsView(PortalPermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PortalDocumentSerializer(many=True)}, tags=("Portail",))
    def get(self, request, case_pk: int):
        case = get_accessible_portal_case_or_404(request.user, case_pk)
        documents = get_portal_documents_queryset(request.user, case, self.portal_kind)
        payload = [
            {
                "id": doc.pk,
                "title": doc.title,
                "category": doc.category,
                "created_at": doc.created_at,
                "is_shared": doc.shares.filter(shared_with_user=request.user).exists(),
            }
            for doc in documents
        ]
        return Response(payload)


class PortalDocumentDownloadView(PortalPermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Portail",))
    def get(self, request, document_pk: int):
        try:
            document = Document.objects.select_related("case").get(
                pk=document_pk,
                deleted_at__isnull=True,
            )
        except Document.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        case = get_accessible_portal_case_or_404(request.user, document.case_id)
        allowed = get_portal_documents_queryset(request.user, case, self.portal_kind)
        if not allowed.filter(pk=document_pk).exists():
            raise PermissionDenied("Document non accessible.")

        version = document.current_version
        if version is None or not version.file:
            return Response(
                {"detail": "Aucun fichier disponible."},
                status=status.HTTP_404_NOT_FOUND,
            )
        url, expires = resolve_download_url(request, version)
        log_document_access(
            request=request,
            document=document,
            version=version,
            action=DocumentAccessAction.DOWNLOAD,
            metadata={"portal": self.portal_kind},
        )
        return Response(
            {
                "url": url,
                "expires_in": expires,
                "original_filename": version.original_filename,
            }
        )


class PortalDocumentUploadView(PortalPermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]
    portal_kind = "portal"

    @extend_schema(request=DocumentUploadSerializer, tags=("Portail",))
    @transaction.atomic
    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        case = get_accessible_portal_case_or_404(request.user, data["case_id"])

        uploaded_file = data["file"]
        document = Document.objects.create(
            case=case,
            category=data["category"],
            title=data["title"],
            description=data.get("description", ""),
            is_confidential=True,
            uploaded_by=request.user,
        )
        version = DocumentVersion.objects.create(
            document=document,
            file=uploaded_file,
            original_filename=uploaded_file.name,
            mime_type=uploaded_file.content_type
            or mimetypes.guess_type(uploaded_file.name)[0]
            or "application/octet-stream",
            size_bytes=uploaded_file.size,
            version_number=1,
            uploaded_by=request.user,
        )
        log_document_access(
            request=request,
            document=document,
            version=version,
            action=DocumentAccessAction.UPLOAD,
            metadata={"portal": self.portal_kind},
        )
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Pièce déposée (portail) : {document.title}",
            actor=request.user,
            metadata={"document_id": document.pk},
        )
        log_audit(
            request=request,
            action="PORTAL_DOCUMENT_UPLOADED",
            entity_type="Document",
            entity_id=document.pk,
            case=case,
            metadata={"portal": self.portal_kind},
        )
        return Response(
            {
                "id": document.pk,
                "title": document.title,
                "category": document.category,
            },
            status=status.HTTP_201_CREATED,
        )


class PortalCaseReportsView(PortalPermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={200: PortalReportSerializer(many=True)}, tags=("Portail",))
    def get(self, request, case_pk: int):
        case = get_accessible_portal_case_or_404(request.user, case_pk)
        reports = Report.objects.filter(
            case=case,
            deleted_at__isnull=True,
            status__in=(ReportStatus.APPROVED, ReportStatus.ARCHIVED),
        ).order_by("-approved_at", "-created_at")
        payload = [
            {
                "id": r.pk,
                "title": r.title,
                "report_type": r.report_type,
                "report_type_label": r.get_report_type_display(),
                "status": r.status,
                "approved_at": r.approved_at,
                "created_at": r.created_at,
                "metadata_json": r.metadata_json if isinstance(r.metadata_json, dict) else {},
            }
            for r in reports
        ]
        return Response(payload)


class PortalReportDownloadView(PortalPermissionMixin, APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(tags=("Portail",))
    def get(self, request, report_pk: int):
        try:
            report = Report.objects.select_related("case").get(
                pk=report_pk,
                deleted_at__isnull=True,
            )
        except Report.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        get_accessible_portal_case_or_404(request.user, report.case_id)
        if not user_can_download_report(request.user, report):
            raise PermissionDenied("Rapport non accessible.")
        url, expires = resolve_report_download_url(request, report)
        filename = report.file.name.rsplit("/", 1)[-1] if report.file else "rapport.pdf"
        return Response(
            {
                "url": url,
                "expires_in": expires,
                "original_filename": filename,
            }
        )


class FamilyPortalCaseListView(PortalCaseListView):
    portal_kind = "portal"


class FamilyPortalCaseDetailView(PortalCaseDetailView):
    portal_kind = "portal"


class FamilyPortalCaseDocumentsView(PortalCaseDocumentsView):
    portal_kind = "portal"


class FamilyPortalDocumentDownloadView(PortalDocumentDownloadView):
    portal_kind = "portal"


class FamilyPortalDocumentUploadView(PortalDocumentUploadView):
    portal_kind = "portal"


class FamilyPortalCaseReportsView(PortalCaseReportsView):
    portal_kind = "portal"


class FamilyPortalReportDownloadView(PortalReportDownloadView):
    portal_kind = "portal"


class NotaryPortalCaseListView(PortalCaseListView):
    portal_kind = "notaire"


class NotaryPortalCaseDetailView(PortalCaseDetailView):
    portal_kind = "notaire"


class NotaryPortalCaseDocumentsView(PortalCaseDocumentsView):
    portal_kind = "notaire"


class NotaryPortalDocumentDownloadView(PortalDocumentDownloadView):
    portal_kind = "notaire"


class NotaryPortalCaseReportsView(PortalCaseReportsView):
    portal_kind = "notaire"


class NotaryPortalReportDownloadView(PortalReportDownloadView):
    portal_kind = "notaire"


class JudgePortalCaseListView(PortalCaseListView):
    portal_kind = "juge"


class JudgePortalCaseDetailView(PortalCaseDetailView):
    portal_kind = "juge"


class JudgePortalCaseDocumentsView(PortalCaseDocumentsView):
    portal_kind = "juge"


class JudgePortalDocumentDownloadView(PortalDocumentDownloadView):
    portal_kind = "juge"


class JudgePortalCaseReportsView(PortalCaseReportsView):
    portal_kind = "juge"


class JudgePortalReportDownloadView(PortalReportDownloadView):
    portal_kind = "juge"
