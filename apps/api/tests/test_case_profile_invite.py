import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import ProfileUserAccessRequest, ProfileUserAccessRequestStatus, RoleAssignment, UserRole
from beneficiaries.models import Beneficiary, CaseDonor, Guardian
from cases.models import CaseOrigin, CaseStakeholder, FiduciaryCase, StakeholderRole

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture
def admin_user(db):
    u = User.objects.create_user(
        username="admincase",
        password="pw12345678",
        email="admincase@example.com",
    )
    RoleAssignment.objects.create(user=u, role=UserRole.SUPER_ADMIN)
    return u


@pytest.fixture
def agent_user(db):
    u = User.objects.create_user(
        username="agentcase",
        password="pw12345678",
        email="agent@example.com",
    )
    RoleAssignment.objects.create(user=u, role=UserRole.AGENT_FIDUCIAIRE)
    return u


@pytest.fixture
def sample_case_with_donor(admin_user):
    case = FiduciaryCase.objects.create(
        reference="REF-2026-00099",
        title="Dossier test",
        case_origin=CaseOrigin.NOTARY,
        created_by=admin_user,
        status="DRAFT",
    )
    CaseStakeholder.objects.create(
        case=case, user=admin_user, role=StakeholderRole.FIDUCIARY_AGENT
    )
    donor = CaseDonor.objects.create(
        case=case,
        first_name="Awa",
        last_name="Diallo",
        email="awa@example.com",
        phone="+221771234567",
    )
    return case, donor


@pytest.mark.django_db
def test_auto_provision_on_guardian_create(api, admin_user, agent_user, sample_case_with_donor, monkeypatch):
    monkeypatch.setattr(
        "accounts.emails.send_case_profile_invite_email",
        lambda **kwargs: None,
    )
    case, _ = sample_case_with_donor
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(agent_user).access_token}")
    r = api.post(
        f"/api/v1/cases/{case.pk}/guardians/",
        {
            "first_name": "Moussa",
            "last_name": "Ba",
            "email": "moussa@example.com",
            "phone": "+221779999999",
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    guardian = Guardian.objects.get(case=case, email="moussa@example.com")
    assert guardian.user_id is not None
    assert guardian.user.username.startswith("T_moussa_ba_")
    assert CaseStakeholder.objects.filter(case=case, user=guardian.user).exists()
    assert not ProfileUserAccessRequest.objects.filter(
        case=case,
        profile_type="guardian",
        status=ProfileUserAccessRequestStatus.PENDING,
    ).exists()


@pytest.mark.django_db
def test_minor_beneficiary_not_queued(
    api, admin_user, agent_user, sample_case_with_donor, monkeypatch
):
    monkeypatch.setattr(
        "accounts.emails.send_case_profile_invite_email",
        lambda **kwargs: None,
    )
    case, donor = sample_case_with_donor
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(agent_user).access_token}")
    r = api.post(
        f"/api/v1/cases/{case.pk}/beneficiaries/",
        {
            "first_name": "Enfant",
            "last_name": "Diallo",
            "is_minor": True,
            "donor": donor.pk,
            "new_guardian": {
                "first_name": "Tuteur",
                "last_name": "Legal",
                "email": "tuteur@example.com",
                "phone": "+221771111111",
            },
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    assert not ProfileUserAccessRequest.objects.filter(
        profile_type="beneficiary",
        status=ProfileUserAccessRequestStatus.PENDING,
    ).exists()
    guardian = Guardian.objects.get(case=case, email="tuteur@example.com")
    assert guardian.user_id is not None
    assert guardian.user.username.startswith("T_tuteur_legal_")


@pytest.mark.django_db
def test_admin_lists_and_approves_request(api, admin_user, sample_case_with_donor, monkeypatch):
    case, _ = sample_case_with_donor
    guardian = Guardian.objects.create(
        case=case,
        first_name="Moussa",
        last_name="Ba",
        email="moussa@example.com",
        phone="+221779999999",
    )
    req = ProfileUserAccessRequest.objects.create(
        case=case,
        profile_type="guardian",
        profile_id=guardian.pk,
        display_name="Moussa Ba",
        email="moussa@example.com",
        phone="+221779999999",
        preview_status="no_user",
        requested_by=admin_user,
    )
    monkeypatch.setattr(
        "accounts.emails.send_case_profile_invite_email",
        lambda **kwargs: None,
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin_user).access_token}")
    listing = api.get("/api/v1/user-access-requests/?status=PENDING")
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    approved = api.post(
        reverse("user-access-request-approve", kwargs={"pk": req.pk}),
        {"email": "moussa@example.com"},
        format="json",
    )
    assert approved.status_code == 200, approved.content
    req.refresh_from_db()
    assert req.status == ProfileUserAccessRequestStatus.APPROVED
    guardian.refresh_from_db()
    assert guardian.user_id is not None
    assert guardian.user.username.startswith("T_moussa_ba_")
    assert guardian.user.username.endswith(f"_{guardian.user_id}")


@pytest.mark.django_db
def test_adult_beneficiary_queued(api, admin_user, agent_user, sample_case_with_donor):
    case, donor = sample_case_with_donor
    Beneficiary.objects.create(
        case=case,
        donor=donor,
        first_name="Adulte",
        last_name="Heritier",
        is_minor=False,
    )
    from accounts.case_profile_invite import enqueue_profile_access_request

    b = Beneficiary.objects.get(case=case, first_name="Adulte")
    req = enqueue_profile_access_request(
        case, "beneficiary", b.pk, requested_by=agent_user
    )
    assert req is not None
    assert req.profile_type == "beneficiary"
