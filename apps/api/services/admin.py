from django.contrib import admin

from services.models import (
    BillingInvoice,
    BillingInvoiceLine,
    CaseBillingCharge,
    ServiceBillingRule,
    ServiceOffer,
)


class ServiceBillingRuleInline(admin.TabularInline):
    model = ServiceBillingRule
    extra = 0
    fields = (
        "formula",
        "label",
        "rate_percent",
        "fixed_amount",
        "periodicity",
        "is_active",
        "sort_order",
    )


@admin.register(ServiceOffer)
class ServiceOfferAdmin(admin.ModelAdmin):
    list_display = ("name", "case_type", "is_active", "sort_order", "updated_at")
    list_filter = ("is_active", "case_type")
    search_fields = ("name", "description")
    inlines = [ServiceBillingRuleInline]


@admin.register(ServiceBillingRule)
class ServiceBillingRuleAdmin(admin.ModelAdmin):
    list_display = (
        "label",
        "service",
        "formula",
        "rate_percent",
        "fixed_amount",
        "periodicity",
        "is_active",
    )
    list_filter = ("formula", "periodicity", "is_active", "service")
    search_fields = ("label", "description")


@admin.register(CaseBillingCharge)
class CaseBillingChargeAdmin(admin.ModelAdmin):
    list_display = (
        "label",
        "case",
        "formula",
        "amount",
        "status",
        "movement_date",
        "created_at",
    )
    list_filter = ("status", "formula")
    search_fields = ("label", "case__reference")
    raw_id_fields = ("case", "billing_rule", "enterprise_movement", "created_by")


class BillingInvoiceLineInline(admin.TabularInline):
    model = BillingInvoiceLine
    extra = 0


@admin.register(BillingInvoice)
class BillingInvoiceAdmin(admin.ModelAdmin):
    list_display = (
        "case",
        "period_label",
        "amount",
        "status",
        "movement_date",
        "created_at",
    )
    list_filter = ("status",)
    search_fields = ("case__reference", "label", "period_label")
    inlines = [BillingInvoiceLineInline]
    raw_id_fields = ("case", "enterprise_movement", "created_by")
