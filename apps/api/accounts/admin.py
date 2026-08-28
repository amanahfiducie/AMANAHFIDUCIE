from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.contrib.auth import get_user_model

from accounts.models import (
    AccessScope,
    ExternalPartyProfile,
    RoleAssignment,
    UserProfile,
)

User = get_user_model()


class RoleAssignmentInline(admin.TabularInline):
    model = RoleAssignment
    extra = 0
    autocomplete_fields = ("scope",)


class UserProfileInline(admin.StackedInline):
    model = UserProfile
    can_delete = False


try:
    admin.site.unregister(User)
except admin.sites.NotRegistered:
    pass


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "email", "first_name", "last_name", "is_staff", "is_superuser")
    inlines = (UserProfileInline, RoleAssignmentInline)


@admin.register(AccessScope)
class AccessScopeAdmin(admin.ModelAdmin):
    search_fields = ("slug", "label")


@admin.register(ExternalPartyProfile)
class ExternalPartyProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "party_type", "organization_name")
    search_fields = ("user__username", "organization_name")
