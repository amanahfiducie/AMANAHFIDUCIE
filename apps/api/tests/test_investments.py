import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
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
        username="agent_invest",
        password="pw12345678",
        email="agent_invest@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_investment_catalog_and_case_dashboard(api, agent):
    auth(api, agent)

    catalog = api.get(reverse("investment-catalog"))
    assert catalog.status_code == 200
    body = catalog.json()
    assert len(body["asset_classes"]) >= 5
    assert len(body["patrimony_categories"]) == 4
    assert len(body["management_profiles"]) == 4

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Tutelle mineurs",
            "case_type": CaseType.TUTELLE_CANTONNEMENT,
        },
        format="json",
    ).json()["id"]

    dashboard = api.get(reverse("case-investment-dashboard", kwargs={"case_pk": case_id}))
    assert dashboard.status_code == 200
    dash = dashboard.json()
    assert dash["case_type"] == CaseType.TUTELLE_CANTONNEMENT
    assert dash["policy"]["patrimony_category"]["code"] == "A"
    assert dash["policy"]["management_profile"]["slug"] == "amanah-protection"

    asset_class = InvestmentAssetClass.objects.get(slug="sukuk")
    created = api.post(
        reverse("case-investment-list", kwargs={"case_pk": case_id}),
        {
            "asset_class_id": asset_class.id,
            "label": "Sukuk souverain Sénégal",
            "amount_invested": "5000000.00",
            "current_value": "5150000.00",
            "start_date": "2026-01-15",
            "status": "ACTIVE",
            "annual_yield_percent": "5.50",
            "sharia_compliance_score": "95.00",
        },
        format="json",
    )
    assert created.status_code == 201, created.content

    overview = api.get(reverse("investments-overview"))
    assert overview.status_code == 200
    assert overview.json()["totals"]["investment_count"] >= 1

    dash_after = api.get(reverse("case-investment-dashboard", kwargs={"case_pk": case_id}))
    assert dash_after.json()["summary"]["asset_count"] == 1
    charts = dash_after.json()["charts"]
    assert len(charts["patrimony_evolution"]) == 1
    assert len(charts["patrimony_evolution_by_asset_class"]) == 2
    slugs = {s["slug"] for s in charts["patrimony_evolution_by_asset_class"]}
    assert "sukuk" in slugs
    assert "general" in slugs
    assert charts["patrimony_evolution_by_asset_class"][0]["slug"] == "sukuk"
    assert Investment.objects.filter(case_id=case_id).count() == 1


@pytest.mark.django_db
def test_investment_not_eligible_for_succession(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Succession test",
            "case_type": CaseType.SUCCESSION,
        },
        format="json",
    ).json()["id"]

    response = api.get(reverse("case-investment-dashboard", kwargs={"case_pk": case_id}))
    assert response.status_code == 400

    category_count = PatrimonyInvestmentCategory.objects.count()
    assert category_count == 4


@pytest.mark.django_db
def test_planned_investment_amount_updates_global_dashboard(api, agent):
    auth(api, agent)

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Mandat PIGFI",
            "case_type": CaseType.MANDAT_FIDUCIAIRE,
        },
        format="json",
    ).json()["id"]

    patch = api.patch(
        reverse("case-investment-policy", kwargs={"case_pk": case_id}),
        {"planned_investment_amount": "200000000.00"},
        format="json",
    )
    assert patch.status_code == 200, patch.content

    dashboard = api.get(reverse("investments-global-dashboard"))
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["stats"]["total_planned_envelope"] == "200000000.00"
    assert body["stats"]["remaining_planned_envelope"] == "200000000.00"
    assert body["stats"]["uninvested_amount"] == "200000000.00"

    case_row = next(c for c in body["cases"] if c["id"] == case_id)
    assert case_row["planned_investment_amount"] == "200000000.00"


@pytest.mark.django_db
def test_investment_capital_uses_planned_amount(api, agent):
    """Le plafond client d'investissement suit la somme à investir (Gestion)."""
    from beneficiaries.models import Beneficiary

    auth(api, agent)

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Famille avec enveloppe",
            "case_type": CaseType.TUTELLE_CANTONNEMENT,
        },
        format="json",
    ).json()["id"]

    Beneficiary.objects.create(
        case_id=case_id,
        first_name="Awa",
        last_name="Ndiaye",
        patrimony_share_percent="100",
    )

    patch = api.patch(
        reverse("case-investment-policy", kwargs={"case_pk": case_id}),
        {"planned_investment_amount": "200000000.00"},
        format="json",
    )
    assert patch.status_code == 200, patch.content

    capital = api.get(reverse("case-investment-capital", kwargs={"case_pk": case_id}))
    assert capital.status_code == 200, capital.content
    body = capital.json()
    assert len(body["beneficiaries"]) == 1
    client = body["beneficiaries"][0]
    assert float(client["available_amount"]) == 200_000_000.0
    assert float(body["patrimony_total"]) == 200_000_000.0

    category = PatrimonyInvestmentCategory.objects.get(code="A")
    asset_class = InvestmentAssetClass.objects.get(slug="immobilier")
    created = api.post(
        reverse("case-investment-list", kwargs={"case_pk": case_id}),
        {
            "asset_class_id": asset_class.id,
            "label": "Immeuble Dakar",
            "amount_invested": "60000000.00",
            "current_value": "60000000.00",
            "start_date": "2026-03-01",
            "status": "PENDING_VALIDATION",
            "participants": [
                {
                    "beneficiary_id": client["beneficiary_id"],
                    "patrimony_category_id": category.id,
                    "allocated_amount": "60000000.00",
                }
            ],
        },
        format="json",
    )
    assert created.status_code == 201, created.content


@pytest.mark.django_db
def test_create_case_level_investment_without_participants(api, agent):
    """Le client est le dossier : investissement sans parts bénéficiaires."""
    auth(api, agent)

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Famille Ndiaye",
            "case_type": CaseType.TUTELLE_CANTONNEMENT,
        },
        format="json",
    ).json()["id"]

    patch = api.patch(
        reverse("case-investment-policy", kwargs={"case_pk": case_id}),
        {"planned_investment_amount": "200000000.00"},
        format="json",
    )
    assert patch.status_code == 200, patch.content

    asset_class = InvestmentAssetClass.objects.get(slug="immobilier")
    created = api.post(
        reverse("case-investment-list", kwargs={"case_pk": case_id}),
        {
            "asset_class_id": asset_class.id,
            "label": "Immeuble Dakar",
            "amount_invested": "60000000.00",
            "current_value": "60000000.00",
            "start_date": "2026-03-01",
            "status": "PENDING_VALIDATION",
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    assert created.json()["amount_invested"] == "60000000.00"


@pytest.mark.django_db
def test_investment_envelope_save_without_clients_then_allocate(api, agent):
    auth(api, agent)

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Famille Ndiaye",
            "case_type": CaseType.TUTELLE_CANTONNEMENT,
        },
        format="json",
    ).json()["id"]

    api.patch(
        reverse("case-investment-policy", kwargs={"case_pk": case_id}),
        {"planned_investment_amount": "200000000.00"},
        format="json",
    )

    asset_class = InvestmentAssetClass.objects.get(slug="immobilier")
    created = api.post(
        reverse("investment-envelope-create"),
        {
            "asset_class_id": asset_class.id,
            "label": "Immeuble Plateau",
            "amount_invested": "60000000.00",
            "start_date": "2026-04-01",
            "allocations": [],
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    body = created.json()
    assert body["is_envelope"] is True
    assert body["is_allocation_complete"] is False
    assert float(body["allocation_progress_percent"]) == 0.0

    allocated = api.post(
        reverse("investment-allocate", kwargs={"pk": body["id"]}),
        {"case_id": case_id, "amount": "60000000.00"},
        format="json",
    )
    assert allocated.status_code == 201, allocated.content
    done = allocated.json()
    assert done["is_allocation_complete"] is True
    assert float(done["allocation_progress_percent"]) == 100.0


@pytest.mark.django_db
def test_investment_valuation_history_and_evolution(api, agent):
    auth(api, agent)

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Valuation test",
            "case_type": CaseType.MANDAT_FIDUCIAIRE,
        },
        format="json",
    ).json()["id"]

    asset_class = InvestmentAssetClass.objects.get(slug="sukuk")
    created = api.post(
        reverse("investment-envelope-create"),
        {
            "asset_class_id": asset_class.id,
            "label": "Sukuk test estimations",
            "amount_invested": "10000000.00",
            "start_date": "2026-01-01",
            "allocations": [],
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    inv_id = created.json()["id"]

    valuation = api.post(
        reverse("investment-valuation-create", kwargs={"pk": inv_id}),
        {
            "value": "10500000.00",
            "valued_at": "2026-03-01",
            "notes": "Première estimation",
        },
        format="json",
    )
    assert valuation.status_code == 201, valuation.content

    detail = api.get(reverse("investment-detail", kwargs={"pk": inv_id}))
    assert detail.status_code == 200
    body = detail.json()
    assert len(body["valuation_history"]) == 1
    assert body["latest_valuation_date"] == "2026-03-01"
    assert body["current_value"] == "10500000.00"
    evolution = body["valuation_evolution"]
    assert evolution["window_months"] == 12
    assert len(evolution["points"]) >= 2
    assert evolution["end_value"] == "10500000.00"


@pytest.mark.django_db
def test_young_investment_chart_starts_at_activity(api, agent, monkeypatch):
    from datetime import date

    from django.utils import timezone

    monkeypatch.setattr(timezone, "localdate", lambda: date(2026, 7, 16))

    auth(api, agent)

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Young investment",
            "case_type": CaseType.MANDAT_FIDUCIAIRE,
        },
        format="json",
    ).json()["id"]

    asset_class = InvestmentAssetClass.objects.get(slug="sukuk")
    created = api.post(
        reverse("investment-envelope-create"),
        {
            "asset_class_id": asset_class.id,
            "label": "Investissement récent",
            "amount_invested": "5000000.00",
            "start_date": "2026-04-01",
            "allocations": [],
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    inv_id = created.json()["id"]

    api.post(
        reverse("investment-valuation-create", kwargs={"pk": inv_id}),
        {
            "value": "5200000.00",
            "valued_at": "2026-06-01",
            "notes": "Estimation récente",
        },
        format="json",
    )

    evolution = api.get(reverse("investment-detail", kwargs={"pk": inv_id})).json()[
        "valuation_evolution"
    ]
    assert evolution["from_activity_start"] is True
    assert evolution["window_start"] == "2026-04-01"
    assert evolution["activity_start"] == "2026-04-01"
    assert evolution["points"][0]["date"] == "2026-04-01"


@pytest.mark.django_db
def test_asset_class_dashboard_dossier_allocation_donut(api, agent):
    auth(api, agent)

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Immobilier dossier",
            "case_type": CaseType.TUTELLE_CANTONNEMENT,
        },
        format="json",
    ).json()["id"]

    asset_class = InvestmentAssetClass.objects.get(slug="immobilier")
    created = api.post(
        reverse("investment-envelope-create"),
        {
            "asset_class_id": asset_class.id,
            "label": "Immeuble Almadies",
            "amount_invested": "15000000.00",
            "start_date": "2026-03-01",
            "allocations": [],
        },
        format="json",
    )
    assert created.status_code == 201, created.content
    inv_id = created.json()["id"]

    allocated = api.post(
        reverse("investment-allocate", kwargs={"pk": inv_id}),
        {"case_id": case_id, "amount": "15000000.00"},
        format="json",
    )
    assert allocated.status_code == 201, allocated.content

    dashboard = api.get(
        reverse("investment-category-dashboard", kwargs={"slug": "immobilier"})
    )
    assert dashboard.status_code == 200, dashboard.content
    allocation = dashboard.json()["stats"]["dossier_allocation"]
    assert allocation["total_allocated"] == "15000000.00"
    assert allocation["dossier_count"] == 1
    assert allocation["dossiers"][0]["case_id"] == case_id
    assert allocation["dossiers"][0]["amount"] == "15000000.00"

    stats = dashboard.json()["stats"]
    assert stats["total_allocated"] == "15000000.00"
    assert stats["allocation_progress_percent"] == 100.0
    assert stats["complete_allocation_count"] == 1
    assert stats["incomplete_allocation_count"] == 0


@pytest.mark.django_db
def test_envelope_contribution_adds_to_planned_amount_with_history(api, agent):
    """Ajouter une somme via le modal incrémente l'enveloppe et trace l'historique."""
    auth(api, agent)

    case_id = api.post(
        reverse("case-list"),
        {
            "title": "Dossier enveloppe",
            "case_type": CaseType.TUTELLE_CANTONNEMENT,
        },
        format="json",
    ).json()["id"]

    api.patch(
        reverse("case-investment-policy", kwargs={"case_pk": case_id}),
        {"planned_investment_amount": "100000000.00"},
        format="json",
    )

    added = api.post(
        reverse("case-envelope-contributions", kwargs={"case_pk": case_id}),
        {"amount": "50000000.00", "notes": "Apport complémentaire"},
        format="json",
    )
    assert added.status_code == 201, added.content
    policy = added.json()
    assert policy["planned_investment_amount"] == "150000000.00"
    assert len(policy["envelope_history"]) == 1
    entry = policy["envelope_history"][0]
    assert entry["amount"] == "50000000.00"
    assert entry["previous_total"] == "100000000.00"
    assert entry["new_total"] == "150000000.00"
    assert entry["notes"] == "Apport complémentaire"

    history = api.get(
        reverse("case-envelope-contributions", kwargs={"case_pk": case_id})
    )
    assert history.status_code == 200
    assert len(history.json()) == 1

    rejected = api.post(
        reverse("case-envelope-contributions", kwargs={"case_pk": case_id}),
        {"amount": "-1000.00"},
        format="json",
    )
    assert rejected.status_code == 400

