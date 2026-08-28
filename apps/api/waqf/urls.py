from django.urls import path

from waqf.views import CaseWaqfView

urlpatterns = [
    path("cases/<int:case_pk>/waqf/", CaseWaqfView.as_view(), name="case-waqf"),
]
