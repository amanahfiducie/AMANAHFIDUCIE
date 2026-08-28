import hashlib
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.utils import timezone

from accounts.models import LoginOtpChallenge

User = get_user_model()

OTP_TTL = timedelta(minutes=10)
MAX_VERIFY_ATTEMPTS = 5


def normalize_phone(value: str) -> str:
    return re.sub(r"\D", "", value.strip())


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return ""
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[0] + "***"
    else:
        masked_local = local[0] + "***" + local[-1]
    return f"{masked_local}@{domain}"


def _resolve_user_by_identifier_qs(identifier: str, *, active_only: bool):
    raw = (identifier or "").strip()
    if not raw:
        return None
    base = User.objects.select_related("profile")
    if active_only:
        base = base.filter(is_active=True)
    if "@" in raw:
        return base.filter(email__iexact=raw.lower()).first()
    by_username = base.filter(username__iexact=raw).first()
    if by_username:
        return by_username

    digits = normalize_phone(raw)
    if len(digits) < 8:
        return None
    qs = base.filter(profile__phone__isnull=False).exclude(profile__phone="")
    for user in qs:
        profile_phone = getattr(user, "profile", None)
        if profile_phone and normalize_phone(profile_phone.phone) == digits:
            return user
    return None


def resolve_user_by_identifier(identifier: str) -> User | None:
    return _resolve_user_by_identifier_qs(identifier, active_only=True)


def resolve_user_by_identifier_including_inactive(identifier: str) -> User | None:
    return _resolve_user_by_identifier_qs(identifier, active_only=False)


def _hash_code(code: str) -> str:
    pepper = settings.SECRET_KEY
    return hashlib.sha256(f"{pepper}:{code}".encode()).hexdigest()


def _generate_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


@transaction.atomic
def start_login_challenge(identifier: str, password: str) -> LoginOtpChallenge:
    """
    Vérifie identifiant + mot de passe, invalide les défis ouverts, crée un OTP 10 min.
    """
    user = resolve_user_by_identifier(identifier)
    if user is None:
        inactive = resolve_user_by_identifier_including_inactive(identifier)
        if inactive is not None and not inactive.is_active:
            raise ValueError("account_inactive")
        raise ValueError("invalid_credentials")
    if not user.check_password(password):
        # Re-auth Django pour timing constant si besoin
        authenticate(username=user.get_username(), password=password)
        raise ValueError("invalid_credentials")
    email = (user.email or "").strip()
    if not email:
        raise ValueError("no_email")

    LoginOtpChallenge.objects.filter(
        user=user,
        consumed_at__isnull=True,
        expires_at__gt=timezone.now(),
    ).update(consumed_at=timezone.now())

    code = _generate_code()
    challenge = LoginOtpChallenge.objects.create(
        user=user,
        code_hash=_hash_code(code),
        expires_at=timezone.now() + OTP_TTL,
        sent_to_email=email,
    )
    from accounts.emails import send_login_otp_email

    profile = getattr(user, "profile", None)
    display_name = profile.display_name if profile else ""
    result = send_login_otp_email(
        to_email=email,
        code=code,
        display_name=display_name,
        expires_minutes=10,
    )
    challenge.dev_code = result.dev_code  # type: ignore[attr-defined]
    challenge.dev_notice = result.dev_notice  # type: ignore[attr-defined]
    challenge.delivered_to = result.delivered_to  # type: ignore[attr-defined]
    return challenge


def verify_login_challenge(challenge_token: str, code: str) -> User:
    raw_code = (code or "").strip()
    if not re.fullmatch(r"\d{6}", raw_code):
        raise ValueError("invalid_code")

    try:
        challenge = LoginOtpChallenge.objects.select_related("user").get(
            token=challenge_token,
            consumed_at__isnull=True,
        )
    except LoginOtpChallenge.DoesNotExist as exc:
        raise ValueError("invalid_challenge") from exc

    if challenge.expires_at <= timezone.now():
        raise ValueError("expired")

    if challenge.attempts >= MAX_VERIFY_ATTEMPTS:
        raise ValueError("too_many_attempts")

    expected = challenge.code_hash
    actual = _hash_code(raw_code)
    if not secrets.compare_digest(expected, actual):
        challenge.attempts += 1
        challenge.save(update_fields=["attempts"])
        raise ValueError("invalid_code")

    challenge.consumed_at = timezone.now()
    challenge.save(update_fields=["consumed_at"])
    return challenge.user
