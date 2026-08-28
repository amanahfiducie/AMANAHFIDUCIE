from django.conf import settings
from django.db import models


class ValidationType(models.TextChoices):
    LEGAL = "LEGAL", "Juridique"
    ACCOUNTING = "ACCOUNTING", "Comptable"
    MANAGEMENT = "MANAGEMENT", "Direction"
    CHARIA = "CHARIA", "Charaïque"
    AUDIT = "AUDIT", "Audit"
    CASE_REVIEW = "CASE_REVIEW", "Circuit dossier"


class ValidationSubjectType(models.TextChoices):
    FINANCIAL_MOVEMENT = "FINANCIAL_MOVEMENT", "Mouvement financier"
    MANDATE = "MANDATE", "Mandat"
    CASE = "CASE", "Dossier"
    OTHER = "OTHER", "Autre"


class ValidationRequestStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    IN_PROGRESS = "IN_PROGRESS", "En cours"
    APPROVED = "APPROVED", "Approuvé"
    REJECTED = "REJECTED", "Rejeté"
    REQUEST_CHANGES = "REQUEST_CHANGES", "Modifications demandées"
    CANCELLED = "CANCELLED", "Annulé"


class ValidationDecisionType(models.TextChoices):
    PENDING = "PENDING", "En attente"
    APPROVED = "APPROVED", "Approuvé"
    REJECTED = "REJECTED", "Rejeté"
    REQUEST_CHANGES = "REQUEST_CHANGES", "Modifications demandées"
    CANCELLED = "CANCELLED", "Annulé"


class ValidationStepStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    APPROVED = "APPROVED", "Approuvé"
    REJECTED = "REJECTED", "Rejeté"
    REQUEST_CHANGES = "REQUEST_CHANGES", "Modifications demandées"
    SKIPPED = "SKIPPED", "Ignoré"


class ValidationRequest(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="validation_requests",
    )
    validation_type = models.CharField(
        max_length=32,
        choices=ValidationType.choices,
    )
    subject_type = models.CharField(
        max_length=32,
        choices=ValidationSubjectType.choices,
        default=ValidationSubjectType.OTHER,
    )
    title = models.CharField(max_length=255)
    summary = models.TextField(blank=True)
    status = models.CharField(
        max_length=32,
        choices=ValidationRequestStatus.choices,
        default=ValidationRequestStatus.PENDING,
    )
    financial_movement = models.ForeignKey(
        "finance.FinancialMovement",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="validation_requests",
    )
    mandate = models.ForeignKey(
        "mandates.Mandate",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="validation_requests",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="validation_requests_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.case.reference} · {self.title} ({self.status})"


class ValidationStep(models.Model):
    request = models.ForeignKey(
        ValidationRequest,
        on_delete=models.CASCADE,
        related_name="steps",
    )
    step_order = models.PositiveSmallIntegerField()
    assigned_role = models.CharField(max_length=64)
    step_label = models.CharField(max_length=120, blank=True)
    status = models.CharField(
        max_length=32,
        choices=ValidationStepStatus.choices,
        default=ValidationStepStatus.PENDING,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("step_order",)
        constraints = [
            models.UniqueConstraint(
                fields=("request", "step_order"),
                name="validations_step_request_order_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"#{self.request_id} étape {self.step_order} · {self.assigned_role}"


class ValidationDecision(models.Model):
    step = models.ForeignKey(
        ValidationStep,
        on_delete=models.CASCADE,
        related_name="decisions",
    )
    decision = models.CharField(max_length=32, choices=ValidationDecisionType.choices)
    comment = models.TextField(blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="validation_decisions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.step_id} · {self.decision}"


class ValidationComment(models.Model):
    request = models.ForeignKey(
        ValidationRequest,
        on_delete=models.CASCADE,
        related_name="comments",
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="validation_comments",
    )
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"Commentaire #{self.pk} sur demande {self.request_id}"
