from django.contrib import admin

from auditlog.models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = (
        "timestamp",
        "action",
        "entity_type",
        "entity_id",
        "actor",
        "case",
    )
    list_filter = ("action", "entity_type")
    search_fields = ("entity_id", "actor__username")
    readonly_fields = (
        "timestamp",
        "actor",
        "actor_role",
        "action",
        "entity_type",
        "entity_id",
        "case",
        "ip_address",
        "user_agent",
        "metadata_json",
    )
