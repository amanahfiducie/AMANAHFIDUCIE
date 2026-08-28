import pytest
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.models import RoleAssignment, UserRole
from assets.models import Asset, AssetType, AssetValuation
from cases.models import CaseStatus, CaseType, FiduciaryCase
from finance.models import CategoryScope, MovementCategory, MovementType

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def _dir_user():
    user = User.objects.create_user(
        username="dir_inv",
        email="dir_inv@example.com",
        password="Passw0rd!",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.DIRECTION)
    return user


def _active_mandat_case(user):
    case = FiduciaryCase.objects.create(
        reference="REF-2026-INV01",
        case_type=CaseType.MANDAT_FIDUCIAIRE,
        title="Dossier facture période",
        status=CaseStatus.ACTIVE,
        created_by=user,
    )
    asset = Asset.objects.create(
        case=case,
        asset_type=AssetType.REAL_ESTATE,
        label="Immeuble",
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
def test_period_invoice_preview_compose_validate(api):
    user = _dir_user()
    api.force_authenticate(user=user)
    case = _active_mandat_case(user)

    preview = api.get(
        reverse("billing-invoices-preview"),
        {"case_id": case.pk, "period_label": "2026"},
    )
    assert preview.status_code == 200
    body = preview.json()
    assert body["service"]["case_type"] == CaseType.MANDAT_FIDUCIAIRE
    assert len(body["lines"]) >= 1
    aum_line = next(
        l for l in body["lines"] if l["formula"] == "MANAGEMENT_FEE_AUM"
    )
    assert aum_line["selected"] is True
    assert Decimal(aum_line["amount"]) == Decimal("1500000.00")

    # Désélectionner les forfaits, garder AUM, ajuster le prix
    lines_payload = []
    for line in body["lines"]:
        selected = line["formula"] == "MANAGEMENT_FEE_AUM"
        lines_payload.append(
            {
                "billing_rule_id": line["billing_rule_id"],
                "formula": line["formula"],
                "label": line["label"],
                "amount": "1400000" if selected else line["amount"],
                "rate_percent": line["rate_percent"],
                "base_amount": line["base_amount"],
                "selected": selected,
            }
        )

    created = api.post(
        reverse("billing-invoices"),
        {"case_id": case.pk, "period_label": "2026", "lines": lines_payload},
        format="json",
    )
    assert created.status_code == 201
    invoice = created.json()
    assert invoice["status"] == "DRAFT"
    assert Decimal(invoice["amount"]) == Decimal("1400000.00")
    assert sum(1 for l in invoice["lines"] if l["is_selected"]) == 1

    posted = api.post(
        reverse("billing-invoice-post", kwargs={"invoice_pk": invoice["id"]}),
        {},
        format="json",
    )
    assert posted.status_code == 200
    assert posted.json()["status"] == "POSTED"
    assert posted.json()["enterprise_movement_id"] is not None

    # CA comptable = facture validée (mouvement APPROVED lié)
    from finance.models import EnterpriseMovement, MovementStatus

    movement = EnterpriseMovement.objects.get(pk=posted.json()["enterprise_movement_id"])
    assert movement.status == MovementStatus.APPROVED

    summary = api.get(reverse("enterprise-summary"), {"year": "2026"})
    assert summary.status_code == 200
    perf = summary.json()["performance"]
    assert Decimal(perf["chiffre_affaires"]) == Decimal("1400000.00")
    assert perf.get("revenue_source") == "invoices"

    pdf = api.get(
        reverse("billing-invoice-pdf", kwargs={"invoice_pk": invoice["id"]})
    )
    assert pdf.status_code == 200
    assert pdf.content[:4] == b"%PDF"


@pytest.mark.django_db
def test_period_invoice_manual_lines(api):
    user = _dir_user()
    api.force_authenticate(user=user)
    case = _active_mandat_case(user)

    created = api.post(
        reverse("billing-invoices"),
        {
            "case_id": case.pk,
            "period_label": "2026-MANUAL",
            "lines": [
                {
                    "billing_rule_id": None,
                    "formula": "OTHER",
                    "label": "Honoraires de conseil",
                    "amount": "250000",
                    "selected": True,
                },
                {
                    "formula": "OTHER",
                    "label": "Frais de dossier",
                    "amount": "50000",
                    "selected": True,
                },
            ],
        },
        format="json",
    )
    assert created.status_code == 201
    invoice = created.json()
    assert Decimal(invoice["amount"]) == Decimal("300000.00")
    assert all(l["billing_rule_id"] is None for l in invoice["lines"])
    assert {l["label"] for l in invoice["lines"]} == {
        "Honoraires de conseil",
        "Frais de dossier",
    }

    posted = api.post(
        reverse("billing-invoice-post", kwargs={"invoice_pk": invoice["id"]}),
        {},
        format="json",
    )
    assert posted.status_code == 200
    assert posted.json()["status"] == "POSTED"
    assert Decimal(posted.json()["amount"]) == Decimal("300000.00")
