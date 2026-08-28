import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from cases.models import CaseType, FiduciaryCase
from beneficiaries.models import CaseDonor, DonorTrustedPerson
from mandates.models import Mandate

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_onb",
        password="pw12345678",
        email="agent_onb@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_onboarding_schema(api, agent):
    auth(api, agent)
    response = api.get(reverse("case-onboarding-schema"))
    assert response.status_code == 200
    data = response.json()
    assert len(data["case_types"]) == 5
    types = {t["id"] for t in data["case_types"]}
    assert CaseType.TUTELLE_CANTONNEMENT in types


@pytest.mark.django_db
def test_submit_blocked_until_onboarding_complete(api, agent):
    auth(api, agent)
    created = api.post(
        reverse("case-list"),
        {
            "case_type": CaseType.MANDAT_FIDUCIAIRE,
            "title": "Dossier incomplet",
            "description": "Test",
        },
        format="json",
    ).json()

    submit = api.post(reverse("case-submit", kwargs={"pk": created["id"]}))
    assert submit.status_code == 400
    details = submit.json().get("details", [])
    assert any(d.get("field") == "onboarding" for d in details)


@pytest.mark.django_db
def test_complete_onboarding_and_submit(api, agent):
    auth(api, agent)
    created = api.post(
        reverse("case-list"),
        {
            "case_type": CaseType.MANDAT_FIDUCIAIRE,
            "title": "Mandat test",
            "description": "Desc",
        },
        format="json",
    ).json()
    case_id = created["id"]
    case = FiduciaryCase.objects.get(pk=case_id)

    donor = CaseDonor.objects.create(case=case, first_name="Omar", last_name="Ba")
    DonorTrustedPerson.objects.create(
        donor=donor,
        first_name="Fatou",
        last_name="Ba",
        phone="+221771111111",
        email="fatou@example.com",
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "donor"},
        format="json",
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "donor_trusted"},
        format="json",
    )

    Mandate.objects.create(
        case=case,
        mandate_type="FAMILY",
        title="Mandat familial",
        created_by=agent,
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "mandate"},
        format="json",
    )

    from assets.models import Asset

    Asset.objects.create(
        case=case,
        asset_type="CASH",
        label="Compte courant",
        currency="XOF",
        created_by=agent,
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "patrimoine"},
        format="json",
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "review"},
        format="json",
    )

    submit = api.post(reverse("case-submit", kwargs={"pk": case_id}))
    assert submit.status_code == 200
    assert submit.json()["status"] == "UNDER_REVIEW"


@pytest.mark.django_db
def test_skip_patrimoine_and_submit_with_pending_tasks(api, agent):
    auth(api, agent)
    created = api.post(
        reverse("case-list"),
        {
            "case_type": CaseType.MANDAT_FIDUCIAIRE,
            "title": "Dossier report",
            "description": "Test",
        },
        format="json",
    ).json()
    case_id = created["id"]
    case = FiduciaryCase.objects.get(pk=case_id)

    donor = CaseDonor.objects.create(case=case, first_name="Fatou", last_name="Sow")
    DonorTrustedPerson.objects.create(
        donor=donor,
        first_name="Ibra",
        last_name="Sow",
        phone="+221772222222",
        email="ibra@example.com",
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "donor"},
        format="json",
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "donor_trusted"},
        format="json",
    )

    Mandate.objects.create(
        case=case,
        mandate_type="FAMILY",
        title="Mandat",
        created_by=agent,
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "mandate"},
        format="json",
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "patrimoine", "skip": True},
        format="json",
    )
    api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case_id}),
        {"step_id": "review"},
        format="json",
    )

    progress = api.get(reverse("case-onboarding", kwargs={"pk": case_id})).json()
    assert progress["can_submit"] is True
    assert len(progress["pending_tasks"]) >= 1
    patrimoine_task = next(t for t in progress["pending_tasks"] if t["id"] == "patrimoine")
    assert patrimoine_task["status"] == "skipped"

    submit = api.post(reverse("case-submit", kwargs={"pk": case_id}))
    assert submit.status_code == 200

    after = api.get(reverse("case-onboarding", kwargs={"pk": case_id})).json()
    assert len(after["pending_tasks"]) >= 1
