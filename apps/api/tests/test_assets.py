import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_assets",
        password="pw12345678",
        email="agent_assets@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_case_asset_inventory_and_patrimony_summary(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Patrimoine test"},
        format="json",
    ).json()["id"]

    asset = api.post(
        reverse("case-asset-list", kwargs={"case_pk": case_id}),
        {
            "asset_type": "REAL_ESTATE",
            "label": "Immeuble Plateau",
            "valuation_frequency": "QUARTERLY",
        },
        format="json",
    )
    assert asset.status_code == 201, asset.content
    asset_body = asset.json()
    asset_id = asset_body["id"]
    assert asset_body["valuation_frequency"] == "QUARTERLY"

    valuation = api.post(
        reverse("asset-valuations", kwargs={"pk": asset_id}),
        {
            "value": "150000000.00",
            "currency": "XOF",
            "valued_at": "2026-01-15",
            "method": "EXPERT",
        },
        format="json",
    )
    assert valuation.status_code == 201, valuation.content

    asset_after = api.get(reverse("asset-detail", kwargs={"pk": asset_id}))
    assert asset_after.status_code == 200
    assert asset_after.json()["valuation_next_due"] == "2026-04-15"

    risk = api.post(
        reverse("asset-risks", kwargs={"pk": asset_id}),
        {
            "risk_level": "MEDIUM",
            "category": "MARKET",
            "description": "Volatilité du marché immobilier",
            "identified_at": "2026-01-20",
        },
        format="json",
    )
    assert risk.status_code == 201, risk.content

    inventory = api.get(reverse("case-asset-list", kwargs={"case_pk": case_id}))
    assert inventory.status_code == 200
    assert len(inventory.json()) == 1
    assert inventory.json()[0]["latest_value"] == "150000000.00"

    summary = api.get(reverse("case-patrimony-summary", kwargs={"case_pk": case_id}))
    assert summary.status_code == 200
    body = summary.json()
    assert body["asset_count"] == 1
    assert body["total_estimated_value"] == "150000000.00"
    assert "REAL_ESTATE" in body["by_type"]

    detail = api.get(reverse("case-detail", kwargs={"pk": case_id}))
    assert len(detail.json()["assets"]) == 1


@pytest.mark.django_db
def test_patch_asset(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Patch asset"},
        format="json",
    ).json()["id"]
    asset_id = api.post(
        reverse("case-asset-list", kwargs={"case_pk": case_id}),
        {"asset_type": "CASH", "label": "Caisse"},
        format="json",
    ).json()["id"]
    updated = api.patch(
        reverse("asset-detail", kwargs={"pk": asset_id}),
        {"label": "Caisse principale"},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.json()["label"] == "Caisse principale"


@pytest.mark.django_db
def test_asset_event_justification_filename(agent, api):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Events rename test"},
        format="json",
    ).json()["id"]
    asset_id = api.post(
        reverse("case-asset-list", kwargs={"case_pk": case_id}),
        {"asset_type": "GOLD", "label": "Or"},
        format="json",
    ).json()["id"]
    from assets.models import Asset, AssetEvent
    from assets.serializers import AssetEventCreateSerializer
    from rest_framework.test import APIRequestFactory, force_authenticate

    asset = Asset.objects.get(pk=asset_id)
    pdf = SimpleUploadedFile(
        "justificatif.pdf",
        b"%PDF-1.4 test\n",
        content_type="application/pdf",
    )
    request = APIRequestFactory().post("/")
    force_authenticate(request, user=agent)
    serializer = AssetEventCreateSerializer(
        data={
            "event_type": "GAIN",
            "reference": "RENT",
            "amount": "500000",
            "event_date": "2026-01-15",
            "justification_file": pdf,
        },
        context={"request": request, "asset": asset},
    )
    assert serializer.is_valid(), serializer.errors
    event = AssetEvent.objects.create(
        asset=asset,
        created_by=agent,
        **serializer.validated_data,
    )
    filename = event.justification_file.name.split("/")[-1]
    assert filename.endswith(".pdf")
    assert "2026-01-15" in filename
    assert "loyer" in filename.lower() or "revenu" in filename.lower()


@pytest.mark.django_db
def test_asset_events_crud_and_cancel(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Events test"},
        format="json",
    ).json()["id"]
    asset_id = api.post(
        reverse("case-asset-list", kwargs={"case_pk": case_id}),
        {"asset_type": "GOLD", "label": "Or"},
        format="json",
    ).json()["id"]

    pdf = SimpleUploadedFile(
        "justificatif.pdf",
        b"%PDF-1.4 test justification\n",
        content_type="application/pdf",
    )
    created = api.post(
        reverse("asset-events", kwargs={"pk": asset_id}),
        {
            "event_type": "GAIN",
            "reference": "RENT",
            "description": "Loyer annuel",
            "amount": "500000",
            "event_date": "2026-01-15",
            "justification_file": pdf,
        },
        format="multipart",
    )
    assert created.status_code == 201, created.content
    event_id = created.json()["id"]
    filename = created.json()["justification_filename"] or ""
    assert filename.endswith(".pdf")
    assert "2026-01-15" in filename
    assert "loyer" in filename.lower() or "revenu" in filename.lower()

    listed = api.get(reverse("asset-events", kwargs={"pk": asset_id}))
    assert listed.status_code == 200
    assert len(listed.json()) == 1

    bad_patch = api.patch(
        reverse("asset-event-detail", kwargs={"pk": asset_id, "event_pk": event_id}),
        {"password": "wrong", "amount": "600000"},
        format="json",
    )
    assert bad_patch.status_code == 400

    ok_patch = api.patch(
        reverse("asset-event-detail", kwargs={"pk": asset_id, "event_pk": event_id}),
        {"password": "pw12345678", "amount": "600000"},
        format="json",
    )
    assert ok_patch.status_code == 200
    assert ok_patch.json()["amount"] == "600000.00"

    cancelled = api.post(
        reverse("asset-event-cancel", kwargs={"pk": asset_id, "event_pk": event_id}),
        {"password": "pw12345678"},
        format="json",
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "CANCELLED"

    active_only = api.get(reverse("asset-events", kwargs={"pk": asset_id}))
    assert len(active_only.json()) == 0

    api.post(
        reverse("asset-events", kwargs={"pk": asset_id}),
        {
            "event_type": "GAIN",
            "reference": "RENT",
            "amount": "600000",
            "event_date": "2026-03-01",
            "justification_file": SimpleUploadedFile(
                "loyer.pdf",
                b"%PDF-1.4\n",
                content_type="application/pdf",
            ),
        },
        format="multipart",
    )
    api.post(
        reverse("asset-events", kwargs={"pk": asset_id}),
        {
            "event_type": "EXPENSE",
            "expense_kind": "FIXED",
            "amount": "100000",
            "event_date": "2026-02-01",
            "justification_file": SimpleUploadedFile(
                "charges.pdf",
                b"%PDF-1.4\n",
                content_type="application/pdf",
            ),
        },
        format="multipart",
    )
    summary = api.get(reverse("case-patrimony-summary", kwargs={"case_pk": case_id}))
    assert summary.status_code == 200
    body = summary.json()
    assert body["total_gains"] == "600000.00"
    assert body["total_expenses"] == "100000.00"
    assert body["net_benefit"] == "500000.00"
