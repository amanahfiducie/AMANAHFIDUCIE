import pytest
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import RoleAssignment, UserRole
from assets.models import Asset, AssetType, AssetValuation
from cases.models import CaseStatus, CaseType, FiduciaryCase
from finance.models import CategoryScope, MovementCategory, MovementType
from services.models import ServiceOffer

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def _dir_user():
    user = User.objects.create_user(
        username="dir_ops",
        email="dir_ops@example.com",
        password="Passw0rd!",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.DIRECTION)
    return user


def _active_mandat_case(user):
    case = FiduciaryCase.objects.create(
        reference="REF-2026-OPS01",
        case_type=CaseType.MANDAT_FIDUCIAIRE,
        title="Dossier ops facturation",
        status=CaseStatus.ACTIVE,
        created_by=user,
    )
    asset = Asset.objects.create(
        case=case,
        asset_type=AssetType.REAL_ESTATE,
        label="Immeuble ops",
        currency="XOF",
        created_by=user,
    )
    AssetValuation.objects.create(
        asset=asset,
        value=Decimal("50000000"),
        currency="XOF",
        valued_at="2026-01-15",
        created_by=user,
    )
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
    return case


@pytest.mark.django_db
def test_service_lists_billed_cases(api):
    user = _dir_user()
    api.force_authenticate(user=user)
    case = _active_mandat_case(user)

    response = api.get(
        reverse("service-cases", kwargs={"case_type": CaseType.MANDAT_FIDUCIAIRE})
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] >= 1
    refs = {c["reference"] for c in payload["cases"]}
    assert case.reference in refs


@pytest.mark.django_db
def test_generate_periodic_billing_and_pdf(api):
    user = _dir_user()
    api.force_authenticate(user=user)
    case = _active_mandat_case(user)
    offer = ServiceOffer.objects.get(case_type=CaseType.MANDAT_FIDUCIAIRE)
    rule = offer.billing_rules.filter(
        formula="MANAGEMENT_FEE_AUM",
        rate_percent=Decimal("3.000"),
    ).first()
    assert rule is not None

    generated = api.post(
        reverse(
            "service-billing-generate",
            kwargs={"case_type": CaseType.MANDAT_FIDUCIAIRE},
        ),
        {
            "period_label": "2026",
            "rule_ids": [rule.pk],
            "case_ids": [case.pk],
            "post": False,
        },
        format="json",
    )
    assert generated.status_code == 200
    body = generated.json()
    assert body["summary"]["created"] == 1
    assert body["summary"]["errors"] == 0

    # Idempotent skip
    again = api.post(
        reverse(
            "service-billing-generate",
            kwargs={"case_type": CaseType.MANDAT_FIDUCIAIRE},
        ),
        {
            "period_label": "2026",
            "rule_ids": [rule.pk],
            "case_ids": [case.pk],
        },
        format="json",
    )
    assert again.status_code == 200
    assert again.json()["summary"]["skipped"] == 1
    assert again.json()["summary"]["created"] == 0

    overview = api.get(
        reverse("case-billing-overview", kwargs={"case_pk": case.pk})
    )
    charge_id = overview.json()["charges"][0]["id"]

    pdf = api.get(
        reverse(
            "case-billing-charge-pdf",
            kwargs={"case_pk": case.pk, "charge_pk": charge_id},
        )
    )
    assert pdf.status_code == 200
    assert pdf["Content-Type"] == "application/pdf"
    assert pdf.content[:4] == b"%PDF"

    invoices = api.get(reverse("billing-invoices"))
    assert invoices.status_code == 200
    # Liste des factures période (vide ici — charges unitaires legacy)
    assert isinstance(invoices.json()["results"], list)
