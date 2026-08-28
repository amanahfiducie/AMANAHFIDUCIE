from django.urls import path

from assets.views import (
    AssetEventCancelView,
    AssetEventCategoryListCreateView,
    AssetEventDetailView,
    AssetEventJustificationPreviewView,
    AssetEventListCreateView,
    AssetViewSet,
    CaseAssetViewSet,
    CasePatrimonySummaryView,
)

case_asset_list = CaseAssetViewSet.as_view({"get": "list", "post": "create"})
asset_detail = AssetViewSet.as_view({"get": "retrieve", "patch": "partial_update"})
asset_valuations = AssetViewSet.as_view({"post": "valuations"})
asset_risks = AssetViewSet.as_view({"post": "risks"})

urlpatterns = [
    path(
        "cases/<int:case_pk>/assets/",
        case_asset_list,
        name="case-asset-list",
    ),
    path(
        "cases/<int:case_pk>/patrimony-summary/",
        CasePatrimonySummaryView.as_view(),
        name="case-patrimony-summary",
    ),
    path("assets/<int:pk>/", asset_detail, name="asset-detail"),
    path("assets/<int:pk>/valuations/", asset_valuations, name="asset-valuations"),
    path("assets/<int:pk>/risks/", asset_risks, name="asset-risks"),
    path(
        "assets/<int:pk>/event-categories/",
        AssetEventCategoryListCreateView.as_view(),
        name="asset-event-categories",
    ),
    path(
        "assets/<int:pk>/events/",
        AssetEventListCreateView.as_view(),
        name="asset-events",
    ),
    path(
        "assets/<int:pk>/events/<int:event_pk>/",
        AssetEventDetailView.as_view(),
        name="asset-event-detail",
    ),
    path(
        "assets/<int:pk>/events/<int:event_pk>/cancel/",
        AssetEventCancelView.as_view(),
        name="asset-event-cancel",
    ),
    path(
        "assets/<int:pk>/events/<int:event_pk>/justification-preview/",
        AssetEventJustificationPreviewView.as_view(),
        name="asset-event-justification-preview",
    ),
]
