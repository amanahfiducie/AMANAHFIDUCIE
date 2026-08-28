import uuid

from django.conf import settings
from django.db import models


def document_upload_path(instance: "DocumentVersion", filename: str) -> str:
    return f"cases/{instance.document.case_id}/documents/{instance.document_id}/{uuid.uuid4().hex}_{filename}"


class DonorIdentityKind(models.TextChoices):
    CNI = "CNI", "Carte nationale d'identité (PDF)"
    EN = "EN", "Extrait de naissance"
    PASSPORT = "PASSPORT", "Passeport"
    RESIDENCE = "RESIDENCE", "Certificat de résidence"
    OTHER = "OTHER", "Autre pièce d'identité"


class DocumentCategory(models.TextChoices):
    IDENTITY = "IDENTITY", "Identité"
    MANDATE = "MANDATE", "Mandat"
    COURT_DECISION = "COURT_DECISION", "Décision de justice"
    NOTARIAL_ACT = "NOTARIAL_ACT", "Acte notarié"
    PROPERTY_TITLE = "PROPERTY_TITLE", "Titre de propriété"
    BANK_STATEMENT = "BANK_STATEMENT", "Relevé bancaire"
    INVOICE = "INVOICE", "Facture"
    RECEIPT = "RECEIPT", "Reçu"
    CONTRACT = "CONTRACT", "Contrat"
    REPORT = "REPORT", "Rapport"
    CHARIA_OPINION = "CHARIA_OPINION", "Avis charaïque"
    OTHER = "OTHER", "Autre"


class DocumentAccessAction(models.TextChoices):
    UPLOAD = "UPLOAD", "Téléversement"
    VIEW = "VIEW", "Consultation"
    DOWNLOAD = "DOWNLOAD", "Téléchargement"
    SHARE = "SHARE", "Partage"


class DocumentTag(models.Model):
    slug = models.SlugField(unique=True)
    label = models.CharField(max_length=128)

    class Meta:
        ordering = ("slug",)

    def __str__(self) -> str:
        return self.label


class Document(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="documents",
    )
    donor = models.ForeignKey(
        "beneficiaries.CaseDonor",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="documents",
    )
    beneficiary = models.ForeignKey(
        "beneficiaries.Beneficiary",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="documents",
    )
    guardian = models.ForeignKey(
        "beneficiaries.Guardian",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="documents",
    )
    mandate = models.ForeignKey(
        "mandates.Mandate",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="documents",
    )
    identity_kind = models.CharField(
        max_length=32,
        blank=True,
        choices=DonorIdentityKind.choices,
        help_text="Type de pièce d'identité du donateur (nommage automatique).",
    )
    category = models.CharField(max_length=32, choices=DocumentCategory.choices)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="documents_uploaded",
    )
    tags = models.ManyToManyField(DocumentTag, blank=True, related_name="documents")
    is_confidential = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title

    @property
    def current_version(self):
        return self.versions.order_by("-version_number").first()


class DocumentVersion(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="versions",
    )
    file = models.FileField(upload_to=document_upload_path)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=128, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    version_number = models.PositiveIntegerField(default=1)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="document_versions_uploaded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-version_number",)
        constraints = [
            models.UniqueConstraint(
                fields=("document", "version_number"),
                name="documents_version_document_number_uniq",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.document_id} v{self.version_number}"


class DocumentAccessLog(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="access_logs",
    )
    version = models.ForeignKey(
        DocumentVersion,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="access_logs",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="document_access_logs",
    )
    action = models.CharField(max_length=16, choices=DocumentAccessAction.choices)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    metadata_json = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)


class DocumentShare(models.Model):
    document = models.ForeignKey(
        Document,
        on_delete=models.CASCADE,
        related_name="shares",
    )
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="document_shares_sent",
    )
    shared_with_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="document_shares_received",
    )
    shared_with_email = models.EmailField(blank=True)
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
