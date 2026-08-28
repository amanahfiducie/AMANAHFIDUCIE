from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

from config.openapi_views import (
    PublicSpectacularAPIView,
    PublicSpectacularRedocView,
    PublicSpectacularSwaggerView,
)
from config.views import api_root, health

urlpatterns = [
    path("", api_root, name="api-root"),
    path(
        "docs/",
        RedirectView.as_view(pattern_name="swagger-ui", permanent=False),
        name="docs-redirect",
    ),
    path("admin/", admin.site.urls),
    path("api/v1/health/", health, name="health"),
    path("api/v1/schema/", PublicSpectacularAPIView.as_view(), name="schema"),
    path(
        "api/v1/schema/swagger/",
        PublicSpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path(
        "api/v1/schema/redoc/",
        PublicSpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    path("api/v1/", include("accounts.urls")),
    path("api/v1/", include("cases.urls")),
    path("api/v1/", include("cases.urls_observations")),
    path("api/v1/", include("mandates.urls")),
    path("api/v1/", include("beneficiaries.urls")),
    path("api/v1/", include("assets.urls")),
    path("api/v1/", include("documents.urls")),
    path("api/v1/", include("finance.urls")),
    path("api/v1/", include("services.urls")),
    path("api/v1/", include("validations.urls")),
    path("api/v1/", include("portals.urls")),
    path("api/v1/", include("reports.urls")),
    path("api/v1/", include("notifications.urls")),
    path("api/v1/", include("auditlog.urls")),
    path("api/v1/", include("waqf.urls")),
    path("api/v1/", include("zakat.urls")),
    path("api/v1/", include("faraid.urls")),
    path("api/v1/", include("investments.urls")),
]
