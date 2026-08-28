"""Invitation d'un profil de dossier en tant qu'utilisateur de la plateforme."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import transaction
from django.utils import timezone

from accounts.login_otp import normalize_phone
from accounts.models import ExternalPartyProfile, ExternalPartyType, RoleAssignment, UserProfile, UserRole
from accounts.passwords import generate_initial_password
from accounts.usernames import assign_case_profile_username
from beneficiaries.models import Beneficiary, CaseDonor, DonorTrustedPerson, Guardian
from accounts.models import ProfileUserAccessRequest, ProfileUserAccessRequestStatus
from cases.models import CaseStakeholder, FiduciaryCase, StakeholderRole, TimelineEventType
from cases.services import record_timeline_event

User = get_user_model()
logger = logging.getLogger(__name__)

from accounts.profile_types import PROFILE_TYPE_LABELS, PROFILE_TYPES


@dataclass
class ProfileContact:
    profile_type: str
    profile_id: int
    first_name: str
    last_name: str
    email: str
    phone: str
    display_name: str
    party_type: str | None
    stakeholder_role: str
    guardian_id: int | None = None


class ProfileInviteError(Exception):
    def __init__(self, code: str, message: str, **extra: Any):
        self.code = code
        self.message = message
        self.extra = extra
        super().__init__(message)


def _roles_and_party_for_profile(profile_type: str) -> tuple[list[str], str | None]:
    """Rôle plateforme + type tiers externe selon le profil dossier."""
    if profile_type == "guardian":
        return [UserRole.FAMILLE_TUTEUR], ExternalPartyType.TUTEUR
    if profile_type in ("beneficiary", "trusted_person", "donor"):
        return [UserRole.FAMILLE_TUTEUR], ExternalPartyType.FAMILLE
    raise ProfileInviteError("invalid_profile_type", "Type de profil invalide.")


def _resolve_profile(case: FiduciaryCase, profile_type: str, profile_id: int) -> ProfileContact:
    if profile_type not in PROFILE_TYPES:
        raise ProfileInviteError("invalid_profile_type", "Type de profil invalide.")

    if profile_type == "donor":
        donor = CaseDonor.objects.filter(pk=profile_id, case_id=case.pk).first()
        if not donor:
            raise ProfileInviteError("not_found", "Donateur introuvable dans ce dossier.")
        return ProfileContact(
            profile_type=profile_type,
            profile_id=donor.pk,
            first_name=donor.first_name,
            last_name=donor.last_name,
            email=(donor.email or "").strip(),
            phone=(donor.phone or "").strip(),
            display_name=f"{donor.first_name} {donor.last_name}".strip(),
            party_type=ExternalPartyType.FAMILLE,
            stakeholder_role=StakeholderRole.FAMILY,
        )

    if profile_type == "trusted_person":
        person = DonorTrustedPerson.objects.filter(pk=profile_id, donor__case_id=case.pk).first()
        if not person:
            raise ProfileInviteError("not_found", "Personne de confiance introuvable.")
        return ProfileContact(
            profile_type=profile_type,
            profile_id=person.pk,
            first_name=person.first_name,
            last_name=person.last_name,
            email=(person.email or "").strip(),
            phone=(person.phone or "").strip(),
            display_name=f"{person.first_name} {person.last_name}".strip(),
            party_type=ExternalPartyType.FAMILLE,
            stakeholder_role=StakeholderRole.FAMILY,
        )

    if profile_type == "guardian":
        guardian = Guardian.objects.filter(pk=profile_id, case_id=case.pk).first()
        if not guardian:
            raise ProfileInviteError("not_found", "Tuteur introuvable dans ce dossier.")
        return ProfileContact(
            profile_type=profile_type,
            profile_id=guardian.pk,
            first_name=guardian.first_name,
            last_name=guardian.last_name,
            email=(guardian.email or "").strip(),
            phone=(guardian.phone or "").strip(),
            display_name=f"{guardian.first_name} {guardian.last_name}".strip(),
            party_type=ExternalPartyType.TUTEUR,
            stakeholder_role=StakeholderRole.GUARDIAN,
            guardian_id=guardian.pk,
        )

    beneficiary = Beneficiary.objects.filter(pk=profile_id, case_id=case.pk).first()
    if not beneficiary:
        raise ProfileInviteError("not_found", "Bénéficiaire introuvable dans ce dossier.")
    return ProfileContact(
        profile_type=profile_type,
        profile_id=beneficiary.pk,
        first_name=beneficiary.first_name,
        last_name=beneficiary.last_name,
        email="",
        phone="",
        display_name=f"{beneficiary.first_name} {beneficiary.last_name}".strip(),
        party_type=ExternalPartyType.FAMILLE,
        stakeholder_role=StakeholderRole.FAMILY,
    )


def _find_user_by_email(email: str) -> User | None:
    if not email:
        return None
    return User.objects.filter(email__iexact=email, is_active=True).first()


def _find_user_by_phone(phone: str) -> User | None:
    digits = normalize_phone(phone)
    if len(digits) < 8:
        return None
    for profile in UserProfile.objects.exclude(phone="").select_related("user"):
        if profile.user.is_active and normalize_phone(profile.phone) == digits:
            return profile.user
    return None


def _user_in_case(case: FiduciaryCase, user: User, role: str) -> bool:
    return CaseStakeholder.objects.filter(case=case, user=user, role=role).exists()


def _serialize_user_brief(user: User) -> dict:
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }


def should_queue_profile_access(profile_type: str, profile_id: int, case_id: int) -> bool:
    """Profils éligibles à un accès plateforme (hors mineurs)."""
    if profile_type == "beneficiary":
        beneficiary = Beneficiary.objects.filter(pk=profile_id, case_id=case_id).first()
        return beneficiary is not None and not beneficiary.is_minor
    if profile_type == "guardian":
        return Guardian.objects.filter(pk=profile_id, case_id=case_id).exists()
    if profile_type == "trusted_person":
        return DonorTrustedPerson.objects.filter(
            pk=profile_id, donor__case_id=case_id
        ).exists()
    if profile_type == "donor":
        donor = CaseDonor.objects.filter(pk=profile_id, case_id=case_id).first()
        return donor is not None and bool((donor.email or "").strip())
    return False


def enqueue_profile_access_request(
    case: FiduciaryCase,
    profile_type: str,
    profile_id: int,
    *,
    requested_by: User,
) -> ProfileUserAccessRequest | None:
    if profile_type not in PROFILE_TYPES:
        return None
    if not should_queue_profile_access(profile_type, profile_id, case.pk):
        return None

    pending = ProfileUserAccessRequest.objects.filter(
        case=case,
        profile_type=profile_type,
        profile_id=profile_id,
        status=ProfileUserAccessRequestStatus.PENDING,
    ).first()
    if pending:
        return pending

    try:
        profile = _resolve_profile(case, profile_type, profile_id)
    except ProfileInviteError:
        return None

    preview = preview_profile_invite(case, profile_type=profile_type, profile_id=profile_id)
    if preview["status"] == "already_in_case":
        return None

    existing_user_id = None
    if preview.get("user"):
        existing_user_id = preview["user"]["id"]

    return ProfileUserAccessRequest.objects.create(
        case=case,
        profile_type=profile_type,
        profile_id=profile_id,
        email=(profile.email or "").strip(),
        phone=profile.phone,
        display_name=profile.display_name,
        preview_status=preview["status"],
        existing_user_id=existing_user_id,
        requested_by=requested_by,
    )


def try_auto_provision_profile_access(
    case: FiduciaryCase,
    profile_type: str,
    profile_id: int,
    *,
    actor: User,
) -> dict | None:
    """
    Crée le compte et rattache le dossier dès qu'un e-mail est disponible.
    Sinon, place la demande en file d'attente administrateur.
    """
    if not should_queue_profile_access(profile_type, profile_id, case.pk):
        return None

    preview = preview_profile_invite(case, profile_type=profile_type, profile_id=profile_id)
    if preview["status"] == "already_in_case":
        return None

    if preview["status"] == "missing_email":
        req = enqueue_profile_access_request(
            case, profile_type, profile_id, requested_by=actor
        )
        return {"queued": True, "request_id": req.pk if req else None}

    effective_email = (preview.get("suggested_email") or "").strip().lower()
    if not effective_email:
        req = enqueue_profile_access_request(
            case, profile_type, profile_id, requested_by=actor
        )
        return {"queued": True, "request_id": req.pk if req else None}

    try:
        return invite_profile_as_user(
            case,
            profile_type=profile_type,
            profile_id=profile_id,
            email=effective_email,
            confirm_add_existing=preview["status"] == "user_exists",
            actor=actor,
        )
    except ProfileInviteError as exc:
        logger.warning(
            "Provision auto profil %s/%s : %s",
            profile_type,
            profile_id,
            exc.message,
        )
        req = enqueue_profile_access_request(
            case, profile_type, profile_id, requested_by=actor
        )
        return {"queued": True, "request_id": req.pk if req else None}
    except Exception as exc:
        logger.exception(
            "Provision auto profil %s/%s échouée",
            profile_type,
            profile_id,
        )
        req = enqueue_profile_access_request(
            case, profile_type, profile_id, requested_by=actor
        )
        return {"queued": True, "request_id": req.pk if req else None, "error": str(exc)}


def preview_profile_invite(
    case: FiduciaryCase,
    *,
    profile_type: str,
    profile_id: int,
    email: str = "",
) -> dict:
    profile = _resolve_profile(case, profile_type, profile_id)
    effective_email = (email or profile.email).strip()
    effective_phone = profile.phone

    if profile.profile_type == "beneficiary" and not effective_email:
        return {
            "status": "missing_email",
            "profile": _profile_payload(profile, case),
            "message": (
                "Ce bénéficiaire n'a pas d'e-mail. Saisissez une adresse pour créer le compte."
            ),
        }

    if not effective_email and not effective_phone:
        return {
            "status": "missing_email",
            "profile": _profile_payload(profile, case),
            "message": "E-mail ou téléphone requis pour créer ou retrouver un compte.",
        }

    existing = _find_user_by_email(effective_email) or _find_user_by_phone(effective_phone)
    if existing:
        if _user_in_case(case, existing, profile.stakeholder_role):
            return {
                "status": "already_in_case",
                "profile": _profile_payload(profile, case),
                "user": _serialize_user_brief(existing),
                "message": "Cet utilisateur a déjà accès à ce dossier.",
            }
        return {
            "status": "user_exists",
            "profile": _profile_payload(profile, case),
            "user": _serialize_user_brief(existing),
            "suggested_email": effective_email or existing.email,
            "message": (
                "Un compte existe déjà. Confirmez l'ajout de cet utilisateur à ce dossier ; "
                "un e-mail de notification lui sera envoyé."
            ),
        }

    if not effective_email:
        return {
            "status": "missing_email",
            "profile": _profile_payload(profile, case),
            "message": "Un e-mail est obligatoire pour créer un nouveau compte.",
        }

    return {
        "status": "no_user",
        "profile": _profile_payload(profile, case),
        "suggested_email": effective_email,
        "message": (
            "Aucun compte trouvé. Vous pouvez créer un utilisateur et lui donner accès à ce dossier."
        ),
    }


def _profile_payload(profile: ProfileContact, case: FiduciaryCase) -> dict:
    return {
        "profile_type": profile.profile_type,
        "profile_id": profile.profile_id,
        "display_name": profile.display_name,
        "email": profile.email,
        "phone": profile.phone,
        "case_id": case.pk,
        "case_reference": case.reference,
        "case_title": case.title,
    }


@transaction.atomic
def invite_profile_as_user(
    case: FiduciaryCase,
    *,
    profile_type: str,
    profile_id: int,
    email: str,
    confirm_add_existing: bool = False,
    actor: User,
) -> dict:
    profile = _resolve_profile(case, profile_type, profile_id)
    effective_email = (email or profile.email).strip().lower()
    effective_phone = profile.phone

    if not effective_email:
        raise ProfileInviteError(
            "missing_email",
            "L'e-mail est obligatoire pour créer ou notifier le compte.",
        )

    existing = _find_user_by_email(effective_email) or _find_user_by_phone(effective_phone)
    created = False
    temporary_password: str | None = None

    if existing:
        if _user_in_case(case, existing, profile.stakeholder_role):
            raise ProfileInviteError(
                "already_in_case",
                "Cet utilisateur a déjà accès à ce dossier.",
            )
        if not confirm_add_existing:
            raise ProfileInviteError(
                "confirmation_required",
                "Confirmez l'ajout de cet utilisateur existant à ce dossier.",
                user=_serialize_user_brief(existing),
            )
        user = existing
    else:
        temporary_password = generate_initial_password()
        validate_password(temporary_password)
        roles, party_type = _roles_and_party_for_profile(profile_type)
        placeholder = f"pending_{profile_type}_{profile_id}"[:150]
        user = User.objects.create_user(
            username=placeholder,
            email=effective_email,
            password=temporary_password,
            first_name=profile.first_name,
            last_name=profile.last_name,
            is_active=True,
        )
        assign_case_profile_username(
            user,
            profile_type=profile_type,
            first_name=profile.first_name,
            last_name=profile.last_name,
        )
        UserProfile.objects.update_or_create(
            user=user,
            defaults={
                "phone": effective_phone,
                "display_name": profile.display_name,
            },
        )
        for role in roles:
            RoleAssignment.objects.get_or_create(user=user, role=role)
        if party_type:
            ExternalPartyProfile.objects.update_or_create(
                user=user,
                defaults={"party_type": party_type},
            )
        created = True

    stakeholder, was_added = CaseStakeholder.objects.get_or_create(
        case=case,
        user=user,
        role=profile.stakeholder_role,
    )

    if profile.guardian_id:
        Guardian.objects.filter(pk=profile.guardian_id, case_id=case.pk).update(user=user)
    elif profile_type == "guardian":
        Guardian.objects.filter(pk=profile_id, case_id=case.pk).update(user=user)

    if was_added:
        record_timeline_event(
            case=case,
            event_type=TimelineEventType.STAKEHOLDER_ADDED,
            message=(
                f"Accès plateforme : {profile.display_name} "
                f"({user.username}) — dossier {case.reference}"
            ),
            actor=actor,
            metadata={
                "user_id": user.pk,
                "profile_type": profile_type,
                "profile_id": profile_id,
                "role": profile.stakeholder_role,
            },
        )

    from accounts.emails import (
        CaseInviteEmailError,
        LoginOtpEmailError,
        send_case_profile_invite_email,
    )

    email_sent = True
    email_error: str | None = None
    try:
        send_case_profile_invite_email(
            user_id=user.pk,
            to_email=effective_email,
            display_name=profile.display_name or user.get_full_name() or user.username,
            case_reference=case.reference,
            case_title=case.title,
            username=user.username,
            profile_type=profile_type,
            phone=effective_phone,
            temporary_password=temporary_password,
            added_to_existing_account=not created,
        )
    except (CaseInviteEmailError, LoginOtpEmailError) as exc:
        email_sent = False
        email_error = str(exc)

    return {
        "status": "invited",
        "created_user": created,
        "user": _serialize_user_brief(user),
        "stakeholder_id": stakeholder.pk,
        "email_sent_to": effective_email if email_sent else None,
        "email_sent": email_sent,
        "email_error": email_error,
        "temporary_password_sent": bool(temporary_password) and email_sent,
    }


@transaction.atomic
def approve_profile_access_request(
    access_request: ProfileUserAccessRequest,
    *,
    email: str,
    confirm_add_existing: bool,
    reviewer: User,
    review_notes: str = "",
) -> dict:
    if access_request.status != ProfileUserAccessRequestStatus.PENDING:
        raise ProfileInviteError("not_pending", "Cette demande a déjà été traitée.")

    result = invite_profile_as_user(
        access_request.case,
        profile_type=access_request.profile_type,
        profile_id=access_request.profile_id,
        email=email,
        confirm_add_existing=confirm_add_existing,
        actor=reviewer,
    )
    user_id = result["user"]["id"]
    access_request.status = ProfileUserAccessRequestStatus.APPROVED
    access_request.email = email.strip().lower()
    access_request.reviewed_by = reviewer
    access_request.reviewed_at = timezone.now()
    access_request.review_notes = review_notes
    access_request.created_user_id = user_id if result.get("created_user") else None
    if not result.get("created_user"):
        access_request.existing_user_id = user_id
    access_request.save(
        update_fields=[
            "status",
            "email",
            "reviewed_by",
            "reviewed_at",
            "review_notes",
            "created_user",
            "existing_user",
            "updated_at",
        ]
    )
    return result


@transaction.atomic
def reject_profile_access_request(
    access_request: ProfileUserAccessRequest,
    *,
    reviewer: User,
    review_notes: str = "",
) -> None:
    if access_request.status != ProfileUserAccessRequestStatus.PENDING:
        raise ProfileInviteError("not_pending", "Cette demande a déjà été traitée.")
    access_request.status = ProfileUserAccessRequestStatus.REJECTED
    access_request.reviewed_by = reviewer
    access_request.reviewed_at = timezone.now()
    access_request.review_notes = review_notes
    access_request.save(
        update_fields=[
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_notes",
            "updated_at",
        ]
    )
