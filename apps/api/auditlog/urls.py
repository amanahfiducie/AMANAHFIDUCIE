from django.urls import path

from auditlog.views import AuditLogListView, CaseAuditLogListView

urlpatterns = [
    path("audit-logs/", AuditLogListView.as_view(), name="audit-log-list"),
    path(
        "cases/<int:case_pk>/audit-logs/",
        CaseAuditLogListView.as_view(),
        name="case-audit-log-list",
    ),
]
