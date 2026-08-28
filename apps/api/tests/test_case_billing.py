import pytest
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import RoleAssignment, UserRole
from assets.models import Asset, AssetType, AssetValuation
from cases.models import CaseType, FiduciaryCase
from finance.models import MovementCategory, CategoryScope, MovementType
from services.models import ServiceOffer

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def _dir_user():
    user = User.objects.create_user(
        username="dir_bill",
        email="dir_bill@example.com",
        password="Passw0rd!",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.DIRECTION)
    return user


@pytest.mark.django_db
def test_case_billing_create_and_post(api):
    user = _dir_user()
    api.force_authenticate(user=user)

    case = FiduciaryCase.objects.create(
        reference="REF-2026-BILL01",
        case_type=CaseType.MANDAT_FIDUCIAIRE,
        title="Dossier facturation",
        created_by=user,
    )
    asset = Asset.objects.create(
        case=case,
        asset_type=AssetType.REAL_ESTATE,
        label="Immeuble test",
        currency="XOF",
        created_by=user,
    )
    AssetValuation.objects.create(
        asset=asset,
        value=Decimal("100000000"),
        currency="XOF",
        valued_at="2026-01-15",
        created_by=user,
    )

    # Ensure revenue category exists for service type
    MovementCategory.objects.get_or_create(
        slug="recette-mandat-fiduciaire",
        defaults={
            "label": "Gestion fiduciaire du patrimoine",
            "movement_type": MovementType.INCOME,
            "scope": CategoryScope.REVENUE,
            "service_type": CaseType.MANDAT_FIDUCIAIRE,
            "sort_order": 1,
            "is_system": True,
        },
    )

    offer = ServiceOffer.objects.get(case_type=CaseType.MANDAT_FIDUCIAIRE)
    rule = offer.billing_rules.filter(
        formula="MANAGEMENT_FEE_AUM",
        base_max__gte=Decimal("100000000"),
        base_min__lte=Decimal("100000000"),
    ).first()
    assert rule is not None

    overview = api.get(reverse("case-billing-overview", kwargs={"case_pk": case.pk}))
    assert overview.status_code == 200
    assert overview.json()["aum"]["total_estimated_value"] == "100000000.00"

    created = api.post(
        reverse("case-billing-charge-create", kwargs={"case_pk": case.pk}),
        {
            "billing_rule_id": rule.pk,
            "period_label": "2026",
            "post": True,
        },
        format="json",
    )
    assert created.status_code == 201
    payload = created.json()
    assert len(payload["charges"]) == 1
    charge = payload["charges"][0]
    assert charge["status"] == "POSTED"
    assert Decimal(charge["amount"]) == Decimal("3000000.00")  # 3% of 100M (tranche ≤100M)
    assert charge["enterprise_movement_id"] is not None
