import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from mandates.models import MandateValidationDecision

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_m",
        password="pw12345678",
        email="agent_m@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.fixture
def juridique(db):
    user = User.objects.create_user(
        username="juridique1",
        password="pw12345678",
        email="juridique1@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.JURIDIQUE_CONFORMITE)
    return user


@pytest.mark.django_db
def test_complete_case_with_mandate_beneficiary_guardian(api, agent, juridique):
    auth(api, agent)
    case = api.post(
        reverse("case-list"),
        {"title": "Dossier complet Diallo"},
        format="json",
    ).json()
    case_id = case["id"]

    mandate = api.post(
        reverse("case-mandate-list", kwargs={"case_pk": case_id}),
        {
            "mandate_type": "JUDICIAL",
            "title": "Ordonnance tribunal",
            "reference_number": "ORD-2026-01",
        },
        format="json",
    )
    assert mandate.status_code == 201, mandate.content

    beneficiary = api.post(
        reverse("case-beneficiary-list", kwargs={"case_pk": case_id}),
        {
            "first_name": "Aminata",
            "last_name": "Diallo",
            "is_minor": True,
            "new_guardian": {
                "first_name": "Ibrahim",
                "last_name": "Diallo",
                "relationship_label": "Tuteur légal",
            },
        },
        format="json",
    )
    assert beneficiary.status_code == 201, beneficiary.content
    assert beneficiary.json()["guardian_name"] == "Ibrahim Diallo"

    detail = api.get(reverse("case-detail", kwargs={"pk": case_id}))
    assert detail.status_code == 200
    body = detail.json()
    assert len(body["mandates"]) == 1
    assert len(body["beneficiaries"]) == 1
    assert len(body["guardians"]) == 1
    assert body["beneficiaries"][0]["guardian"] == body["guardians"][0]["id"]

    mandate_id = mandate.json()["id"]
    auth(api, juridique)
    validation = api.post(
        reverse("mandate-validate", kwargs={"pk": mandate_id}),
        {"decision": MandateValidationDecision.APPROVED, "comment": "Conforme"},
        format="json",
    )
    assert validation.status_code == 201, validation.content
    assert validation.json()["decision"] == MandateValidationDecision.APPROVED


@pytest.mark.django_db
def test_patch_beneficiary(api, agent):
    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Patch test"},
        format="json",
    ).json()["id"]
    ben_id = api.post(
        reverse("case-beneficiary-list", kwargs={"case_pk": case_id}),
        {"first_name": "Old", "last_name": "Name"},
        format="json",
    ).json()["id"]
    updated = api.patch(
        reverse("beneficiary-detail", kwargs={"pk": ben_id}),
        {"first_name": "New"},
        format="json",
    )
    assert updated.status_code == 200
    assert updated.json()["first_name"] == "New"


@pytest.mark.django_db
def test_beneficiary_patrimony_share(api, agent):
    from assets.models import Asset, AssetValuation
    from datetime import date
    from decimal import Decimal

    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"title": "Patrimoine parts"},
        format="json",
    ).json()["id"]
    asset = Asset.objects.create(
        case_id=case_id,
        asset_type="CASH",
        label="Liquidités",
        created_by=agent,
    )
    AssetValuation.objects.create(
        asset=asset,
        value=Decimal("1000000"),
        currency="XOF",
        valued_at=date.today(),
        created_by=agent,
    )
    ben = api.post(
        reverse("case-beneficiary-list", kwargs={"case_pk": case_id}),
        {
            "first_name": "Part",
            "last_name": "Test",
            "patrimony_share_percent": "25",
        },
        format="json",
    )
    assert ben.status_code == 201, ben.content
    body = ben.json()
    assert body["patrimony_share_percent"] == "25.0000"
    assert body["case_patrimony_total"] == "1000000.00"
    assert body["patrimony_share_value"] == "250000.00"


@pytest.mark.django_db
def test_succession_indirect_beneficiary_via_parent(api, agent):
    from cases.models import CaseType

    auth(api, agent)
    case_id = api.post(
        reverse("case-list"),
        {"case_type": CaseType.SUCCESSION, "title": "Succession indirecte"},
        format="json",
    ).json()["id"]
    donor_id = api.post(
        reverse("case-donor-list", kwargs={"case_pk": case_id}),
        {"first_name": "Mamadou", "last_name": "Fall"},
        format="json",
    ).json()["id"]
    child_id = api.post(
        reverse("case-beneficiary-list", kwargs={"case_pk": case_id}),
        {
            "donor": donor_id,
            "first_name": "Fatou",
            "last_name": "Fall",
            "relation_to_donor": "CHILD",
            "gender": "F",
        },
        format="json",
    ).json()["id"]

    grandchild = api.post(
        reverse("case-beneficiary-list", kwargs={"case_pk": case_id}),
        {
            "donor": donor_id,
            "first_name": "Awa",
            "last_name": "Fall",
            "relation_to_donor": "OTHER",
            "father_id": child_id,
            "notes": "Petit-enfant (descendant d'un héritier)",
        },
        format="json",
    )
    assert grandchild.status_code == 201, grandchild.content
    assert grandchild.json()["relation_to_donor"] == "OTHER"
    assert grandchild.json()["father"] == child_id

    missing_parent = api.post(
        reverse("case-beneficiary-list", kwargs={"case_pk": case_id}),
        {
            "donor": donor_id,
            "first_name": "Sans",
            "last_name": "Parent",
            "relation_to_donor": "OTHER",
        },
        format="json",
    )
    assert missing_parent.status_code == 400
    assert "father_id" in missing_parent.json()
