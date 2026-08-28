from django.urls import path
from rest_framework.routers import SimpleRouter

from services.case_billing_views import (
    CaseBillingChargeCancelView,
    CaseBillingChargeCreateView,
    CaseBillingChargePostView,
    CaseBillingOverviewView,
    CaseBillingPreviewView,
)
from services.service_ops_views import (
    BillingInvoiceCancelView,
    BillingInvoiceDetailView,
    BillingInvoicePdfView,
    BillingInvoicePostView,
    BillingInvoicePreviewView,
    BillingInvoicesView,
    CaseBillingChargePdfView,
    ServiceCasesView,
    ServiceGeneratePeriodicBillingView,
)
from services.views import ServiceBillingRuleViewSet, ServiceOfferViewSet

router = SimpleRouter()
router.register("services", ServiceOfferViewSet, basename="service-offer")

billing_list = ServiceBillingRuleViewSet.as_view({"post": "create"})
billing_detail = ServiceBillingRuleViewSet.as_view(
    {"patch": "partial_update", "delete": "destroy"}
)

urlpatterns = [
    *router.urls,
    path(
        "billing/invoices/",
        BillingInvoicesView.as_view(),
        name="billing-invoices",
    ),
    path(
        "billing/invoices/preview/",
        BillingInvoicePreviewView.as_view(),
        name="billing-invoices-preview",
    ),
    path(
        "billing/invoices/<int:invoice_pk>/",
        BillingInvoiceDetailView.as_view(),
        name="billing-invoice-detail",
    ),
    path(
        "billing/invoices/<int:invoice_pk>/post/",
        BillingInvoicePostView.as_view(),
        name="billing-invoice-post",
    ),
    path(
        "billing/invoices/<int:invoice_pk>/cancel/",
        BillingInvoiceCancelView.as_view(),
        name="billing-invoice-cancel",
    ),
    path(
        "billing/invoices/<int:invoice_pk>/pdf/",
        BillingInvoicePdfView.as_view(),
        name="billing-invoice-pdf",
    ),
    path(
        "services/<str:case_type>/billing-rules/",
        billing_list,
        name="service-billing-rule-list",
    ),
    path(
        "services/<str:case_type>/billing-rules/<int:pk>/",
        billing_detail,
        name="service-billing-rule-detail",
    ),
    path(
        "services/<str:case_type>/cases/",
        ServiceCasesView.as_view(),
        name="service-cases",
    ),
    path(
        "services/<str:case_type>/billing/generate/",
        ServiceGeneratePeriodicBillingView.as_view(),
        name="service-billing-generate",
    ),
    path(
        "cases/<int:case_pk>/billing/",
        CaseBillingOverviewView.as_view(),
        name="case-billing-overview",
    ),
    path(
        "cases/<int:case_pk>/billing/preview/",
        CaseBillingPreviewView.as_view(),
        name="case-billing-preview",
    ),
    path(
        "cases/<int:case_pk>/billing/charges/",
        CaseBillingChargeCreateView.as_view(),
        name="case-billing-charge-create",
    ),
    path(
        "cases/<int:case_pk>/billing/charges/<int:charge_pk>/post/",
        CaseBillingChargePostView.as_view(),
        name="case-billing-charge-post",
    ),
    path(
        "cases/<int:case_pk>/billing/charges/<int:charge_pk>/cancel/",
        CaseBillingChargeCancelView.as_view(),
        name="case-billing-charge-cancel",
    ),
    path(
        "cases/<int:case_pk>/billing/charges/<int:charge_pk>/pdf/",
        CaseBillingChargePdfView.as_view(),
        name="case-billing-charge-pdf",
    ),
]
