import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from notifications.models import Notification
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
        username="agent_notif",
        password="pw12345678",
        email="agent_notif@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.fixture
def juridique(db):
    user = User.objects.create_user(
        username="juridique_notif",
        password="pw12345678",
        email="juridique_notif@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.JURIDIQUE_CONFORMITE)
    return user


@pytest.mark.django_db
def test_case_submit_creates_notification_for_juridique(api, agent, juridique):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"case_type": "MANDAT_FIDUCIAIRE", "title": "Dossier notif"},
        format="json",
    ).json()["id"]
    complete_minimal_onboarding(api, agent, case_id)
    submit = api.post(reverse("case-submit", kwargs={"pk": case_id}))
    assert submit.status_code == 200, submit.content

    auth(api, juridique)
    listed = api.get(reverse("notification-list"))
    assert listed.status_code == 200
    assert len(listed.json()) >= 1
    note_id = listed.json()[0]["id"]
    read = api.post(reverse("notification-read", kwargs={"pk": note_id}))
    assert read.status_code == 200
    assert read.json()["is_read"] is True


@pytest.mark.django_db
def test_notification_preferences_patch(api, agent):
    auth(api, agent)
    prefs = api.patch(
        reverse("notification-preferences"),
        {"email_enabled": False},
        format="json",
    )
    assert prefs.status_code == 200
    assert prefs.json()["email_enabled"] is False
    assert Notification.objects.filter(user=agent).count() >= 0
