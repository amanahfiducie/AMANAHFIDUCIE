import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from finance.models import MovementStatus, MovementType

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def comptable(db):
    user = User.objects.create_user(username="comptable_ent", password="pw12345678")
    RoleAssignment.objects.create(user=user, role=UserRole.COMPTABLE_FIDUCIAIRE)
    return user


@pytest.fixture
def agent(db):
    user = User.objects.create_user(username="agent_ent", password="pw12345678")
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_comptable_creates_enterprise_account_and_movement(api, comptable):
    from finance.models import MovementCategory

    auth(api, comptable)
    expense_cat = MovementCategory.objects.filter(scope="EXPENSE").first()
    assert expense_cat is not None

    res = api.post(
        reverse("enterprise-account-list"),
        {"name": "Banque SOFIGEPAM", "account_type": "BANK", "opening_balance": "1000000"},
        format="json",
    )
    assert res.status_code == 201
    account_id = res.json()["id"]

    res = api.post(
        reverse("enterprise-movement-list"),
        {
            "account": account_id,
            "movement_type": MovementType.EXPENSE,
            "category": expense_cat.pk,
            "amount": "50000",
            "movement_date": "2026-01-15",
            "description": "Loyer siège",
        },
        format="json",
    )
    assert res.status_code == 201
    movement_id = res.json()["id"]

    res = api.patch(
        reverse("enterprise-movement-detail", args=[movement_id]),
        {"status": MovementStatus.APPROVED},
        format="json",
    )
    assert res.status_code == 200
    assert res.json()["status"] == MovementStatus.APPROVED

    res = api.get(reverse("enterprise-summary"))
    assert res.status_code == 200
    assert res.json()["entity_name"] == "SOFIGEPAM"
    assert res.json()["account_count"] == 1


@pytest.mark.django_db
def test_revenue_categories_match_five_services(api, comptable):
    auth(api, comptable)
    res = api.get(reverse("enterprise-categories") + "?scope=REVENUE")
    assert res.status_code == 200
    data = res.json()
    assert len(data) == 5
    service_types = {row["service_type"] for row in data}
    assert service_types == {
        "MANDAT_FIDUCIAIRE",
        "TUTELLE_CANTONNEMENT",
        "SUCCESSION",
        "WAQF",
        "ZAKAT_FARAID",
    }


@pytest.mark.django_db
def test_comptable_creates_custom_expense_category(api, comptable):
    auth(api, comptable)
    res = api.post(
        reverse("enterprise-categories"),
        {"label": "Marketing digital", "scope": "EXPENSE"},
        format="json",
    )
    assert res.status_code == 201
    data = res.json()
    assert data["label"] == "Marketing digital"
    assert data["scope"] == "EXPENSE"
    assert data["is_system"] is False
    assert data["is_active"] is True

    res = api.get(reverse("enterprise-categories") + "?scope=EXPENSE")
    assert res.status_code == 200
    labels = {row["label"] for row in res.json()}
    assert "Marketing digital" in labels


@pytest.mark.django_db
def test_movement_without_explicit_account_uses_default(api, comptable):
    from finance.models import MovementCategory

    auth(api, comptable)
    expense_cat = MovementCategory.objects.filter(scope="EXPENSE").first()
    res = api.post(
        reverse("enterprise-movement-list"),
        {
            "movement_type": MovementType.EXPENSE,
            "category": expense_cat.pk,
            "amount": "25000",
            "movement_date": "2026-02-01",
            "description": "Sans compte explicite",
        },
        format="json",
    )
    assert res.status_code == 201
    assert res.json()["account_name"]


@pytest.mark.django_db
def test_agent_cannot_access_enterprise_finance(api, agent):
    auth(api, agent)
    res = api.get(reverse("enterprise-summary"))
    assert res.status_code == 403


@pytest.mark.django_db
def test_manual_income_excluded_from_chiffre_affaires(api, comptable):
    """Les recettes manuelles n'alimentent pas le CA — uniquement les factures."""
    from decimal import Decimal

    from finance.models import MovementCategory

    auth(api, comptable)
    revenue_cat = MovementCategory.objects.filter(scope="REVENUE").first()
    assert revenue_cat is not None

    res = api.post(
        reverse("enterprise-movement-list"),
        {
            "movement_type": MovementType.INCOME,
            "category": revenue_cat.pk,
            "amount": "999000",
            "movement_date": "2026-03-10",
            "description": "Recette manuelle hors facture",
        },
        format="json",
    )
    assert res.status_code == 201
    movement_id = res.json()["id"]

    res = api.patch(
        reverse("enterprise-movement-detail", args=[movement_id]),
        {"status": MovementStatus.APPROVED},
        format="json",
    )
    assert res.status_code == 200

    summary = api.get(reverse("enterprise-summary"), {"year": "2026"})
    assert summary.status_code == 200
    perf = summary.json()["performance"]
    assert Decimal(perf["chiffre_affaires"]) == Decimal("0")
    assert perf.get("revenue_source") == "invoices"
