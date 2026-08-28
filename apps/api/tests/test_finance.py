import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from finance.models import FinancialMovement, MovementStatus, MovementType

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_finance",
        password="pw12345678",
        email="agent_finance@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_accounts_movements_summary_and_validation(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier finance"},
        format="json",
    ).json()["id"]

    account = api.post(
        reverse("case-account-list", kwargs={"case_pk": case_id}),
        {
            "name": "Compte principal",
            "account_number": "CI-001",
            "currency": "XOF",
            "opening_balance": "1000000.00",
        },
        format="json",
    )
    assert account.status_code == 201, account.content
    account_id = account.json()["id"]
    assert account.json()["current_balance"] == "1000000.00"

    listed = api.get(reverse("case-account-list", kwargs={"case_pk": case_id}))
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    movement = api.post(
        reverse("account-movement-list", kwargs={"account_pk": account_id}),
        {
            "movement_type": MovementType.INCOME,
            "amount": "250000.00",
            "description": "Versement initial",
            "reference": "VIR-001",
            "movement_date": "2026-05-01",
        },
        format="json",
    )
    assert movement.status_code == 201, movement.content
    movement_id = movement.json()["id"]
    assert movement.json()["status"] == MovementStatus.DRAFT
    assert movement.json()["signed_amount"] == "250000.00"

    submit = api.post(
        reverse("movement-submit-validation", kwargs={"pk": movement_id}),
    )
    assert submit.status_code == 200
    assert submit.json()["status"] == MovementStatus.PENDING_VALIDATION

    summary = api.get(
        reverse("case-financial-summary", kwargs={"case_pk": case_id})
    )
    assert summary.status_code == 200
    body = summary.json()
    assert body["account_count"] == 1
    assert body["total_balance"] == "1000000.00"
    assert body["accounts"][0]["pending_validation_count"] == 1

    FinancialMovement.objects.filter(pk=movement_id).update(
        status=MovementStatus.APPROVED
    )
    summary_after = api.get(
        reverse("case-financial-summary", kwargs={"case_pk": case_id})
    )
    assert summary_after.json()["total_balance"] == "1250000.00"

    detail = api.get(reverse("movement-detail", kwargs={"pk": movement_id}))
    assert detail.status_code == 200


@pytest.mark.django_db
def test_comptable_can_manage_finance(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Dossier comptable"},
        format="json",
    ).json()["id"]

    comptable = User.objects.create_user(
        username="comptable1",
        password="pw12345678",
        email="comptable1@example.com",
    )
    RoleAssignment.objects.create(user=comptable, role=UserRole.COMPTABLE_FIDUCIAIRE)
    auth(api, comptable)
    account = api.post(
        reverse("case-account-list", kwargs={"case_pk": case_id}),
        {"name": "Compte dépenses"},
        format="json",
    )
    assert account.status_code == 201, account.content
