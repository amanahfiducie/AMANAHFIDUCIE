from django.urls import path

from investments.views import (
    AssetClassDashboardView,
    CaseBeneficiaryCapitalView,
    CaseEnvelopeContributionView,
    CaseInvestmentDashboardView,
    CaseInvestmentPolicyView,
    CaseInvestmentViewSet,
    InvestmentAllocateView,
    InvestmentAssetClassViewSet,
    InvestmentCatalogView,
    InvestmentDetailViewSet,
    InvestmentEnvelopeView,
    InvestmentValuationView,
    InvestmentsGlobalDashboardView,
    InvestmentsManagementView,
    InvestmentsOverviewView,
    PatrimonyInvestmentCategoryViewSet,
)

case_investment_list = CaseInvestmentViewSet.as_view({"get": "list", "post": "create"})
investment_detail = InvestmentDetailViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update"}
)
asset_class_list = InvestmentAssetClassViewSet.as_view({"get": "list", "post": "create"})
asset_class_detail = InvestmentAssetClassViewSet.as_view({"patch": "partial_update"})
patrimony_category_list = PatrimonyInvestmentCategoryViewSet.as_view({"get": "list"})
patrimony_category_detail = PatrimonyInvestmentCategoryViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update"}
)

urlpatterns = [
    path(
        "investments/asset-classes/",
        asset_class_list,
        name="investment-asset-class-list",
    ),
    path(
        "investments/asset-classes/<int:pk>/",
        asset_class_detail,
        name="investment-asset-class-detail",
    ),
    path(
        "investments/patrimony-categories/",
        patrimony_category_list,
        name="patrimony-investment-category-list",
    ),
    path(
        "investments/patrimony-categories/<int:pk>/",
        patrimony_category_detail,
        name="patrimony-investment-category-detail",
    ),
    path(
        "investments/catalog/",
        InvestmentCatalogView.as_view(),
        name="investment-catalog",
    ),
    path(
        "investments/overview/",
        InvestmentsOverviewView.as_view(),
        name="investments-overview",
    ),
    path(
        "investments/management/",
        InvestmentsManagementView.as_view(),
        name="investments-management",
    ),
    path(
        "investments/dashboard/",
        InvestmentsGlobalDashboardView.as_view(),
        name="investments-global-dashboard",
    ),
    path(
        "investments/categories/<slug:slug>/dashboard/",
        AssetClassDashboardView.as_view(),
        name="investment-category-dashboard",
    ),
    path(
        "cases/<int:case_pk>/investment-capital/",
        CaseBeneficiaryCapitalView.as_view(),
        name="case-investment-capital",
    ),
    path(
        "cases/<int:case_pk>/investments/",
        case_investment_list,
        name="case-investment-list",
    ),
    path(
        "cases/<int:case_pk>/investment-dashboard/",
        CaseInvestmentDashboardView.as_view(),
        name="case-investment-dashboard",
    ),
    path(
        "cases/<int:case_pk>/investment-policy/",
        CaseInvestmentPolicyView.as_view(),
        name="case-investment-policy",
    ),
    path(
        "cases/<int:case_pk>/investment-policy/envelope-contributions/",
        CaseEnvelopeContributionView.as_view(),
        name="case-envelope-contributions",
    ),
    path(
        "investments/",
        InvestmentEnvelopeView.as_view(),
        name="investment-envelope-create",
    ),
    path(
        "investments/<int:pk>/allocations/",
        InvestmentAllocateView.as_view(),
        name="investment-allocate",
    ),
    path(
        "investments/<int:pk>/valuations/",
        InvestmentValuationView.as_view(),
        name="investment-valuation-create",
    ),
    path(
        "investments/<int:pk>/",
        investment_detail,
        name="investment-detail",
    ),
]
