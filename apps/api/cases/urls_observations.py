from django.urls import path

from cases.views_observations import (
    CaseObservationApproveView,
    CaseObservationDetailView,
    CaseObservationListCreateView,
    CaseObservationRejectView,
    CaseObservationShareView,
    ObservationReviewQueueView,
)

urlpatterns = [
    path(
        "observations/review-queue/",
        ObservationReviewQueueView.as_view(),
        name="observation-review-queue",
    ),
    path(
        "cases/<int:case_pk>/observations/",
        CaseObservationListCreateView.as_view(),
        name="case-observations",
    ),
    path(
        "cases/<int:case_pk>/observations/<int:pk>/",
        CaseObservationDetailView.as_view(),
        name="case-observation-detail",
    ),
    path(
        "cases/<int:case_pk>/observations/<int:pk>/share/",
        CaseObservationShareView.as_view(),
        name="case-observation-share",
    ),
    path(
        "cases/<int:case_pk>/observations/<int:pk>/approve/",
        CaseObservationApproveView.as_view(),
        name="case-observation-approve",
    ),
    path(
        "cases/<int:case_pk>/observations/<int:pk>/reject/",
        CaseObservationRejectView.as_view(),
        name="case-observation-reject",
    ),
]
