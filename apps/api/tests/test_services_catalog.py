import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import RoleAssignment, UserRole
from services.models import ServiceOffer

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def _make_user(username: str, role: str):
    user = User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password="Passw0rd!",
    )
    RoleAssignment.objects.create(user=user, role=role)
    return user


@pytest.mark.django_db
def test_direction_lists_services(api):
    user = _make_user("dir_svc", UserRole.DIRECTION)
    api.force_authenticate(user=user)
    response = api.get(reverse("service-offer-list"))
    assert response.status_code == 200
    assert len(response.json()) == 5


@pytest.mark.django_db
def test_agent_cannot_view_services(api):
    user = _make_user("agent_svc", UserRole.AGENT_FIDUCIAIRE)
    api.force_authenticate(user=user)
    response = api.get(reverse("service-offer-list"))
    assert response.status_code == 403


@pytest.mark.django_db
def test_comptable_can_view_but_not_edit_rules(api):
    user = _make_user("cpta_svc", UserRole.COMPTABLE_FIDUCIAIRE)
    api.force_authenticate(user=user)
    listed = api.get(reverse("service-offer-list"))
    assert listed.status_code == 200
    offer = ServiceOffer.objects.get(case_type="MANDAT_FIDUCIAIRE")
    create = api.post(
        reverse("service-billing-rule-list", kwargs={"case_type": offer.case_type}),
        {
            "formula": "MISSION_FEE",
            "label": "Test",
            "periodicity": "ONCE",
        },
        format="json",
    )
    assert create.status_code == 403


@pytest.mark.django_db
def test_direction_can_create_billing_rule(api):
    user = _make_user("dir_rule", UserRole.DIRECTION)
    api.force_authenticate(user=user)
    response = api.post(
        reverse(
            "service-billing-rule-list",
            kwargs={"case_type": "ZAKAT_FARAID"},
        ),
        {
            "formula": "MISSION_FEE",
            "label": "Audit zakat entreprise",
            "fixed_amount": "250000",
            "periodicity": "ONCE",
            "is_active": True,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.json()["label"] == "Audit zakat entreprise"
