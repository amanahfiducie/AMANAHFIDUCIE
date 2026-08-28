from rest_framework.permissions import BasePermission

from accounts.models import UserRole
from cases.permissions import get_user_roles, user_can_access_case, user_can_write_case
from reports.models import Report, ReportStatus

REPORT_GENERATE_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.AGENT_FIDUCIAIRE,
    UserRole.COMPTABLE_FIDUCIAIRE,
}

REPORT_APPROVE_ROLES = {
    UserRole.SUPER_ADMIN,
    UserRole.DIRECTION,
    UserRole.JURIDIQUE_CONFORMITE,
}


def user_can_generate_reports(user) -> bool:
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & REPORT_GENERATE_ROLES)


def user_can_approve_reports(user) -> bool:
    if user.is_superuser:
        return True
    return bool(get_user_roles(user) & REPORT_APPROVE_ROLES)


def user_can_download_report(user, report: Report) -> bool:
    if not user_can_access_case(user, report.case):
        return False
    if user_can_generate_reports(user):
        return bool(report.file)
    return report.status in (ReportStatus.APPROVED, ReportStatus.ARCHIVED) and bool(
        report.file
    )


class CanGenerateReport(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and user_can_generate_reports(request.user)


class CanApproveReport(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and user_can_approve_reports(request.user)
