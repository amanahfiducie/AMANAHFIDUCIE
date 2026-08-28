from django.urls import path

from finance.views import (
    AccountMovementViewSet,
    CaseFinancialSummaryView,
    CaseFiduciaryAccountViewSet,
    FinanceAccountListView,
    FinanceMovementListView,
    FinancialMovementViewSet,
)
from finance.enterprise_views import (
    EnterpriseAccountViewSet,
    EnterpriseCategoryViewSet,
    EnterpriseJustificatifDownloadView,
    EnterpriseJustificatifListCreateView,
    EnterpriseMovementViewSet,
    EnterpriseSummaryView,
)

case_account_list = CaseFiduciaryAccountViewSet.as_view(
    {"get": "list", "post": "create"}
)
account_movement_list = AccountMovementViewSet.as_view(
    {"get": "list", "post": "create"}
)
movement_detail = FinancialMovementViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update"}
)
movement_submit = FinancialMovementViewSet.as_view({"post": "submit_validation"})
enterprise_category_list = EnterpriseCategoryViewSet.as_view({"get": "list", "post": "create"})
enterprise_category_detail = EnterpriseCategoryViewSet.as_view({"patch": "partial_update"})
enterprise_account_list = EnterpriseAccountViewSet.as_view({"get": "list", "post": "create"})
enterprise_movement_list = EnterpriseMovementViewSet.as_view({"get": "list", "post": "create"})
enterprise_movement_detail = EnterpriseMovementViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update"}
)

urlpatterns = [
    path(
        "enterprise/summary/",
        EnterpriseSummaryView.as_view(),
        name="enterprise-summary",
    ),
    path(
        "enterprise/categories/",
        enterprise_category_list,
        name="enterprise-categories",
    ),
    path(
        "enterprise/categories/<int:pk>/",
        enterprise_category_detail,
        name="enterprise-category-detail",
    ),
    path(
        "enterprise/accounts/",
        enterprise_account_list,
        name="enterprise-account-list",
    ),
    path(
        "enterprise/movements/",
        enterprise_movement_list,
        name="enterprise-movement-list",
    ),
    path(
        "enterprise/movements/<int:pk>/",
        enterprise_movement_detail,
        name="enterprise-movement-detail",
    ),
    path(
        "enterprise/movements/<int:movement_pk>/justificatifs/",
        EnterpriseJustificatifListCreateView.as_view(),
        name="enterprise-justificatif-list",
    ),
    path(
        "enterprise/justificatifs/<int:pk>/download/",
        EnterpriseJustificatifDownloadView.as_view(),
        name="enterprise-justificatif-download",
    ),
    path("finance/accounts/", FinanceAccountListView.as_view(), name="finance-account-list"),
    path(
        "finance/movements/",
        FinanceMovementListView.as_view(),
        name="finance-movement-list",
    ),
    path(
        "cases/<int:case_pk>/accounts/",
        case_account_list,
        name="case-account-list",
    ),
    path(
        "cases/<int:case_pk>/financial-summary/",
        CaseFinancialSummaryView.as_view(),
        name="case-financial-summary",
    ),
    path(
        "accounts/<int:account_pk>/movements/",
        account_movement_list,
        name="account-movement-list",
    ),
    path("movements/<int:pk>/", movement_detail, name="movement-detail"),
    path(
        "movements/<int:pk>/submit-validation/",
        movement_submit,
        name="movement-submit-validation",
    ),
]
