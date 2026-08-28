import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from accounts.models import RoleAssignment, UserProfile, UserRole

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.mark.django_db
def test_openapi_schema_is_public(api):
    r = api.get("/api/v1/schema/")
    assert r.status_code == 200
    r = api.get(reverse("health"))
    assert r.status_code == 200
    assert r.json() == {"status": "OK"}


@pytest.mark.django_db
def test_me_requires_auth(api):
    r = api.get(reverse("me"))
    assert r.status_code == 401


@pytest.mark.django_db
def test_me_returns_roles(api):
    u = User.objects.create_user(
        username="agent",
        password="testpass123",
        email="agent@example.com",
    )
    RoleAssignment.objects.create(user=u, role=UserRole.AGENT_FIDUCIAIRE)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(u).access_token}")
    r = api.get(reverse("me"))
    assert r.status_code == 200
    body = r.json()
    assert body["roles"] == [UserRole.AGENT_FIDUCIAIRE]
    assert body["username"] == "agent"


@pytest.mark.django_db
def test_token_obtain_includes_user_and_roles(api):
    u = User.objects.create_user(
        username="adminu",
        password="pw12345678",
        email="adminu@example.com",
    )
    RoleAssignment.objects.create(user=u, role=UserRole.SUPER_ADMIN)
    r = api.post(
        reverse("token_obtain_pair"),
        {"username": "adminu", "password": "pw12345678"},
        format="json",
    )
    assert r.status_code == 200, r.content
    data = r.json()
    assert "access" in data and "refresh" in data
    assert data["user"]["roles"] == [UserRole.SUPER_ADMIN]


@pytest.mark.django_db
def test_non_admin_cannot_list_users(api):
    u = User.objects.create_user(
        username="plain",
        password="pw12345678",
        email="plain@example.com",
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(u).access_token}")
    r = api.get(reverse("user-list"))
    assert r.status_code == 403


@pytest.mark.django_db
def test_verify_password_accepts_correct_password(api):
    u = User.objects.create_user(
        username="verify_ok",
        password="pw12345678",
        email="verify_ok@example.com",
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(u).access_token}")
    r = api.post(
        reverse("verify-password"),
        {"password": "pw12345678"},
        format="json",
    )
    assert r.status_code == 200, r.content
    assert r.json() == {"ok": True}


@pytest.mark.django_db
def test_verify_password_rejects_wrong_password(api):
    u = User.objects.create_user(
        username="verify_ko",
        password="pw12345678",
        email="verify_ko@example.com",
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(u).access_token}")
    r = api.post(
        reverse("verify-password"),
        {"password": "wrong-password"},
        format="json",
    )
    assert r.status_code == 401


@pytest.mark.django_db
def test_non_admin_cannot_create_user(api):
    u = User.objects.create_user(
        username="agent2",
        password="pw12345678",
        email="agent2@example.com",
    )
    RoleAssignment.objects.create(user=u, role=UserRole.AGENT_FIDUCIAIRE)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(u).access_token}")
    r = api.post(
        reverse("user-list"),
        {
            "email": "blocked@example.com",
            "password": "pw12345678",
            "roles": [UserRole.AGENT_FIDUCIAIRE],
        },
        format="json",
    )
    assert r.status_code == 403


@pytest.mark.django_db
def test_super_admin_can_create_user(api):
    admin = User.objects.create_user(
        username="adm",
        password="pw12345678",
        email="adm@example.com",
    )
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")
    r = api.post(
        reverse("user-list"),
        {
            "email": "newu@example.com",
            "password": "pw12345678",
            "phone": "+221771234567",
            "roles": [UserRole.AGENT_FIDUCIAIRE],
        },
        format="json",
    )
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["username"].startswith("F")
    assert User.objects.filter(username=body["username"]).exists()


@pytest.mark.django_db
def test_created_user_can_start_login(api, monkeypatch):
    from accounts.emails import OtpEmailResult

    def _fake_send(**kwargs):
        return OtpEmailResult(delivered_to=kwargs["to_email"])

    monkeypatch.setattr("accounts.emails.send_login_otp_email", _fake_send)
    monkeypatch.setattr("accounts.views.send_manual_user_welcome_email", lambda **kwargs: None)

    admin = User.objects.create_user(
        username="adm_create",
        password="pw12345678",
        email="adm_create@example.com",
    )
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")
    create = api.post(
        reverse("user-list"),
        {
            "email": "  LoginTest@Example.COM ",
            "password": "SecretPass99",
            "phone": "+221770000001",
            "roles": [UserRole.AGENT_FIDUCIAIRE],
        },
        format="json",
    )
    assert create.status_code == 201, create.content
    username = create.json()["username"]
    stored = User.objects.get(username=username)
    assert stored.email == "logintest@example.com"
    assert stored.is_active is True
    assert stored.check_password("SecretPass99")

    api.credentials()
    for identifier in (username, "LoginTest@Example.COM", "221770000001"):
        r = api.post(
            reverse("login-start"),
            {"identifier": identifier, "password": "SecretPass99"},
            format="json",
        )
        assert r.status_code == 200, (identifier, r.content)


@pytest.mark.django_db
def test_super_admin_can_patch_block_and_update_user(api):
    admin = User.objects.create_user(
        username="adm2",
        password="pw12345678",
        email="adm2@example.com",
    )
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    target = User.objects.create_user(
        username="F000099",
        password="pw12345678",
        email="target@example.com",
    )
    UserProfile.objects.update_or_create(user=target, defaults={"phone": "+221771111111"})
    RoleAssignment.objects.create(user=target, role=UserRole.AGENT_FIDUCIAIRE)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")
    r = api.patch(
        reverse("user-detail", kwargs={"pk": target.pk}),
        {
            "first_name": "Modifié",
            "is_active": False,
            "profile": {"phone": "+221772222222"},
        },
        format="json",
    )
    assert r.status_code == 200, r.content
    body = r.json()
    assert body["first_name"] == "Modifié"
    assert body["is_active"] is False
    target.refresh_from_db()
    assert target.is_active is False


@pytest.mark.django_db
def test_super_admin_can_delete_user_without_protected_links(api):
    admin = User.objects.create_user(
        username="adm3",
        password="pw12345678",
        email="adm3@example.com",
    )
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    target = User.objects.create_user(
        username="F000100",
        password="pw12345678",
        email="del@example.com",
    )
    UserProfile.objects.update_or_create(user=target, defaults={"phone": "+221773333333"})
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")
    r = api.delete(reverse("user-detail", kwargs={"pk": target.pk}))
    assert r.status_code == 204, r.content
    assert not User.objects.filter(pk=target.pk).exists()


@pytest.mark.django_db
def test_admin_cannot_delete_self(api):
    admin = User.objects.create_user(
        username="adm4",
        password="pw12345678",
        email="adm4@example.com",
    )
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")
    r = api.delete(reverse("user-detail", kwargs={"pk": admin.pk}))
    assert r.status_code == 400


@pytest.mark.django_db
def test_list_users_search_by_case_reference(api):
    from cases.models import CaseStakeholder, FiduciaryCase, StakeholderRole

    admin = User.objects.create_user(
        username="adm5",
        password="pw12345678",
        email="adm5@example.com",
    )
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    target = User.objects.create_user(
        username="H000200",
        password="pw12345678",
        email="heir@example.com",
    )
    case = FiduciaryCase.objects.create(
        reference="DOS-SEARCH-99",
        title="Dossier test recherche",
        created_by=admin,
    )
    CaseStakeholder.objects.create(
        case=case,
        user=target,
        role=StakeholderRole.FAMILY,
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")
    r = api.get(reverse("user-list"), {"q": "DOS-SEARCH"})
    assert r.status_code == 200, r.content
    ids = {row["id"] for row in r.json()}
    assert target.pk in ids
    match = next(row for row in r.json() if row["id"] == target.pk)
    assert any(link["reference"] == "DOS-SEARCH-99" for link in match["case_links"])


@pytest.mark.django_db
def test_list_users_filter_by_scope_and_role(api):
    admin = User.objects.create_user(
        username="adm7",
        password="pw12345678",
        email="adm7@example.com",
    )
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    internal = User.objects.create_user(
        username="F000101",
        password="pw12345678",
        email="agent@example.com",
    )
    RoleAssignment.objects.create(user=internal, role=UserRole.AGENT_FIDUCIAIRE)
    external = User.objects.create_user(
        username="H000101",
        password="pw12345678",
        email="heir2@example.com",
    )
    RoleAssignment.objects.create(user=external, role=UserRole.FAMILLE_TUTEUR)
    blocked = User.objects.create_user(
        username="J000101",
        password="pw12345678",
        email="judge@example.com",
        is_active=False,
    )
    RoleAssignment.objects.create(user=blocked, role=UserRole.JUGE)

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")

    r = api.get(reverse("user-list"), {"scope": "internal"})
    assert r.status_code == 200
    ids = {row["id"] for row in r.json()}
    assert internal.pk in ids
    assert external.pk not in ids

    r = api.get(reverse("user-list"), {"scope": "external"})
    assert external.pk in {row["id"] for row in r.json()}

    r = api.get(reverse("user-list"), {"role": UserRole.AGENT_FIDUCIAIRE})
    assert {row["id"] for row in r.json()} == {internal.pk}

    r = api.get(reverse("user-list"), {"status": "blocked"})
    assert blocked.pk in {row["id"] for row in r.json()}
    assert internal.pk not in {row["id"] for row in r.json()}


@pytest.mark.django_db
def test_list_users_filter_by_profile_type_guardian(api):
    from beneficiaries.models import Guardian
    from cases.models import FiduciaryCase

    admin = User.objects.create_user(
        username="adm6",
        password="pw12345678",
        email="adm6@example.com",
    )
    RoleAssignment.objects.create(user=admin, role=UserRole.SUPER_ADMIN)
    guardian_user = User.objects.create_user(
        username="T000201",
        password="pw12345678",
        email="tutor@example.com",
    )
    other = User.objects.create_user(
        username="F000202",
        password="pw12345678",
        email="other@example.com",
    )
    case = FiduciaryCase.objects.create(
        reference="DOS-TUTOR-1",
        title="Dossier tuteur",
        created_by=admin,
    )
    Guardian.objects.create(
        case=case,
        user=guardian_user,
        first_name="Ali",
        last_name="Diop",
    )
    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(admin).access_token}")
    r = api.get(reverse("user-list"), {"profile_type": "guardian"})
    assert r.status_code == 200, r.content
    ids = {row["id"] for row in r.json()}
    assert guardian_user.pk in ids
    assert other.pk not in ids
