from django.urls import path

from beneficiaries.views import (
    BeneficiaryViewSet,
    CaseBeneficiaryViewSet,
    CaseDonorDetailViewSet,
    CaseDonorViewSet,
    CaseGuardianViewSet,
    DonorTrustedPersonViewSet,
    GuardianViewSet,
)

case_donor_list = CaseDonorViewSet.as_view({"get": "list", "post": "create"})
donor_detail = CaseDonorDetailViewSet.as_view({"get": "retrieve", "patch": "partial_update"})
donor_trusted_list = DonorTrustedPersonViewSet.as_view({"get": "list", "post": "create"})
case_beneficiary_list = CaseBeneficiaryViewSet.as_view({"get": "list", "post": "create"})
beneficiary_detail = BeneficiaryViewSet.as_view(
    {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}
)
case_guardian_list = CaseGuardianViewSet.as_view({"get": "list", "post": "create"})
guardian_detail = GuardianViewSet.as_view({"get": "retrieve", "patch": "partial_update"})

urlpatterns = [
    path(
        "cases/<int:case_pk>/donors/",
        case_donor_list,
        name="case-donor-list",
    ),
    path("donors/<int:pk>/", donor_detail, name="donor-detail"),
    path(
        "cases/<int:case_pk>/donors/<int:donor_pk>/trusted-persons/",
        donor_trusted_list,
        name="donor-trusted-person-list",
    ),
    path(
        "cases/<int:case_pk>/beneficiaries/",
        case_beneficiary_list,
        name="case-beneficiary-list",
    ),
    path("beneficiaries/<int:pk>/", beneficiary_detail, name="beneficiary-detail"),
    path(
        "cases/<int:case_pk>/guardians/",
        case_guardian_list,
        name="case-guardian-list",
    ),
    path("guardians/<int:pk>/", guardian_detail, name="guardian-detail"),
]
