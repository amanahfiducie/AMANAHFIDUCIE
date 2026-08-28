from django.contrib import admin

from beneficiaries.models import (
    Beneficiary,
    CaseDonor,
    DonorTrustedPerson,
    FamilyRelation,
    Guardian,
)


@admin.register(CaseDonor)
class CaseDonorAdmin(admin.ModelAdmin):
    list_display = ("last_name", "first_name", "case", "phone", "email")
    search_fields = ("last_name", "first_name", "case__reference")


@admin.register(DonorTrustedPerson)
class DonorTrustedPersonAdmin(admin.ModelAdmin):
    list_display = ("last_name", "first_name", "donor", "phone", "email")
    search_fields = ("last_name", "first_name", "donor__case__reference")


@admin.register(Beneficiary)
class BeneficiaryAdmin(admin.ModelAdmin):
    list_display = ("last_name", "first_name", "case", "is_minor")
    search_fields = ("last_name", "first_name", "case__reference")


@admin.register(Guardian)
class GuardianAdmin(admin.ModelAdmin):
    list_display = ("last_name", "first_name", "case", "email")
    search_fields = ("last_name", "first_name", "case__reference")


@admin.register(FamilyRelation)
class FamilyRelationAdmin(admin.ModelAdmin):
    list_display = ("case", "relation_type", "from_beneficiary", "to_beneficiary", "to_guardian")
