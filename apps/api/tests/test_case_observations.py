import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from cases.models import CaseObservationStatus, CaseStakeholder, FiduciaryCase, StakeholderRole

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def case(db, agent):
    return FiduciaryCase.objects.create(
        reference="OBS-001",
        title="Dossier observations",
        created_by=agent,
        assigned_to=agent,
    )


@pytest.fixture
def agent(db):
    user = User.objects.create_user(username="agent_obs", password="pw12345678")
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.fixture
def direction(db):
    user = User.objects.create_user(username="dir_obs", password="pw12345678")
    RoleAssignment.objects.create(user=user, role=UserRole.DIRECTION)
    return user


@pytest.fixture
def comite(db):
    user = User.objects.create_user(username="comite_obs", password="pw12345678")
    RoleAssignment.objects.create(user=user, role=UserRole.COMITE_CHARAIQUE)
    return user


@pytest.fixture
def juge(db, case):
    user = User.objects.create_user(username="juge_obs", password="pw12345678")
    RoleAssignment.objects.create(user=user, role=UserRole.JUGE)
    CaseStakeholder.objects.create(case=case, user=user, role=StakeholderRole.JUDGE)
    return user


def obs_url(case_id: int, obs_id: int | None = None, action: str | None = None) -> str:
    base = f"/api/v1/cases/{case_id}/observations/"
    if obs_id is None:
        return base
    path = f"{base}{obs_id}/"
    if action:
        return f"{path}{action}/"
    return path


@pytest.mark.django_db
def test_juge_submits_and_direction_approves(api, case, juge, direction):
    auth(api, juge)
    res = api.post(obs_url(case.pk), {"body": "Observation du juge", "share": True})
    assert res.status_code == 201
    obs_id = res.json()["id"]
    assert res.json()["status"] == CaseObservationStatus.PENDING

    auth(api, direction)
    res = api.post(obs_url(case.pk, obs_id, "approve"))
    assert res.status_code == 200
    assert res.json()["status"] == CaseObservationStatus.APPROVED


@pytest.mark.django_db
def test_comite_rejects_with_reason(api, case, juge, comite):
    auth(api, juge)
    res = api.post(obs_url(case.pk), {"body": "À revoir", "share": True})
    obs_id = res.json()["id"]

    auth(api, comite)
    res = api.post(obs_url(case.pk, obs_id, "reject"), {"review_reason": "Hors périmètre"})
    assert res.status_code == 200
    assert res.json()["status"] == CaseObservationStatus.REJECTED
    assert res.json()["review_reason"] == "Hors périmètre"


@pytest.mark.django_db
def test_comite_adds_remark(api, case, comite):
    auth(api, comite)
    res = api.post(
        obs_url(case.pk),
        {"body": "Suivi interne", "kind": "REMARK"},
    )
    assert res.status_code == 201
    assert res.json()["status"] == CaseObservationStatus.APPROVED
    assert res.json()["kind"] == "REMARK"


@pytest.mark.django_db
def test_agent_cannot_add_remark(api, case, agent):
    auth(api, agent)
    res = api.post(
        obs_url(case.pk),
        {"body": "Suivi interne", "kind": "REMARK"},
    )
    assert res.status_code == 403


@pytest.mark.django_db
def test_reject_requires_reason(api, case, juge, comite):
    auth(api, juge)
    obs_id = api.post(obs_url(case.pk), {"body": "Test", "share": True}).json()["id"]

    auth(api, comite)
    res = api.post(obs_url(case.pk, obs_id, "reject"), {})
    assert res.status_code == 400
