from django.contrib import admin

from mandates.models import Mandate, MandateValidation


class MandateValidationInline(admin.TabularInline):
    model = MandateValidation
    extra = 0
    readonly_fields = ("validated_by", "decision", "comment", "created_at")


@admin.register(Mandate)
class MandateAdmin(admin.ModelAdmin):
    list_display = ("title", "case", "mandate_type", "created_at")
    list_filter = ("mandate_type",)
    search_fields = ("title", "case__reference")
    inlines = (MandateValidationInline,)
