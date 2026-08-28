from django.urls import path

from portals.views import (
    FamilyPortalCaseDetailView,
    FamilyPortalCaseDocumentsView,
    FamilyPortalCaseListView,
    FamilyPortalCaseReportsView,
    FamilyPortalDocumentDownloadView,
    FamilyPortalDocumentUploadView,
    FamilyPortalReportDownloadView,
    JudgePortalCaseDetailView,
    JudgePortalCaseDocumentsView,
    JudgePortalCaseListView,
    JudgePortalCaseReportsView,
    JudgePortalDocumentDownloadView,
    JudgePortalReportDownloadView,
    NotaryPortalCaseDetailView,
    NotaryPortalCaseDocumentsView,
    NotaryPortalCaseListView,
    NotaryPortalCaseReportsView,
    NotaryPortalDocumentDownloadView,
    NotaryPortalReportDownloadView,
)

family_patterns = [
    path("portal/cases/", FamilyPortalCaseListView.as_view(), name="portal-case-list"),
    path(
        "portal/cases/<int:case_pk>/",
        FamilyPortalCaseDetailView.as_view(),
        name="portal-case-detail",
    ),
    path(
        "portal/cases/<int:case_pk>/documents/",
        FamilyPortalCaseDocumentsView.as_view(),
        name="portal-case-documents",
    ),
    path(
        "portal/documents/upload/",
        FamilyPortalDocumentUploadView.as_view(),
        name="portal-document-upload",
    ),
    path(
        "portal/documents/<int:document_pk>/download-url/",
        FamilyPortalDocumentDownloadView.as_view(),
        name="portal-document-download",
    ),
    path(
        "portal/cases/<int:case_pk>/reports/",
        FamilyPortalCaseReportsView.as_view(),
        name="portal-case-reports",
    ),
    path(
        "portal/reports/<int:report_pk>/download-url/",
        FamilyPortalReportDownloadView.as_view(),
        name="portal-report-download",
    ),
]

notary_patterns = [
    path("notaire/cases/", NotaryPortalCaseListView.as_view(), name="notaire-case-list"),
    path(
        "notaire/cases/<int:case_pk>/",
        NotaryPortalCaseDetailView.as_view(),
        name="notaire-case-detail",
    ),
    path(
        "notaire/cases/<int:case_pk>/documents/",
        NotaryPortalCaseDocumentsView.as_view(),
        name="notaire-case-documents",
    ),
    path(
        "notaire/documents/<int:document_pk>/download-url/",
        NotaryPortalDocumentDownloadView.as_view(),
        name="notaire-document-download",
    ),
    path(
        "notaire/cases/<int:case_pk>/reports/",
        NotaryPortalCaseReportsView.as_view(),
        name="notaire-case-reports",
    ),
    path(
        "notaire/reports/<int:report_pk>/download-url/",
        NotaryPortalReportDownloadView.as_view(),
        name="notaire-report-download",
    ),
]

judge_patterns = [
    path("juge/cases/", JudgePortalCaseListView.as_view(), name="juge-case-list"),
    path(
        "juge/cases/<int:case_pk>/",
        JudgePortalCaseDetailView.as_view(),
        name="juge-case-detail",
    ),
    path(
        "juge/cases/<int:case_pk>/documents/",
        JudgePortalCaseDocumentsView.as_view(),
        name="juge-case-documents",
    ),
    path(
        "juge/documents/<int:document_pk>/download-url/",
        JudgePortalDocumentDownloadView.as_view(),
        name="juge-document-download",
    ),
    path(
        "juge/cases/<int:case_pk>/reports/",
        JudgePortalCaseReportsView.as_view(),
        name="juge-case-reports",
    ),
    path(
        "juge/reports/<int:report_pk>/download-url/",
        JudgePortalReportDownloadView.as_view(),
        name="juge-report-download",
    ),
]

urlpatterns = [*family_patterns, *notary_patterns, *judge_patterns]
