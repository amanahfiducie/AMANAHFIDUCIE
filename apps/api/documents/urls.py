from django.urls import path
from rest_framework.routers import SimpleRouter

from documents.views import (
    CaseDocumentListView,
    DocumentUploadView,
    DocumentViewSet,
    SignedDocumentDownloadView,
)

router = SimpleRouter()
router.register("documents", DocumentViewSet, basename="document")

urlpatterns = [
    path("documents/upload/", DocumentUploadView.as_view(), name="document-upload"),
    path(
        "cases/<int:case_pk>/documents/",
        CaseDocumentListView.as_view(),
        name="case-document-list",
    ),
    path(
        "documents/download/",
        SignedDocumentDownloadView.as_view(),
        name="document-signed-download",
    ),
    *router.urls,
]
