from django.contrib import admin

from finance.models import (
    EnterpriseAccount,
    EnterpriseJustificatif,
    EnterpriseMovement,
    Fee,
    FinancialMovement,
    FiduciaryAccount,
    MovementCategory,
    Reconciliation,
)


class FinancialMovementInline(admin.TabularInline):
    model = FinancialMovement
    extra = 0
    fields = ("movement_type", "amount", "movement_date", "status")


@admin.register(FiduciaryAccount)
class FiduciaryAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "case", "currency", "opening_balance", "is_active")
    list_filter = ("is_active", "currency")
    search_fields = ("name", "account_number", "case__reference")
    inlines = (FinancialMovementInline,)


@admin.register(FinancialMovement)
class FinancialMovementAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "account",
        "movement_type",
        "amount",
        "movement_date",
        "status",
    )
    list_filter = ("movement_type", "status")
    search_fields = ("reference", "description", "account__name")


admin.site.register(MovementCategory)
admin.site.register(Fee)
admin.site.register(Reconciliation)


@admin.register(EnterpriseAccount)
class EnterpriseAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "account_type", "currency", "opening_balance", "is_active")
    list_filter = ("account_type", "is_active", "currency")
    search_fields = ("name", "account_number")


@admin.register(EnterpriseMovement)
class EnterpriseMovementAdmin(admin.ModelAdmin):
    list_display = (
        "reference",
        "account",
        "movement_type",
        "amount",
        "movement_date",
        "status",
    )
    list_filter = ("movement_type", "status")
    search_fields = ("reference", "description", "account__name")


@admin.register(EnterpriseJustificatif)
class EnterpriseJustificatifAdmin(admin.ModelAdmin):
    list_display = ("title", "movement", "original_filename", "uploaded_by", "created_at")
    search_fields = ("title", "original_filename")
