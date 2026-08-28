import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class UserRole(models.TextChoices):
    SUPER_ADMIN = "SUPER_ADMIN", "Super administration"
    DIRECTION = "DIRECTION", "Direction"
    AGENT_FIDUCIAIRE = "AGENT_FIDUCIAIRE", "Agent fiduciaire"
    JURIDIQUE_CONFORMITE = "JURIDIQUE_CONFORMITE", "Juridique / conformité"
    COMPTABLE_FIDUCIAIRE = "COMPTABLE_FIDUCIAIRE", "Comptable fiduciaire"
    COMITE_CHARAIQUE = "COMITE_CHARAIQUE", "Comité charaique"
    AUDITEUR = "AUDITEUR", "Auditeur"
    FAMILLE_TUTEUR = "FAMILLE_TUTEUR", "Famille / tuteur"
    NOTAIRE = "NOTAIRE", "Notaire"
    JUGE = "JUGE", "Juge"


class ExternalPartyType(models.TextChoices):
    FAMILLE = "FAMILLE", "Famille"
    TUTEUR = "TUTEUR", "Tuteur"
    NOTAIRE = "NOTAIRE", "Notaire"
    JURIDICTION = "JURIDICTION", "Juridiction"
    PARTENAIRE = "PARTENAIRE", "Partenaire"
    INSTITUTION = "INSTITUTION", "Institution"


class AccessScope(models.Model):
    slug = models.SlugField(unique=True)
    label = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("slug",)

    def __str__(self) -> str:
        return self.label


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    display_name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=64, blank=True)
    timezone = models.CharField(max_length=64, blank=True)
    locale = models.CharField(max_length=16, blank=True, default="fr-FR")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.display_name or self.user.get_username()


class RoleAssignment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="role_assignments",
    )
    role = models.CharField(max_length=64, choices=UserRole.choices)
    scope = models.ForeignKey(
        AccessScope,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="role_assignments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("user", "role"),
                name="accounts_roleassignment_user_role_uniq",
            ),
        ]
        ordering = ("user_id", "role")

    def __str__(self) -> str:
        return f"{self.user_id}:{self.role}"


class LoginOtpChallenge(models.Model):
    """Défi OTP émis après identifiant + mot de passe (valide 10 minutes)."""

    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="login_otp_challenges",
    )
    code_hash = models.CharField(max_length=64)
    sent_to_email = models.EmailField()
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["token"]),
            models.Index(fields=["user", "consumed_at", "expires_at"]),
        ]

    def __str__(self) -> str:
        return f"OTP {self.user_id} · {self.token}"

    @property
    def is_expired(self) -> bool:
        return self.expires_at <= timezone.now()


class ProfileUserAccessRequestStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    APPROVED = "APPROVED", "Validé"
    REJECTED = "REJECTED", "Refusé"


class ProfileUserAccessRequest(models.Model):
    """Demande de création / rattachement d'un compte pour un profil de dossier."""

    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="profile_access_requests",
    )
    profile_type = models.CharField(max_length=32)
    profile_id = models.PositiveIntegerField()
    status = models.CharField(
        max_length=16,
        choices=ProfileUserAccessRequestStatus.choices,
        default=ProfileUserAccessRequestStatus.PENDING,
    )
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=64, blank=True)
    display_name = models.CharField(max_length=255, blank=True)
    preview_status = models.CharField(max_length=32, blank=True)
    existing_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="profile_access_requests_as_existing",
    )
    created_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="profile_access_requests_created",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="profile_access_requests_submitted",
    )
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="profile_access_requests_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
        indexes = [
            models.Index(fields=["status", "created_at"]),
            models.Index(fields=["case", "profile_type", "profile_id"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=("case", "profile_type", "profile_id"),
                condition=models.Q(status="PENDING"),
                name="accounts_profileaccessreq_pending_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.case_id}:{self.profile_type}:{self.profile_id} ({self.status})"


class ExternalPartyProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="external_party_profile",
    )
    party_type = models.CharField(max_length=32, choices=ExternalPartyType.choices)
    organization_name = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"{self.user.get_username()} ({self.party_type})"
