import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import ExternalPartyType, RoleAssignment, UserProfile, UserRole
from accounts.usernames import (
    assign_case_profile_username,
    build_case_profile_username,
    generate_unique_username,
    resolve_username_prefix,
)

User = get_user_model()


@pytest.mark.django_db
def test_resolve_prefix_heritier_and_tuteur():
    assert (
        resolve_username_prefix(
            [UserRole.FAMILLE_TUTEUR], party_type=ExternalPartyType.FAMILLE
        )
        == "H"
    )
    assert (
        resolve_username_prefix(
            [UserRole.FAMILLE_TUTEUR], party_type=ExternalPartyType.TUTEUR
        )
        == "T"
    )
    assert resolve_username_prefix([UserRole.JUGE]) == "G"
    assert resolve_username_prefix([UserRole.SUPER_ADMIN]) == "A"


@pytest.mark.django_db
def test_case_profile_username_format():
    assert build_case_profile_username("guardian", "Moussa", "Ba", 12) == "T_moussa_ba_12"
    assert build_case_profile_username("beneficiary", "Awa", "Diallo", 7) == "H_awa_diallo_7"
    user = User.objects.create_user(
        username="pending_guardian_1",
        email="fmt@test.com",
        password="pw12345678",
    )
    name = assign_case_profile_username(
        user,
        profile_type="guardian",
        first_name="Moussa",
        last_name="Ba",
    )
    assert name == f"T_moussa_ba_{user.pk}"
    user.refresh_from_db()
    assert user.username == name


@pytest.mark.django_db
def test_generate_unique_username_sequential():
    u1 = generate_unique_username([UserRole.FAMILLE_TUTEUR], party_type=ExternalPartyType.FAMILLE)
    User.objects.create_user(username=u1, email="h1@test.com", password="pw12345678")
    u2 = generate_unique_username([UserRole.FAMILLE_TUTEUR], party_type=ExternalPartyType.FAMILLE)
    assert u1.startswith("H") and u2.startswith("H")
    assert int(u2[1:]) == int(u1[1:]) + 1


@pytest.mark.django_db
def test_create_user_auto_username(api=None):
    api = APIClient()
    admin = User.objects.create_user(
        username="A000099",
        password="pw12345678",
        email="adm99@example.com",
    )
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")
    r = api.post(
        reverse("user-list"),
        {
            "email": "tuteur@example.com",
            "password": "pw12345678",
            "phone": "+221771234567",
            "roles": [UserRole.FAMILLE_TUTEUR],
            "party_type": ExternalPartyType.TUTEUR,
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    data = r.json()
    assert data["username"].startswith("T")
    assert UserProfile.objects.filter(user__username=data["username"], phone__contains="771").exists()
