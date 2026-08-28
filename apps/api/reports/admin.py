from django.contrib import admin

from reports.models import (
    Report,
    ReportApproval,
    ReportGenerationJob,
    ReportTemplate,
)


@admin.register(ReportTemplate)
class ReportTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "report_type", "is_active")
    list_filter = ("report_type", "is_active")
    search_fields = ("name", "slug")


class ReportGenerationJobInline(admin.StackedInline):
    model = ReportGenerationJob
    extra = 0
    readonly_fields = ("status", "error_message", "started_at", "finished_at", "created_at")


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    list_display = ("title", "case", "report_type", "status", "created_at")
    list_filter = ("report_type", "status")
    search_fields = ("title", "case__reference")
    inlines = [ReportGenerationJobInline]


@admin.register(ReportApproval)
class ReportApprovalAdmin(admin.ModelAdmin):
    list_display = ("report", "decision", "decided_by", "created_at")
    list_filter = ("decision",)
