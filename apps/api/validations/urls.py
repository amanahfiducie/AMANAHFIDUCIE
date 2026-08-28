from django.urls import path
from validations.views import (
    CaseValidationListCreateView,
    MyValidationQueueView,
    ValidationInboxView,
    ValidationRequestViewSet,
)

validation_list = ValidationRequestViewSet.as_view({"post": "create"})
validation_detail = ValidationRequestViewSet.as_view({"get": "retrieve"})
validation_approve = ValidationRequestViewSet.as_view({"post": "approve"})
validation_reject = ValidationRequestViewSet.as_view({"post": "reject"})
validation_request_changes = ValidationRequestViewSet.as_view(
    {"post": "request_changes"}
)

urlpatterns = [
    path(
        "cases/<int:case_pk>/validations/",
        CaseValidationListCreateView.as_view(),
        name="case-validation-list",
    ),
    path("validations/", validation_list, name="validation-list"),
    path("validations/my-queue/", MyValidationQueueView.as_view(), name="validation-my-queue"),
    path("validations/inbox/", ValidationInboxView.as_view(), name="validation-inbox"),
    path("validations/<int:pk>/", validation_detail, name="validation-detail"),
    path("validations/<int:pk>/approve/", validation_approve, name="validation-approve"),
    path("validations/<int:pk>/reject/", validation_reject, name="validation-reject"),
    path(
        "validations/<int:pk>/request-changes/",
        validation_request_changes,
        name="validation-request-changes",
    ),
]
