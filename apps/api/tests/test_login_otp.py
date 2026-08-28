import re

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from accounts.emails import OtpEmailResult
from accounts.models import LoginOtpChallenge, UserProfile

User = get_user_model()


@pytest.fixture
def api():
    return APIClient()


@pytest.fixture(autouse=True)
def otp_email_backend(settings, monkeypatch):
    """Tests : pas d'appel réseau SMTP / Resend."""

    def _fake_send(**kwargs):
        return OtpEmailResult(delivered_to=kwargs["to_email"])

    monkeypatch.setattr("accounts.emails.send_login_otp_email", _fake_send)
    settings.LOGIN_OTP_METHOD = "email"


@pytest.mark.django_db
def test_login_start_sends_challenge(api, mailoutbox, settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    u = User.objects.create_user(
        username="otpuser",
        password="pw12345678",
        email="otpuser@example.com",
    )
    UserProfile.objects.filter(user=u).update(phone="+221771234567")

    r = api.post(
        reverse("login-start"),
        {"identifier": "otpuser@example.com", "password": "pw12345678"},
        format="json",
    )
    assert r.status_code == 200, r.content
    data = r.json()
    assert "challenge_token" in data
    assert "masked_email" in data
    assert data["expires_in_seconds"] == 600
    assert LoginOtpChallenge.objects.filter(user=u, consumed_at__isnull=True).exists()
    assert r.json().get("delivery") == "email"


@pytest.mark.django_db
def test_login_start_with_auto_username_identifier(api, mailoutbox, settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    u = User.objects.create_user(
        username="H000042",
        password="pw12345678",
        email="heritier@example.com",
    )
    UserProfile.objects.filter(user=u).update(phone="+221771111111")

    r = api.post(
        reverse("login-start"),
        {"identifier": "h000042", "password": "pw12345678"},
        format="json",
    )
    assert r.status_code == 200, r.content


@pytest.mark.django_db
def test_login_start_with_phone_identifier(api, mailoutbox, settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    u = User.objects.create_user(
        username="phoneuser",
        password="pw12345678",
        email="phone@example.com",
    )
    UserProfile.objects.filter(user=u).update(phone="+221 77 123 45 67")

    r = api.post(
        reverse("login-start"),
        {"identifier": "221771234567", "password": "pw12345678"},
        format="json",
    )
    assert r.status_code == 200, r.content


@pytest.mark.django_db
def test_login_verify_issues_tokens(api, settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    u = User.objects.create_user(
        username="verifyuser",
        password="pw12345678",
        email="verify@example.com",
    )
    start = api.post(
        reverse("login-start"),
        {"identifier": "verify@example.com", "password": "pw12345678"},
        format="json",
    )
    challenge_token = start.json()["challenge_token"]
    challenge = LoginOtpChallenge.objects.get(token=challenge_token)
    # Le code est hashé en base ; on simule la saisie via un envoi mocké connu
    from accounts.login_otp import _hash_code

    code = "654321"
    challenge.code_hash = _hash_code(code)
    challenge.save(update_fields=["code_hash"])

    r = api.post(
        reverse("login-verify"),
        {"challenge_token": challenge_token, "code": code},
        format="json",
    )
    assert r.status_code == 200, r.content
    body = r.json()
    assert "access" in body and "refresh" in body
    assert body["user"]["username"] == "verifyuser"


@pytest.mark.django_db
def test_login_start_rejects_wrong_password(api):
    User.objects.create_user(
        username="badpw",
        password="pw12345678",
        email="badpw@example.com",
    )
    r = api.post(
        reverse("login-start"),
        {"identifier": "badpw@example.com", "password": "wrong"},
        format="json",
    )
    assert r.status_code == 401


@pytest.mark.django_db
def test_change_password(api):
    u = User.objects.create_user(
        username="chgpw",
        password="pw12345678",
        email="chgpw@example.com",
    )
    from rest_framework_simplejwt.tokens import RefreshToken

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(u).access_token}")
    r = api.post(
        reverse("change-password"),
        {
            "current_password": "pw12345678",
            "new_password": "NewSecurePass99",
        },
        format="json",
    )
    assert r.status_code == 200, r.content
    u.refresh_from_db()
    assert u.check_password("NewSecurePass99")


@pytest.mark.django_db
def test_resend_test_mode_refuses_admin_forward_by_default(monkeypatch):
    """Le code OTP doit aller au compte utilisateur, pas à CONTACT_TO_EMAIL."""
    monkeypatch.delenv("OTP_RESEND_FORWARD_TO_ADMIN", raising=False)
    monkeypatch.setenv("CONTACT_TO_EMAIL", "amanahfiducie@gmail.com")
    monkeypatch.setenv("RESEND_API_KEY", "re_test_key")

    def _raise_test_mode(**kwargs):
        raise __import__(
            "accounts.emails", fromlist=["LoginOtpEmailError"]
        ).LoginOtpEmailError("resend_test_mode")

    monkeypatch.setattr("accounts.emails._resend_request", _raise_test_mode)
    monkeypatch.setattr(
        "accounts.emails.resend_api_key_valid",
        lambda: "re_test_key",
    )
    monkeypatch.setattr(
        "accounts.emails.resend_from_email",
        lambda: "Test <onboarding@resend.dev>",
    )

    from accounts.emails import LoginOtpEmailError, _send_via_resend

    with pytest.raises(LoginOtpEmailError) as exc:
        _send_via_resend(
            account_email="utilisateur@example.com",
            code="123456",
            display_name="Test",
            expires_minutes=10,
            subject="Test",
            text_body="Test",
            html_body="<p>Test</p>",
        )
    assert "utilisateur@example.com" in str(exc.value)
    assert "amanahfiducie" not in str(exc.value).lower() or "administrateur" in str(exc.value)


@pytest.mark.django_db
def test_user_cannot_patch_own_profile(api):
    u = User.objects.create_user(
        username="readonly",
        password="pw12345678",
        email="readonly@example.com",
    )
    from rest_framework_simplejwt.tokens import RefreshToken

    api.credentials(HTTP_AUTHORIZATION=f"Bearer {RefreshToken.for_user(u).access_token}")
    r = api.patch(
        reverse("user-detail", kwargs={"pk": u.pk}),
        {"first_name": "Hack"},
        format="json",
    )
    assert r.status_code == 403
