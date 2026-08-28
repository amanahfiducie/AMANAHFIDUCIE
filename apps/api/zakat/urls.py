from django.urls import path

from zakat.views import CaseZakatAssessmentView

urlpatterns = [
    path(
        "cases/<int:case_pk>/zakat-assessments/",
        CaseZakatAssessmentView.as_view(),
        name="case-zakat-list",
    ),
]
