import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserRole
from beneficiaries.models import CaseDonor, DonorTrustedPerson
from cases.models import CaseType, FiduciaryCase

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


def auth(api: APIClient, user) -> None:
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(user).access_token}")


@pytest.fixture
def agent(db):
    user = User.objects.create_user(
        username="agent_trusted",
        password="pw12345678",
        email="agent_trusted@example.com",
    )
    RoleAssignment.objects.create(user=user, role=UserRole.AGENT_FIDUCIAIRE)
    return user


@pytest.mark.django_db
def test_create_trusted_person_and_onboarding_step(api, agent):
    auth(api, agent)
    case = FiduciaryCase.objects.create(
        reference="TRUST-001",
        title="Dossier confiance",
        case_type=CaseType.MANDAT_FIDUCIAIRE,
        created_by=agent,
    )
    case.stakeholders.create(user=agent, role="FIDUCIARY_AGENT")
    donor = CaseDonor.objects.create(case=case, first_name="Ali", last_name="Ndiaye")

    response = api.post(
        reverse("donor-trusted-person-list", kwargs={"case_pk": case.pk, "donor_pk": donor.pk}),
        {
            "first_name": "Mariam",
            "last_name": "Ndiaye",
            "phone": "+221771234567",
            "email": "mariam@example.com",
            "relationship_label": "Épouse",
        },
        format="json",
    )
    assert response.status_code == 201, response.content
    assert DonorTrustedPerson.objects.filter(donor=donor).count() == 1

    step = api.post(
        reverse("case-complete-onboarding-step", kwargs={"pk": case.pk}),
        {"step_id": "donor_trusted"},
        format="json",
    )
    assert step.status_code == 200
    progress = step.json()
    trusted = next(s for s in progress["steps"] if s["id"] == "donor_trusted")
    assert trusted["status"] == "completed"


@pytest.mark.django_db
def test_onboarding_schema_includes_donor_trusted(api, agent):
    auth(api, agent)
    response = api.get(reverse("case-onboarding-schema"))
    assert response.status_code == 200
    mandat = next(t for t in response.json()["case_types"] if t["id"] == CaseType.MANDAT_FIDUCIAIRE)
    step_ids = [s["id"] for s in mandat["steps"]]
    assert "donor_trusted" in step_ids
    trusted_def = next(s for s in mandat["steps"] if s["id"] == "donor_trusted")
    assert trusted_def["required"] is True
    assert trusted_def["skippable"] is False
