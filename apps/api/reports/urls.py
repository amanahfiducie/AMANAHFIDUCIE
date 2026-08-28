from django.urls import path

from reports.views import (
    CaseReportListView,
    PendingReportsListView,
    ReportGenerateView,
    ReportSignedDownloadView,
    ReportViewSet,
)

report_detail = ReportViewSet.as_view({"get": "retrieve"})
report_approve = ReportViewSet.as_view({"post": "approve"})
report_reject = ReportViewSet.as_view({"post": "reject"})
report_archive = ReportViewSet.as_view({"post": "archive"})
report_download_url = ReportViewSet.as_view({"get": "download_url"})

urlpatterns = [
    path("reports/generate/", ReportGenerateView.as_view(), name="report-generate"),
    path(
        "reports/pending-approval/",
        PendingReportsListView.as_view(),
        name="report-pending-approval",
    ),
    path(
        "cases/<int:case_pk>/reports/",
        CaseReportListView.as_view(),
        name="case-report-list",
    ),
    path("reports/<int:pk>/", report_detail, name="report-detail"),
    path("reports/<int:pk>/approve/", report_approve, name="report-approve"),
    path("reports/<int:pk>/archive/", report_archive, name="report-archive"),
    path("reports/<int:pk>/reject/", report_reject, name="report-reject"),
    path(
        "reports/<int:pk>/download-url/",
        report_download_url,
        name="report-download-url",
    ),
    path(
        "reports/download/",
        ReportSignedDownloadView.as_view(),
        name="report-signed-download",
    ),
]
