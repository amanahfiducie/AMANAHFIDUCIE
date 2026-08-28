import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from auditlog.models import AuditLog
from reports.models import Report, ReportStatus
from tests.conftest import complete_minimal_onboarding

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_report",
        password="pw12345678",
        email="agent_report@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.fixture
def director(db):
    user = User.objects.create_user(
        username="dir_report",
        password="pw12345678",
        email="dir_report@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.DIRECTION)
    return user


@pytest.fixture
def family_user(db):
    user = User.objects.create_user(
        username="family_report",
        password="pw12345678",
        email="family_report@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.FAMILLE_TUTEUR)
    return user


@pytest.mark.django_db
def test_generate_list_approve_and_download_report(api, agent, director, family_user):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"case_type": "MANDAT_FIDUCIAIRE", "title": "Dossier rapports"},
        format="json",
    ).json()["id"]
    complete_minimal_onboarding(api, agent, case_id)

    generated = api.post(
        reverse("report-generate"),
        {
            "case_id": case_id,
            "report_type": "QUARTERLY_FAMILY_REPORT",
            "title": "Rapport T1 2026",
        },
        format="json",
    )
    assert generated.status_code == 201, generated.content
    report_id = generated.json()["id"]
    assert generated.json()["status"] == ReportStatus.DRAFT
    assert AuditLog.objects.filter(action="REPORT_GENERATED").exists()

    listed = api.get(reverse("case-report-list", kwargs={"case_pk": case_id}))
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    report = Report.objects.get(pk=report_id)
    assert report.file.name

    auth(api, family_user)
    case = report.case
    case.stakeholders.create(user=family_user, role="FAMILY")
    draft_download = api.get(reverse("report-download-url", kwargs={"pk": report_id}))
    assert draft_download.status_code == 403

    auth(api, director)
    approved = api.post(
        reverse("report-approve", kwargs={"pk": report_id}),
        {"comment": "Validé direction"},
        format="json",
    )
    assert approved.status_code == 200
    assert approved.json()["status"] == ReportStatus.APPROVED
    assert AuditLog.objects.filter(action="REPORT_APPROVED").exists()

    auth(api, family_user)
    download = api.get(reverse("report-download-url", kwargs={"pk": report_id}))
    assert download.status_code == 200
    assert "url" in download.json()
    assert download.json()["expires_in"] > 0

    auth(api, director)
    archived = api.post(reverse("report-archive", kwargs={"pk": report_id}))
    assert archived.status_code == 200
    assert archived.json()["status"] == "ARCHIVED"

    auth(api, family_user)
    portal_reports = api.get(
        reverse("portal-case-reports", kwargs={"case_pk": case_id}),
    )
    assert portal_reports.status_code == 200
    assert len(portal_reports.json()) == 1


@pytest.mark.django_db
def test_pending_reports_list_for_director(api, agent, director):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"case_type": "MANDAT_FIDUCIAIRE", "title": "Rapport pending"},
        format="json",
    ).json()["id"]
    complete_minimal_onboarding(api, agent, case_id)
    report_id = api.post(
        reverse("report-generate"),
        {"case_id": case_id, "report_type": "ANNUAL_MANAGEMENT_REPORT"},
        format="json",
    ).json()["id"]

    auth(api, director)
    pending = api.get(reverse("report-pending-approval"))
    assert pending.status_code == 200
    assert any(r["id"] == report_id for r in pending.json())
