from django.contrib import admin

from assets.models import Asset, AssetIncome, AssetRisk, AssetValuation


class AssetValuationInline(admin.TabularInline):
    model = AssetValuation
    extra = 0


class AssetRiskInline(admin.TabularInline):
    model = AssetRisk
    extra = 0


@admin.register(Asset)
class AssetAdmin(admin.ModelAdmin):
    list_display = ("label", "case", "asset_type", "is_active", "created_at")
    list_filter = ("asset_type", "is_active")
    search_fields = ("label", "case__reference")
    inlines = (AssetValuationInline, AssetRiskInline)


admin.site.register(AssetIncome)
