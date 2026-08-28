from django.contrib import admin

from zakat.models import ZakatAssessment


@admin.register(ZakatAssessment)
class ZakatAssessmentAdmin(admin.ModelAdmin):
    list_display = ("case", "assessment_year", "zakat_due", "status")
    list_filter = ("status", "assessment_year")
