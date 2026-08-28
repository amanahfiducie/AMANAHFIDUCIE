from django.contrib import admin

from faraid.models import FaraidHeir


@admin.register(FaraidHeir)
class FaraidHeirAdmin(admin.ModelAdmin):
    list_display = ("full_name", "case", "share_fraction", "relationship_label")
    search_fields = ("full_name", "case__reference")
