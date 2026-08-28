import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from auditlog.models import AuditLog
from cases.models import CaseAssignment, CaseStatus, CaseTimelineEvent, CaseType, FiduciaryCase
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
        username="agent1",
        password="pw12345678",
        email="agent1@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.fixture
def family_user(db):
    user = User.objects.create_user(
        username="family1",
        password="pw12345678",
        email="family1@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.FAMILLE_TUTEUR)
    return user


@pytest.mark.django_db
def test_cases_list_filter_by_status(api, agent):
    auth(api, agent)
    draft_id = api.post(
        reverse("case-list"),
        {"title": "Brouillon filtre"},
        format="json",
    ).json()["id"]
    api.post(
        reverse("case-list"),
        {"title": "Soumis filtre", "case_type": "MANDAT_FIDUCIAIRE"},
        format="json",
    )
    from tests.conftest import complete_minimal_onboarding

    complete_minimal_onboarding(api, agent, draft_id)
    submit = api.post(reverse("case-submit", kwargs={"pk": draft_id}))
    assert submit.status_code == 200, submit.content
    case = FiduciaryCase.objects.get(pk=draft_id)
    assert case.status == CaseStatus.UNDER_REVIEW

    filtered = api.get(reverse("case-list"), {"status": "UNDER_REVIEW"})
    assert filtered.status_code == 200
    ids = {c["id"] for c in filtered.json()}
    assert draft_id in ids

    drafts_only = api.get(reverse("case-list"), {"status": "DRAFT"})
    draft_ids = {c["id"] for c in drafts_only.json()}
    assert draft_id not in draft_ids


@pytest.mark.django_db
def test_agent_creates_case_with_timeline_and_audit(api, agent):
    auth(api, agent)
    response = api.post(
        reverse("case-list"),
        {
            "case_type": CaseType.SUCCESSION,
            "title": "Succession Diallo",
            "description": "Mandat familial",
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    data = response.json()
    assert data["status"] == CaseStatus.DRAFT
    assert data["reference"].startswith("REF-")
    case = FiduciaryCase.objects.get(pk=data["id"])
    assert case.timeline_events.filter(event_type="CREATED").exists()
    assert AuditLog.objects.filter(action="CASE_CREATED", case=case).exists()


@pytest.mark.django_db
def test_family_user_sees_only_assigned_cases(api, agent, family_user):
    auth(api, agent)
    created = api.post(
        reverse("case-list"),
        {"case_type": CaseType.MANDAT_FIDUCIAIRE, "title": "Dossier A"},
        format="json",
    ).json()

    case = FiduciaryCase.objects.get(pk=created["id"])
    case.stakeholders.create(user=family_user, role="FAMILY")

    auth(api, family_user)
    listed = api.get(reverse("case-list"))
    assert listed.status_code == 200
    ids = {item["id"] for item in listed.json()}
    assert created["id"] in ids

    other = User.objects.create_user(
        username="other_family",
        password="pw12345678",
        email="other@example.com",
    )
    RoleAssignment.objects.create(user=other, role=UserRole.FAMILLE_TUTEUR)
    auth(api, other)
    listed_other = api.get(reverse("case-list"))
    assert listed_other.status_code == 200
    assert created["id"] not in {item["id"] for item in listed_other.json()}


@pytest.mark.django_db
def test_family_user_cannot_create_case(api, family_user):
    auth(api, family_user)
    response = api.post(
        reverse("case-list"),
        {"title": "Tentative"},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_submit_and_close_workflow(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"case_type": CaseType.MANDAT_FIDUCIAIRE, "title": "Workflow test"},
        format="json",
    ).json()["id"]
    complete_minimal_onboarding(api, agent, case_id)

    submit = api.post(reverse("case-submit", kwargs={"pk": case_id}))
    assert submit.status_code == 200
    assert submit.json()["status"] == CaseStatus.UNDER_REVIEW
    assert CaseTimelineEvent.objects.filter(
        case_id=case_id, event_type="SUBMITTED"
    ).exists()

    close = api.post(reverse("case-close", kwargs={"pk": case_id}))
    assert close.status_code == 200
    assert close.json()["status"] == CaseStatus.CLOSED

    # Un dossier clôturé ne peut plus être modifié
    patch = api.patch(
        reverse("case-detail", kwargs={"pk": case_id}),
        {"title": "Tentative de modification"},
        format="json",
    )
    assert patch.status_code == 403
    body = patch.json()
    msg = str(body.get("detail") or body).lower()
    assert "clôtur" in msg or "modifi" in msg

    asset = api.post(
        reverse("case-asset-list", kwargs={"case_pk": case_id}),
        {
            "asset_type": "CASH",
            "label": "Ne doit pas passer",
            "currency": "XOF",
        },
        format="json",
    )
    assert asset.status_code == 403


@pytest.mark.django_db
def test_timeline_endpoint(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"case_type": CaseType.MANDAT_FIDUCIAIRE, "title": "Timeline"},
        format="json",
    ).json()["id"]

    timeline = api.get(reverse("case-timeline", kwargs={"pk": case_id}))
    assert timeline.status_code == 200
    assert len(timeline.json()) >= 1


@pytest.mark.django_db
def test_case_assignment_history_on_reassign(api, agent):
    auth(api, agent)
    other = User.objects.create_user(
        username="agent2",
        password="pw12345678",
        email="agent2@example.com",
    )
    RoleAssignment.objects.create(user=other, role=UserRole.AGENT_FIDUCIAIRE)
    direction = User.objects.create_user(
        username="dir1",
        password="pw12345678",
        email="dir1@example.com",
    )
    RoleAssignment.objects.create(user=direction, role=UserRole.DIRECTION)

    case_id = api.post(
        reverse("case-list"),
        {"title": "Assign test", "assigned_to": agent.pk},
        format="json",
    ).json()["id"]

    detail = api.get(reverse("case-detail", kwargs={"pk": case_id}))
    assert detail.status_code == 200
    history = detail.json()["assignment_history"]
    assert len(history) == 1
    assert history[0]["username"] == "agent1"
    assert history[0]["is_current"] is True

    denied = api.patch(
        reverse("case-detail", kwargs={"pk": case_id}),
        {"assigned_to": other.pk},
        format="json",
    )
    assert denied.status_code == 403

    auth(api, direction)
    updated = api.patch(
        reverse("case-detail", kwargs={"pk": case_id}),
        {"assigned_to": other.pk},
        format="json",
    )
    assert updated.status_code == 200

    detail2 = api.get(reverse("case-detail", kwargs={"pk": case_id}))
    history2 = detail2.json()["assignment_history"]
    assert len(history2) == 2
    current = [h for h in history2 if h["is_current"]]
    assert len(current) == 1
    assert current[0]["username"] == "agent2"
    past = [h for h in history2 if not h["is_current"]]
    assert len(past) == 1
    assert past[0]["username"] == "agent1"
    assert past[0]["ended_at"] is not None

    assert CaseAssignment.objects.filter(case_id=case_id).count() == 2

    agents = api.get(reverse("case-assignable-agents", kwargs={"pk": case_id}))
    assert agents.status_code == 200
    ids = {row["id"] for row in agents.json()}
    assert agent.pk in ids and other.pk in ids
