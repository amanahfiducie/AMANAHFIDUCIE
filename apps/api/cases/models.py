from django.conf import settings
from django.db import models
from django.utils import timezone


class CaseOrigin(models.TextChoices):
    """Provenance / canal d'ouverture du dossier."""

    FAMILY_REQUEST = "FAMILY_REQUEST", "Demande familiale"
    NOTARY = "NOTARY", "Notaire"
    COURT = "COURT", "Juridiction / tribunal"
    PARTNER = "PARTNER", "Partenaire institutionnel"
    INTERNAL = "INTERNAL", "Initiative interne SOFIGEPAM"
    DIRECT_CONTACT = "DIRECT_CONTACT", "Prise de contact directe"
    OTHER = "OTHER", "Autre"


class CaseType(models.TextChoices):
    TUTELLE_CANTONNEMENT = "TUTELLE_CANTONNEMENT", "Tutelle / cantonnement"
    MANDAT_FIDUCIAIRE = "MANDAT_FIDUCIAIRE", "Mandat fiduciaire"
    WAQF = "WAQF", "Waqf familial ou productif"
    SUCCESSION = "SUCCESSION", "Conseil successoral"
    ZAKAT_FARAID = "ZAKAT_FARAID", "Zakat & farāʾiḍ"


class CaseStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    UNDER_REVIEW = "UNDER_REVIEW", "En revue"
    LEGAL_REVIEW = "LEGAL_REVIEW", "Revue juridique"
    COMPLIANCE_REVIEW = "COMPLIANCE_REVIEW", "Revue conformité"
    ACTIVE = "ACTIVE", "Actif"
    SUSPENDED = "SUSPENDED", "Suspendu"
    CLOSING = "CLOSING", "En clôture"
    CLOSED = "CLOSED", "Clôturé"
    REJECTED = "REJECTED", "Rejeté"


class StakeholderRole(models.TextChoices):
    FIDUCIARY_AGENT = "FIDUCIARY_AGENT", "Agent fiduciaire"
    DIRECTION = "DIRECTION", "Direction"
    LEGAL = "LEGAL", "Juridique"
    ACCOUNTING = "ACCOUNTING", "Comptabilité"
    CHARIA = "CHARIA", "Comité charaïque"
    FAMILY = "FAMILY", "Famille"
    GUARDIAN = "GUARDIAN", "Tuteur"
    NOTARY = "NOTARY", "Notaire"
    JUDGE = "JUDGE", "Juge"
    AUDITOR = "AUDITOR", "Auditeur"
    OTHER = "OTHER", "Autre"


class TimelineEventType(models.TextChoices):
    CREATED = "CREATED", "Création"
    UPDATED = "UPDATED", "Mise à jour"
    STATUS_CHANGED = "STATUS_CHANGED", "Changement de statut"
    SUBMITTED = "SUBMITTED", "Soumission"
    CLOSED = "CLOSED", "Clôture"
    NOTE_ADDED = "NOTE_ADDED", "Note ajoutée"
    OBSERVATION_SHARED = "OBSERVATION_SHARED", "Observation partagée"
    OBSERVATION_APPROVED = "OBSERVATION_APPROVED", "Observation retenue"
    OBSERVATION_REJECTED = "OBSERVATION_REJECTED", "Observation refusée"
    REMARK_ADDED = "REMARK_ADDED", "Remarque interne"
    STAKEHOLDER_ADDED = "STAKEHOLDER_ADDED", "Partie prenante ajoutée"


class FiduciaryCase(models.Model):
    reference = models.CharField(max_length=32, unique=True, editable=False)
    case_type = models.CharField(
        max_length=32,
        choices=CaseType.choices,
        default=CaseType.MANDAT_FIDUCIAIRE,
    )
    title = models.CharField(max_length=255)
    case_origin = models.CharField(
        max_length=32,
        choices=CaseOrigin.choices,
        blank=True,
        help_text="Origine / provenance du dossier.",
    )
    description = models.TextField(blank=True)
    onboarding_step = models.CharField(max_length=32, blank=True, default="identification")
    onboarding_data = models.JSONField(default=dict, blank=True)
    onboarding_completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=CaseStatus.choices,
        default=CaseStatus.DRAFT,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cases_created",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cases_assigned",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="cases_deleted",
    )

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Dossier fiduciaire"
        verbose_name_plural = "Dossiers fiduciaires"

    def __str__(self) -> str:
        return f"{self.reference} — {self.title}"

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class CaseStakeholder(models.Model):
    case = models.ForeignKey(
        FiduciaryCase,
        on_delete=models.CASCADE,
        related_name="stakeholders",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="case_stakeholders",
    )
    role = models.CharField(max_length=32, choices=StakeholderRole.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("case", "user", "role"),
                name="cases_stakeholder_case_user_role_uniq",
            ),
        ]
        ordering = ("case_id", "role")

    def __str__(self) -> str:
        return f"{self.case.reference}:{self.user_id}:{self.role}"


class CaseAssignment(models.Model):
    """Historique des chargés de dossier (un seul actif à la fois)."""

    case = models.ForeignKey(
        FiduciaryCase,
        on_delete=models.CASCADE,
        related_name="assignment_history",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="case_assignments",
    )
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="case_assignments_made",
    )
    started_at = models.DateTimeField()
    ended_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-started_at",)
        verbose_name = "Chargé de dossier (période)"
        verbose_name_plural = "Chargés de dossier (historique)"

    def __str__(self) -> str:
        end = self.ended_at.isoformat() if self.ended_at else "en cours"
        return f"{self.case.reference} · {self.user_id} ({self.started_at} → {end})"

    @property
    def is_current(self) -> bool:
        return self.ended_at is None


class CaseTimelineEvent(models.Model):
    case = models.ForeignKey(
        FiduciaryCase,
        on_delete=models.CASCADE,
        related_name="timeline_events",
    )
    event_type = models.CharField(max_length=32, choices=TimelineEventType.choices)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="case_timeline_events",
    )
    message = models.TextField()
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.case.reference} · {self.event_type}"


class CaseNote(models.Model):
    case = models.ForeignKey(
        FiduciaryCase,
        on_delete=models.CASCADE,
        related_name="notes",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="case_notes",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Note {self.case.reference} #{self.pk}"


class CaseObservationKind(models.TextChoices):
    SUBMISSION = "SUBMISSION", "Observation partagée"
    REMARK = "REMARK", "Remarque interne"


class CaseObservationStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    PENDING = "PENDING", "En attente de validation"
    APPROVED = "APPROVED", "Retenue"
    REJECTED = "REJECTED", "Refusée"


class CaseObservation(models.Model):
    case = models.ForeignKey(
        FiduciaryCase,
        on_delete=models.CASCADE,
        related_name="observations",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="case_observations",
    )
    kind = models.CharField(
        max_length=16,
        choices=CaseObservationKind.choices,
        default=CaseObservationKind.SUBMISSION,
    )
    status = models.CharField(
        max_length=16,
        choices=CaseObservationStatus.choices,
        default=CaseObservationStatus.DRAFT,
    )
    body = models.TextField()
    shared_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="case_observations_reviewed",
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)
    review_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"Observation {self.case.reference} #{self.pk}"
