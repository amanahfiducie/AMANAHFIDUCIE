from decimal import Decimal

from django.conf import settings
from django.db import models


class MovementType(models.TextChoices):
    INCOME = "INCOME", "Recette"
    EXPENSE = "EXPENSE", "Dépense"
    TRANSFER = "TRANSFER", "Virement"
    MANAGEMENT_FEE = "MANAGEMENT_FEE", "Frais de gestion"
    PERFORMANCE_FEE = "PERFORMANCE_FEE", "Frais de performance"
    ADJUSTMENT = "ADJUSTMENT", "Ajustement"


class MovementStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    PENDING_VALIDATION = "PENDING_VALIDATION", "En validation"
    APPROVED = "APPROVED", "Approuvé"
    REJECTED = "REJECTED", "Rejeté"


DEBIT_TYPES = {
    MovementType.EXPENSE,
    MovementType.TRANSFER,
    MovementType.MANAGEMENT_FEE,
    MovementType.PERFORMANCE_FEE,
}


class CategoryScope(models.TextChoices):
    REVENUE = "REVENUE", "Recette / chiffre d'affaires"
    EXPENSE = "EXPENSE", "Dépense"
    NEUTRAL = "NEUTRAL", "Neutre"


class MovementCategory(models.Model):
    slug = models.SlugField(unique=True)
    label = models.CharField(max_length=128)
    movement_type = models.CharField(
        max_length=32,
        choices=MovementType.choices,
        default=MovementType.EXPENSE,
    )
    scope = models.CharField(
        max_length=16,
        choices=CategoryScope.choices,
        default=CategoryScope.EXPENSE,
    )
    """Aligné sur les 5 types de dossiers / services SOFIGEPAM (recettes uniquement)."""
    service_type = models.CharField(max_length=32, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    """Catégories du catalogue initial — libellé modifiable, pas de suppression."""
    is_system = models.BooleanField(default=False)

    class Meta:
        ordering = ("sort_order", "slug")
        verbose_name_plural = "movement categories"

    def __str__(self) -> str:
        return self.label


class FiduciaryAccount(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="fiduciary_accounts",
    )
    name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=64, blank=True)
    currency = models.CharField(max_length=3, default="XOF")
    opening_balance = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="fiduciary_accounts_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return f"{self.case.reference} · {self.name}"


class FinancialMovement(models.Model):
    account = models.ForeignKey(
        FiduciaryAccount,
        on_delete=models.CASCADE,
        related_name="movements",
    )
    movement_type = models.CharField(max_length=32, choices=MovementType.choices)
    category = models.ForeignKey(
        MovementCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="movements",
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    description = models.CharField(max_length=512, blank=True)
    reference = models.CharField(max_length=128, blank=True)
    movement_date = models.DateField()
    status = models.CharField(
        max_length=32,
        choices=MovementStatus.choices,
        default=MovementStatus.DRAFT,
    )
    document = models.ForeignKey(
        "documents.Document",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="financial_movements",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="financial_movements_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-movement_date", "-created_at")

    def __str__(self) -> str:
        return f"{self.movement_type} {self.amount} ({self.status})"

    @property
    def signed_amount(self) -> Decimal:
        if self.movement_type in DEBIT_TYPES:
            return -abs(self.amount)
        if self.movement_type == MovementType.ADJUSTMENT:
            return self.amount
        return abs(self.amount)


class Fee(models.Model):
    account = models.ForeignKey(
        FiduciaryAccount,
        on_delete=models.CASCADE,
        related_name="fees",
    )
    fee_type = models.CharField(
        max_length=32,
        choices=MovementType.choices,
        default=MovementType.MANAGEMENT_FEE,
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    description = models.CharField(max_length=255, blank=True)
    due_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-due_date", "-created_at")


class Reconciliation(models.Model):
    account = models.ForeignKey(
        FiduciaryAccount,
        on_delete=models.CASCADE,
        related_name="reconciliations",
    )
    period_start = models.DateField()
    period_end = models.DateField()
    bank_balance = models.DecimalField(max_digits=18, decimal_places=2)
    ledger_balance = models.DecimalField(max_digits=18, decimal_places=2)
    difference = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    notes = models.TextField(blank=True)
    reconciled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="reconciliations",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-period_end",)


class EnterpriseAccountType(models.TextChoices):
    BANK = "BANK", "Compte bancaire"
    CASH = "CASH", "Caisse"
    REVENUE = "REVENUE", "Produit / recette"
    EXPENSE = "EXPENSE", "Charge / dépense"
    OTHER = "OTHER", "Autre"


class EnterpriseAccount(models.Model):
    """Compte de la société SOFIGEPAM — hors périmètre dossier fiduciaire."""

    name = models.CharField(max_length=255)
    account_number = models.CharField(max_length=64, blank=True)
    account_type = models.CharField(
        max_length=16,
        choices=EnterpriseAccountType.choices,
        default=EnterpriseAccountType.BANK,
    )
    currency = models.CharField(max_length=3, default="XOF")
    opening_balance = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        default=Decimal("0"),
    )
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="enterprise_accounts_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)

    def __str__(self) -> str:
        return self.name


class EnterpriseMovement(models.Model):
    """Mouvement comptable de l'entreprise (SOFIGEPAM)."""

    account = models.ForeignKey(
        EnterpriseAccount,
        on_delete=models.CASCADE,
        related_name="movements",
    )
    movement_type = models.CharField(max_length=32, choices=MovementType.choices)
    category = models.ForeignKey(
        MovementCategory,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="enterprise_movements",
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    description = models.CharField(max_length=512, blank=True)
    reference = models.CharField(max_length=128, blank=True)
    movement_date = models.DateField()
    status = models.CharField(
        max_length=32,
        choices=MovementStatus.choices,
        default=MovementStatus.DRAFT,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="enterprise_movements_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-movement_date", "-created_at")

    def __str__(self) -> str:
        return f"{self.movement_type} {self.amount} ({self.status})"

    @property
    def signed_amount(self) -> Decimal:
        if self.movement_type in DEBIT_TYPES:
            return -abs(self.amount)
        if self.movement_type == MovementType.ADJUSTMENT:
            return self.amount
        return abs(self.amount)


def enterprise_justificatif_upload_path(instance: "EnterpriseJustificatif", filename: str) -> str:
    import uuid

    return f"enterprise/justificatifs/{instance.movement_id}/{uuid.uuid4().hex}_{filename}"


class EnterpriseJustificatif(models.Model):
    """Pièce justificative liée à un mouvement comptable entreprise."""

    movement = models.ForeignKey(
        EnterpriseMovement,
        on_delete=models.CASCADE,
        related_name="justificatifs",
    )
    title = models.CharField(max_length=255)
    file = models.FileField(upload_to=enterprise_justificatif_upload_path)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=128, blank=True)
    size_bytes = models.PositiveBigIntegerField(default=0)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="enterprise_justificatifs_uploaded",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title
