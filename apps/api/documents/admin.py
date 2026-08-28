from django.contrib import admin

from documents.models import (
    Document,
    DocumentAccessLog,
    DocumentShare,
    DocumentTag,
    DocumentVersion,
)


@admin.register(DocumentTag)
class DocumentTagAdmin(admin.ModelAdmin):
    search_fields = ("slug", "label")


class DocumentVersionInline(admin.TabularInline):
    model = DocumentVersion
    extra = 0
    readonly_fields = ("version_number", "original_filename", "size_bytes", "created_at")


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ("title", "case", "category", "uploaded_by", "created_at")
    list_filter = ("category",)
    search_fields = ("title", "case__reference")
    filter_horizontal = ("tags",)
    inlines = (DocumentVersionInline,)


@admin.register(DocumentAccessLog)
class DocumentAccessLogAdmin(admin.ModelAdmin):
    list_display = ("document", "action", "user", "created_at")
    list_filter = ("action",)


@admin.register(DocumentShare)
class DocumentShareAdmin(admin.ModelAdmin):
    list_display = ("document", "shared_by", "shared_with_user", "created_at")
