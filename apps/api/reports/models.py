from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class ReportType(models.TextChoices):
    MONTHLY_MANAGEMENT_REPORT = "MONTHLY_MANAGEMENT_REPORT", "Rapport mensuel de gestion"
    QUARTERLY_FAMILY_REPORT = "QUARTERLY_FAMILY_REPORT", "Rapport trimestriel famille"
    SEMI_ANNUAL_NOTARY_JUDGE_REPORT = (
        "SEMI_ANNUAL_NOTARY_JUDGE_REPORT",
        "Rapport semestriel notaire / juge",
    )
    ANNUAL_MANAGEMENT_REPORT = "ANNUAL_MANAGEMENT_REPORT", "Rapport annuel de gestion"
    CHARIA_COMPLIANCE_REPORT = "CHARIA_COMPLIANCE_REPORT", "Rapport charaïque"
    IMPACT_REPORT = "IMPACT_REPORT", "Rapport d'impact"
    FINAL_CLOSING_REPORT = "FINAL_CLOSING_REPORT", "Rapport final de clôture"


class ReportStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    PENDING_APPROVAL = "PENDING_APPROVAL", "En revue interne"
    APPROVED = "APPROVED", "Approuvé"
    REJECTED = "REJECTED", "Rejeté"
    ARCHIVED = "ARCHIVED", "Archivé"


class GenerationJobStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    RUNNING = "RUNNING", "En cours"
    COMPLETED = "COMPLETED", "Terminé"
    FAILED = "FAILED", "Échec"


class ApprovalDecision(models.TextChoices):
    APPROVED = "APPROVED", "Approuvé"
    REJECTED = "REJECTED", "Rejeté"


def report_file_upload_path(instance: "Report", filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1] if "." in filename else "pdf"
    return f"cases/{instance.case_id}/reports/{instance.pk or 'new'}/{uuid.uuid4().hex}.{ext}"


class ReportTemplate(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    report_type = models.CharField(max_length=64, choices=ReportType.choices)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("report_type", "name")

    def __str__(self) -> str:
        return self.name


class Report(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="reports",
    )
    template = models.ForeignKey(
        ReportTemplate,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports",
    )
    report_type = models.CharField(max_length=64, choices=ReportType.choices)
    title = models.CharField(max_length=255)
    status = models.CharField(
        max_length=32,
        choices=ReportStatus.choices,
        default=ReportStatus.DRAFT,
    )
    file = models.FileField(upload_to=report_file_upload_path, blank=True)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    generated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reports_generated",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="reports_approved",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.title} ({self.get_report_type_display()})"


class ReportGenerationJob(models.Model):
    report = models.OneToOneField(
        Report,
        on_delete=models.CASCADE,
        related_name="generation_job",
    )
    status = models.CharField(
        max_length=16,
        choices=GenerationJobStatus.choices,
        default=GenerationJobStatus.PENDING,
    )
    error_message = models.TextField(blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)


class ReportApproval(models.Model):
    report = models.ForeignKey(
        Report,
        on_delete=models.CASCADE,
        related_name="approvals",
    )
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="report_approvals",
    )
    decision = models.CharField(max_length=16, choices=ApprovalDecision.choices)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
