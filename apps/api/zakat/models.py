from decimal import Decimal

from django.conf import settings
from django.db import models


class ZakatAssessmentStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    REVIEW = "REVIEW", "En revue"
    FINALIZED = "FINALIZED", "Finalisé"


class ZakatAssessment(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="zakat_assessments",
    )
    assessment_year = models.PositiveIntegerField()
    nisab_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
    )
    zakatable_wealth = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
    )
    zakat_due = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
    )
    currency = models.CharField(max_length=3, default="XOF")
    notes = models.TextField(blank=True)
    status = models.CharField(
        max_length=16,
        choices=ZakatAssessmentStatus.choices,
        default=ZakatAssessmentStatus.DRAFT,
    )
    prepared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="zakat_assessments",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-assessment_year", "-created_at")
        constraints = [
            models.UniqueConstraint(
                fields=["case", "assessment_year"],
                name="zakat_case_year_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"Zakat {self.assessment_year} — {self.case.reference}"
