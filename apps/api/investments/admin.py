from django.contrib import admin

from .models import (
    AmanahManagementProfile,
    CaseInvestmentPolicy,
    EnvelopeContribution,
    Investment,
    InvestmentAssetClass,
    InvestmentParticipant,
    InvestmentValuation,
    PatrimonyInvestmentCategory,
)


@admin.register(InvestmentAssetClass)
class InvestmentAssetClassAdmin(admin.ModelAdmin):
    list_display = ("label", "slug", "weight_min", "weight_max", "is_active", "sort_order")
    list_filter = ("is_active",)
    search_fields = ("label", "slug")
    prepopulated_fields = {"slug": ("label",)}


@admin.register(PatrimonyInvestmentCategory)
class PatrimonyInvestmentCategoryAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "label",
        "target_yield_min",
        "target_yield_max",
        "is_active",
    )
    list_filter = ("is_active", "code")
    search_fields = ("label", "code")


@admin.register(AmanahManagementProfile)
class AmanahManagementProfileAdmin(admin.ModelAdmin):
    list_display = (
        "label",
        "slug",
        "linked_category",
        "target_yield_min",
        "target_yield_max",
        "is_active",
    )
    list_filter = ("is_active",)
    search_fields = ("label", "slug")
    prepopulated_fields = {"slug": ("label",)}


@admin.register(CaseInvestmentPolicy)
class CaseInvestmentPolicyAdmin(admin.ModelAdmin):
    list_display = (
        "case",
        "patrimony_category",
        "management_profile",
        "sharia_compliance_score",
        "updated_at",
    )
    list_filter = ("patrimony_category", "management_profile")
    search_fields = ("case__reference", "case__title")
    raw_id_fields = ("case",)


@admin.register(InvestmentParticipant)
class InvestmentParticipantAdmin(admin.ModelAdmin):
    list_display = (
        "investment",
        "beneficiary",
        "patrimony_category",
        "allocated_amount",
        "share_percent",
    )
    list_filter = ("patrimony_category",)
    raw_id_fields = ("investment", "beneficiary")


@admin.register(InvestmentValuation)
class InvestmentValuationAdmin(admin.ModelAdmin):
    list_display = ("investment", "value", "currency", "valued_at", "created_by", "created_at")
    list_filter = ("currency",)
    search_fields = ("investment__label", "notes")
    raw_id_fields = ("investment", "created_by")
    date_hierarchy = "valued_at"


@admin.register(EnvelopeContribution)
class EnvelopeContributionAdmin(admin.ModelAdmin):
    list_display = ("policy", "amount", "previous_total", "new_total", "created_by", "created_at")
    search_fields = ("policy__case__reference", "notes")
    raw_id_fields = ("policy", "created_by")
    date_hierarchy = "created_at"


@admin.register(Investment)
class InvestmentAdmin(admin.ModelAdmin):
    list_display = (
        "label",
        "case",
        "asset_class",
        "amount_invested",
        "current_value",
        "status",
        "start_date",
    )
    list_filter = ("status", "asset_class", "requires_purification")
    search_fields = ("label", "reference", "case__reference")
    raw_id_fields = ("case", "created_by")
    date_hierarchy = "start_date"
