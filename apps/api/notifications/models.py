from django.conf import settings
from django.db import models


class NotificationType(models.TextChoices):
    CASE_SUBMITTED = "CASE_SUBMITTED", "Dossier soumis"
    REPORT_APPROVED = "REPORT_APPROVED", "Rapport approuvé"
    VALIDATION_PENDING = "VALIDATION_PENDING", "Validation en attente"
    ASSET_VALUATION_DUE = "ASSET_VALUATION_DUE", "Réévaluation patrimoine"
    FARAID_REVIEW_REQUESTED = "FARAID_REVIEW_REQUESTED", "Partage farāʾiḍ à traiter"
    GENERAL = "GENERAL", "Information"


class Notification(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    notification_type = models.CharField(
        max_length=32,
        choices=NotificationType.choices,
        default=NotificationType.GENERAL,
    )
    title = models.CharField(max_length=255)
    body = models.TextField(blank=True)
    action_path = models.CharField(max_length=512, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.title} → {self.user_id}"


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    email_enabled = models.BooleanField(default=True)
    in_app_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return f"Préférences notifications — {self.user_id}"
