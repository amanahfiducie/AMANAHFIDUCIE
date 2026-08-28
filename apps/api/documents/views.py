import mimetypes

from django.core import signing
from django.db import transaction
from django.http import FileResponse, Http404
from drf_spectacular.utils import extend_schema
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from cases.access import ensure_case_writable, get_accessible_case_or_404
from cases.models import TimelineEventType
from cases.services import record_timeline_event
from documents.models import (
    Document,
    DocumentAccessAction,
    DocumentShare,
    DocumentTag,
    DocumentVersion,
)
from documents.models import DocumentCategory
from documents.naming import (
    build_beneficiary_identity_filename,
    build_donor_identity_filename,
    build_guardian_identity_filename,
    build_mandate_document_filename,
)
from documents.serializers import (
    DocumentSerializer,
    DocumentShareSerializer,
    DocumentUploadSerializer,
    DownloadUrlResponseSerializer,
)
from documents.services import log_document_access
from documents.storage import resolve_download_url, resolve_preview_url


class DocumentUploadView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    @extend_schema(
        request=DocumentUploadSerializer,
        responses={201: DocumentSerializer},
        tags=("Documents",),
    )
    @transaction.atomic
    def post(self, request):
        serializer = DocumentUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        case = get_accessible_case_or_404(request.user, data["case_id"])
        ensure_case_writable(request.user, case)

        uploaded_file = data["file"]
        document_kind = data.get("_document_kind", "")
        identity_kind = data.get("identity_kind") or ""
        donor = data.get("_donor")
        beneficiary = data.get("_beneficiary")
        guardian = data.get("_guardian")
        mandate = data.get("_mandate")
        first_name = data.get("_donor_first_name", "")
        last_name = data.get("_donor_last_name", "")
        identity_subject = data.get("_identity_subject", "donor")

        stored_filename = uploaded_file.name
        if document_kind == "mandate":
            stored_filename = build_mandate_document_filename(
                data.get("_mandate_type", ""),
                data.get("_mandate_title", ""),
                data.get("_mandate_reference_number", ""),
                uploaded_file.name,
            )
            uploaded_file.name = stored_filename
        elif identity_kind:
            filename_builders = {
                "donor": build_donor_identity_filename,
                "beneficiary": build_beneficiary_identity_filename,
                "guardian": build_guardian_identity_filename,
            }
            build_filename = filename_builders.get(
                identity_subject, build_donor_identity_filename
            )
            stored_filename = build_filename(
                identity_kind,
                first_name,
                last_name,
                uploaded_file.name,
            )
            uploaded_file.name = stored_filename

        document = None
        if document_kind == "mandate":
            filters = {
                "case": case,
                "category": DocumentCategory.MANDATE,
                "deleted_at__isnull": True,
            }
            if mandate:
                filters["mandate"] = mandate
            else:
                filters["mandate__isnull"] = True
            document = (
                Document.objects.filter(**filters).order_by("-created_at").first()
            )
        elif identity_kind:
            filters = {
                "case": case,
                "identity_kind": identity_kind,
                "deleted_at__isnull": True,
            }
            if donor:
                filters["donor"] = donor
                filters["beneficiary__isnull"] = True
                filters["guardian__isnull"] = True
            elif beneficiary:
                filters["beneficiary"] = beneficiary
                filters["donor__isnull"] = True
                filters["guardian__isnull"] = True
            elif guardian:
                filters["guardian"] = guardian
                filters["donor__isnull"] = True
                filters["beneficiary__isnull"] = True
            else:
                filters["donor__isnull"] = True
                filters["beneficiary__isnull"] = True
                filters["guardian__isnull"] = True

            document = (
                Document.objects.filter(**filters).order_by("-created_at").first()
            )

        if document:
            next_version = (
                document.versions.order_by("-version_number").first().version_number + 1
                if document.versions.exists()
                else 1
            )
            document.title = data["title"]
            document.category = data["category"]
            document.description = data.get("description", "")
            document.save(
                update_fields=["title", "category", "description", "updated_at"]
            )
            version = DocumentVersion.objects.create(
                document=document,
                file=uploaded_file,
                original_filename=stored_filename,
                mime_type=uploaded_file.content_type
                or mimetypes.guess_type(stored_filename)[0]
                or "application/octet-stream",
                size_bytes=uploaded_file.size,
                version_number=next_version,
                uploaded_by=request.user,
            )
        else:
            document = Document.objects.create(
                case=case,
                donor=donor,
                beneficiary=beneficiary,
                guardian=guardian,
                mandate=mandate,
                identity_kind=identity_kind,
                category=data["category"],
                title=data["title"],
                description=data.get("description", ""),
                is_confidential=data.get("is_confidential", True),
                uploaded_by=request.user,
            )
            version = DocumentVersion.objects.create(
                document=document,
                file=uploaded_file,
                original_filename=stored_filename,
                mime_type=uploaded_file.content_type
                or mimetypes.guess_type(stored_filename)[0]
                or "application/octet-stream",
                size_bytes=uploaded_file.size,
                version_number=1,
                uploaded_by=request.user,
            )
        for slug in data.get("tag_slugs", []):
            tag, _created = DocumentTag.objects.get_or_create(
                slug=slug,
                defaults={"label": slug.replace("-", " ").title()},
            )
            document.tags.add(tag)

        log_document_access(
            request=request,
            document=document,
            version=version,
            action=DocumentAccessAction.UPLOAD,
        )
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.UPDATED,
            message=f"Document ajouté : {document.title}",
            actor=request.user,
            metadata={"document_id": document.pk},
        )
        return Response(
            DocumentSerializer(document).data,
            status=status.HTTP_201_CREATED,
        )


class CaseDocumentListView(APIView):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: DocumentSerializer(many=True)},
        tags=("Documents",),
    )
    def get(self, request, case_pk: int):
        case = get_accessible_case_or_404(request.user, case_pk)
        documents = (
            Document.objects.filter(case=case, deleted_at__isnull=True)
            .select_related("uploaded_by")
            .prefetch_related("tags", "versions")
        )
        return Response(DocumentSerializer(documents, many=True).data)


class DocumentViewSet(mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    authentication_classes = [JWTAuthentication]
    permission_classes = [IsAuthenticated]
    queryset = Document.objects.filter(deleted_at__isnull=True).select_related(
        "case", "uploaded_by"
    ).prefetch_related("tags", "versions")

    def get_object(self):
        document = super().get_object()
        get_accessible_case_or_404(self.request.user, document.case_id)
        return document

    @extend_schema(responses={200: DocumentSerializer}, tags=("Documents",))
    def retrieve(self, request, *args, **kwargs):
        document = self.get_object()
        version = document.current_version
        log_document_access(
            request=request,
            document=document,
            version=version,
            action=DocumentAccessAction.VIEW,
        )
        return Response(DocumentSerializer(document).data)

    @extend_schema(
        responses={200: DownloadUrlResponseSerializer},
        tags=("Documents",),
    )
    @action(detail=True, methods=["get"], url_path="download-url")
    def download_url(self, request, pk=None):
        document = self.get_object()
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
            metadata={"url_issued": True},
        )
        return Response(
            {
                "url": url,
                "expires_in": expires,
                "version_id": version.pk,
                "original_filename": version.original_filename,
            }
        )

    @extend_schema(
        responses={200: DownloadUrlResponseSerializer},
        tags=("Documents",),
    )
    @action(detail=True, methods=["get"], url_path="preview-url")
    def preview_url(self, request, pk=None):
        document = self.get_object()
        version = document.current_version
        if version is None or not version.file:
            return Response(
                {"detail": "Aucun fichier disponible."},
                status=status.HTTP_404_NOT_FOUND,
            )
        url, expires = resolve_preview_url(request, version)
        log_document_access(
            request=request,
            document=document,
            version=version,
            action=DocumentAccessAction.VIEW,
            metadata={"preview_url_issued": True},
        )
        return Response(
            {
                "url": url,
                "expires_in": expires,
                "version_id": version.pk,
                "original_filename": version.original_filename,
            }
        )

    @extend_schema(
        request=DocumentShareSerializer,
        responses={201: DocumentShareSerializer},
        tags=("Documents",),
    )
    @action(detail=True, methods=["post"])
    @transaction.atomic
    def share(self, request, pk=None):
        document = self.get_object()
        ensure_case_writable(request.user, document.case)
        serializer = DocumentShareSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        shared_with_user = None
        if data.get("shared_with_user_id"):
            from django.contrib.auth import get_user_model

            User = get_user_model()
            shared_with_user = User.objects.filter(pk=data["shared_with_user_id"]).first()
            if shared_with_user is None:
                return Response(
                    {"shared_with_user_id": "Utilisateur introuvable."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        share = DocumentShare.objects.create(
            document=document,
            shared_by=request.user,
            shared_with_user=shared_with_user,
            shared_with_email=data.get("shared_with_email", ""),
            message=data.get("message", ""),
        )
        log_document_access(
            request=request,
            document=document,
            version=document.current_version,
            action=DocumentAccessAction.SHARE,
            metadata={"share_id": share.pk},
        )
        return Response(
            {
                "id": share.pk,
                "shared_with_user_id": share.shared_with_user_id,
                "shared_with_email": share.shared_with_email,
                "message": share.message,
            },
            status=status.HTTP_201_CREATED,
        )


class SignedDocumentDownloadView(APIView):
    """Téléchargement via token signé (stockage local)."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        token = request.query_params.get("token")
        if not token:
            raise Http404()
        try:
            payload = signing.loads(token, salt="document-download", max_age=3600)
        except signing.BadSignature as exc:
            raise Http404() from exc

        try:
            version = DocumentVersion.objects.select_related("document__case").get(
                pk=payload["version_id"],
                document_id=payload["document_id"],
            )
        except DocumentVersion.DoesNotExist as exc:
            raise Http404() from exc

        if not version.file:
            raise Http404()

        inline = request.query_params.get("inline") == "1"
        response = FileResponse(
            version.file.open("rb"),
            as_attachment=not inline,
            filename=version.original_filename,
        )
        if version.mime_type:
            response["Content-Type"] = version.mime_type
        elif inline and version.original_filename.lower().endswith(".pdf"):
            response["Content-Type"] = "application/pdf"
        if inline:
            response["X-Frame-Options"] = "SAMEORIGIN"
        return response
