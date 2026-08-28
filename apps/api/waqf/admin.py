from django.contrib import admin

from waqf.models import WaqfProfile


@admin.register(WaqfProfile)
class WaqfProfileAdmin(admin.ModelAdmin):
    list_display = ("case", "waqf_type", "updated_at")
    search_fields = ("case__reference",)
