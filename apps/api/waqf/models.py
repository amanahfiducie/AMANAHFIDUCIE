from django.db import models


class WaqfType(models.TextChoices):
    FAMILY = "FAMILY", "Waqf familial"
    PRODUCTIVE = "PRODUCTIVE", "Waqf productif"
    MIXED = "MIXED", "Mixte"


class WaqfProfile(models.Model):
    case = models.OneToOneField(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="waqf_profile",
    )
    waqf_type = models.CharField(
        max_length=32,
        choices=WaqfType.choices,
        default=WaqfType.FAMILY,
    )
    waqf_object = models.TextField(blank=True)
    waqf_distribution_rules = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"Waqf — {self.case.reference}"
