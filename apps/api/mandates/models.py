from django.conf import settings
from django.db import models


class MandateType(models.TextChoices):
    JUDICIAL = "JUDICIAL", "Judiciaire"
    NOTARIAL = "NOTARIAL", "Notarial"
    FAMILY = "FAMILY", "Familial"
    CONTRACTUAL = "CONTRACTUAL", "Contractuel"
    WAQF = "WAQF", "Waqf"
    OTHER = "OTHER", "Autre"


class MandateValidationDecision(models.TextChoices):
    PENDING = "PENDING", "En attente"
    APPROVED = "APPROVED", "Approuvé"
    REJECTED = "REJECTED", "Rejeté"
    REQUEST_CHANGES = "REQUEST_CHANGES", "Modifications demandées"


class Mandate(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="mandates",
    )
    mandate_type = models.CharField(max_length=32, choices=MandateType.choices)
    title = models.CharField(max_length=255)
    reference_number = models.CharField(max_length=128, blank=True)
    issuing_authority = models.CharField(max_length=255, blank=True)
    signed_at = models.DateField(null=True, blank=True)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="mandates_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.case.reference} · {self.title}"

    @property
    def latest_validation(self):
        return self.validations.order_by("-created_at").first()


class MandateValidation(models.Model):
    mandate = models.ForeignKey(
        Mandate,
        on_delete=models.CASCADE,
        related_name="validations",
    )
    decision = models.CharField(
        max_length=32,
        choices=MandateValidationDecision.choices,
        default=MandateValidationDecision.PENDING,
    )
    comment = models.TextField(blank=True)
    validated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="mandate_validations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.mandate_id} · {self.decision}"
