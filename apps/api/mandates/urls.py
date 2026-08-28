from django.urls import path

from mandates.views import CaseMandateViewSet, MandateViewSet

case_mandate_list = CaseMandateViewSet.as_view({"get": "list", "post": "create"})
mandate_detail = MandateViewSet.as_view({"get": "retrieve", "patch": "partial_update"})
mandate_validate = MandateViewSet.as_view({"post": "validate"})

urlpatterns = [
    path(
        "cases/<int:case_pk>/mandates/",
        case_mandate_list,
        name="case-mandate-list",
    ),
    path("mandates/<int:pk>/", mandate_detail, name="mandate-detail"),
    path("mandates/<int:pk>/validate/", mandate_validate, name="mandate-validate"),
]
