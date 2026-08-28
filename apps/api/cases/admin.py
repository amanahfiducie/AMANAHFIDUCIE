from django.contrib import admin

from cases.models import (
    CaseNote,
    CaseObservation,
    CaseStakeholder,
    CaseTimelineEvent,
    FiduciaryCase,
)


class CaseStakeholderInline(admin.TabularInline):
    model = CaseStakeholder
    extra = 0
    autocomplete_fields = ("user",)


class CaseTimelineInline(admin.TabularInline):
    model = CaseTimelineEvent
    extra = 0
    readonly_fields = ("event_type", "actor", "message", "metadata_json", "created_at")
    can_delete = False


@admin.register(FiduciaryCase)
class FiduciaryCaseAdmin(admin.ModelAdmin):
    list_display = ("reference", "title", "status", "created_by", "assigned_to", "created_at")
    list_filter = ("status",)
    search_fields = ("reference", "title")
    readonly_fields = ("reference", "created_at", "updated_at")
    inlines = (CaseStakeholderInline, CaseTimelineInline)


@admin.register(CaseNote)
class CaseNoteAdmin(admin.ModelAdmin):
    list_display = ("case", "author", "created_at")
    search_fields = ("case__reference", "body")


@admin.register(CaseObservation)
class CaseObservationAdmin(admin.ModelAdmin):
    list_display = ("case", "kind", "status", "author", "created_at")
    list_filter = ("kind", "status")
    search_fields = ("case__reference", "body")
    readonly_fields = ("shared_at", "reviewed_at", "created_at", "updated_at")
