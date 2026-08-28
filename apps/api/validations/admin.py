from django.contrib import admin

from validations.models import (
    ValidationComment,
    ValidationDecision,
    ValidationRequest,
    ValidationStep,
)


class ValidationStepInline(admin.TabularInline):
    model = ValidationStep
    extra = 0


class ValidationCommentInline(admin.TabularInline):
    model = ValidationComment
    extra = 0


@admin.register(ValidationRequest)
class ValidationRequestAdmin(admin.ModelAdmin):
    list_display = ("title", "case", "validation_type", "status", "created_at")
    list_filter = ("validation_type", "status", "subject_type")
    search_fields = ("title", "case__reference")
    inlines = (ValidationStepInline, ValidationCommentInline)


admin.site.register(ValidationDecision)
