import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from assets.models import Asset, AssetValuation
from beneficiaries.models import Beneficiary
from cases.models import CaseType
from investments.models import Investment, InvestmentAssetClass, PatrimonyInvestmentCategory

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_invest2",
        password="pw12345678",
        email="agent_invest2@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_investment_with_participants(api, agent):
    auth(api, agent)

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Tutelle avec parts",
            "case_type": CaseType.TUTELLE_CANTONNEMENT,
        },
        format="json",
    ).json()["id"]

    asset = Asset.objects.create(
        case_id=case_id,
        label="Compte bloqué",
        asset_type="BANK_ACCOUNT",
        is_active=True,
        created_by=agent,
    )
    AssetValuation.objects.create(
        asset=asset,
        value="10000000.00",
        currency="XOF",
        valued_at="2026-01-01",
        created_by=agent,
    )

    b1 = Beneficiary.objects.create(
        case_id=case_id,
        first_name="Aminata",
        last_name="Diop",
        patrimony_share_percent="60",
    )
    Beneficiary.objects.create(
        case_id=case_id,
        first_name="Ibrahima",
        last_name="Diop",
        patrimony_share_percent="40",
    )

    capital = api.get(reverse("case-investment-capital", kwargs={"case_pk": case_id}))
    assert capital.status_code == 200
    assert len(capital.json()["beneficiaries"]) == 2
    assert float(capital.json()["beneficiaries"][0]["available_amount"]) > 0

    category = PatrimonyInvestmentCategory.objects.get(code="A")
    asset_class = InvestmentAssetClass.objects.get(slug="sukuk")

    created = api.post(
        reverse("case-investment-list", kwargs={"case_pk": case_id}),
        {
            "asset_class_id": asset_class.id,
            "label": "Sukuk test parts",
            "amount_invested": "3000000.00",
            "current_value": "3000000.00",
            "start_date": "2026-02-01",
            "status": "ACTIVE",
            "participants": [
                {
                    "beneficiary_id": b1.id,
                    "patrimony_category_id": category.id,
                    "allocated_amount": "3000000.00",
                }
            ],
        },
        format="json",
    )
    assert created.status_code == 201, created.content

    dashboard = api.get(reverse("case-investment-dashboard", kwargs={"case_pk": case_id}))
    assert dashboard.status_code == 200
    charts = dashboard.json()["charts"]
    assert len(charts["category_distribution"]) >= 1
    assert charts["invested_vs_available"]["invested_percent"] > 0

    management = api.get(reverse("investments-management"))
    assert management.status_code == 200
    assert len(management.json()["management_investments"]) >= 1

    # Dépassement de la part patrimoniale
    overflow = api.post(
        reverse("case-investment-list", kwargs={"case_pk": case_id}),
        {
            "asset_class_id": asset_class.id,
            "label": "Sukuk overflow",
            "amount_invested": "7000000.00",
            "current_value": "7000000.00",
            "start_date": "2026-03-01",
            "participants": [
                {
                    "beneficiary_id": b1.id,
                    "patrimony_category_id": category.id,
                    "allocated_amount": "7000000.00",
                }
            ],
        },
        format="json",
    )
    assert overflow.status_code == 400
