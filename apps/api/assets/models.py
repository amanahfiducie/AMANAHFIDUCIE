import os
from decimal import Decimal

from django.conf import settings
from django.db import models


def asset_event_justification_upload_path(instance: "AssetEvent", filename: str) -> str:
    safe_name = os.path.basename(filename)
    return (
        f"cases/{instance.asset.case_id}/assets/{instance.asset_id}/events/{safe_name}"
    )


class AssetType(models.TextChoices):
    REAL_ESTATE = "REAL_ESTATE", "Immobilier"
    LAND = "LAND", "Foncier"
    BANK_ACCOUNT = "BANK_ACCOUNT", "Compte bancaire"
    CASH = "CASH", "Liquidités"
    GOLD = "GOLD", "Or"
    BUSINESS = "BUSINESS", "Commerce"
    SHARES = "SHARES", "Parts sociales"
    AGRICULTURE = "AGRICULTURE", "Agriculture"
    LIVESTOCK = "LIVESTOCK", "Élevage"
    WAQF_ASSET = "WAQF_ASSET", "Actif waqf"
    OTHER = "OTHER", "Autre"


class ValuationMethod(models.TextChoices):
    MARKET = "MARKET", "Marché"
    EXPERT = "EXPERT", "Expertise"
    BOOK = "BOOK", "Valeur comptable"
    OTHER = "OTHER", "Autre"


class RiskLevel(models.TextChoices):
    LOW = "LOW", "Faible"
    MEDIUM = "MEDIUM", "Moyen"
    HIGH = "HIGH", "Élevé"
    CRITICAL = "CRITICAL", "Critique"


class ValuationFrequency(models.TextChoices):
    MONTHLY = "MONTHLY", "Mensuelle"
    QUARTERLY = "QUARTERLY", "Trimestrielle"
    SEMIANNUAL = "SEMIANNUAL", "Semestrielle"
    ANNUAL = "ANNUAL", "Annuelle"
    BIENNIAL = "BIENNIAL", "Tous les 2 ans"


class RiskCategory(models.TextChoices):
    MARKET = "MARKET", "Marché"
    LEGAL = "LEGAL", "Juridique"
    OPERATIONAL = "OPERATIONAL", "Opérationnel"
    CHARIA = "CHARIA", "Charaïque"
    OTHER = "OTHER", "Autre"


class IncomeType(models.TextChoices):
    RENT = "RENT", "Loyer"
    DIVIDEND = "DIVIDEND", "Dividende"
    INTEREST = "INTEREST", "Intérêts"
    OTHER = "OTHER", "Autre"


class Asset(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="assets",
    )
    asset_type = models.CharField(max_length=32, choices=AssetType.choices)
    label = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    currency = models.CharField(max_length=3, default="XOF")
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("1"),
    )
    unit = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    valuation_frequency = models.CharField(
        max_length=16,
        choices=ValuationFrequency.choices,
        default=ValuationFrequency.QUARTERLY,
    )
    valuation_next_due = models.DateField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="assets_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("asset_type", "label")

    def __str__(self) -> str:
        return f"{self.label} ({self.asset_type})"

    @property
    def latest_valuation(self):
        return self.valuations.order_by("-valued_at", "-created_at").first()


class AssetValuation(models.Model):
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name="valuations",
    )
    value = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    valued_at = models.DateField()
    method = models.CharField(
        max_length=32,
        choices=ValuationMethod.choices,
        default=ValuationMethod.MARKET,
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="asset_valuations_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-valued_at", "-created_at")

    def __str__(self) -> str:
        return f"{self.asset_id} · {self.value} {self.currency}"


class AssetRisk(models.Model):
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name="risks",
    )
    risk_level = models.CharField(max_length=16, choices=RiskLevel.choices)
    category = models.CharField(max_length=32, choices=RiskCategory.choices)
    description = models.TextField()
    identified_at = models.DateField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="asset_risks_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-identified_at", "-created_at")

    def __str__(self) -> str:
        return f"{self.asset_id} · {self.risk_level}"


class AssetEventType(models.TextChoices):
    GAIN = "GAIN", "Gain"
    EXPENSE = "EXPENSE", "Dépense"
    ESTIMATION = "ESTIMATION", "Estimation"
    OTHER = "OTHER", "Autre"


class ExpenseKind(models.TextChoices):
    FIXED = "FIXED", "Fixe"
    VARIABLE = "VARIABLE", "Variable"


class AssetEventStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Actif"
    CANCELLED = "CANCELLED", "Annulé"


class GainReference(models.TextChoices):
    """Références de base pour estimer un gain."""
    RENT = "RENT", "Loyer / revenu locatif"
    DIVIDEND = "DIVIDEND", "Dividende / distribution"
    SALE = "SALE", "Vente / cession"
    INTEREST = "INTEREST", "Intérêts / rendement financier"
    SUBSIDY = "SUBSIDY", "Subvention / aide"
    PRODUCTION = "PRODUCTION", "Production / récolte"
    OTHER = "OTHER", "Autre référence"


class AssetEventCategory(models.Model):
    """Sous-catégorie personnalisée (nom + description) pour un actif."""

    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name="event_categories",
    )
    event_type = models.CharField(max_length=16, choices=AssetEventType.choices)
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    billing_kind = models.CharField(
        max_length=16,
        choices=ExpenseKind.choices,
        default=ExpenseKind.VARIABLE,
    )
    default_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="asset_event_categories_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("name",)
        constraints = [
            models.UniqueConstraint(
                fields=("asset", "event_type", "name"),
                name="uniq_asset_event_category_name",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.asset_id} · {self.event_type} · {self.name}"


class AssetEvent(models.Model):
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name="events",
    )
    category = models.ForeignKey(
        AssetEventCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="events",
    )
    event_type = models.CharField(max_length=16, choices=AssetEventType.choices)
    status = models.CharField(
        max_length=16,
        choices=AssetEventStatus.choices,
        default=AssetEventStatus.ACTIVE,
    )
    reference = models.CharField(
        max_length=32,
        choices=GainReference.choices,
        blank=True,
    )
    title = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
    )
    currency = models.CharField(max_length=3, default="XOF")
    event_date = models.DateField(null=True, blank=True)
    justification_file = models.FileField(
        upload_to=asset_event_justification_upload_path,
        blank=True,
    )
    expense_kind = models.CharField(
        max_length=16,
        choices=ExpenseKind.choices,
        blank=True,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="asset_events_created",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="asset_events_updated",
        null=True,
        blank=True,
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="asset_events_cancelled",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-event_date", "-created_at")

    def __str__(self) -> str:
        return f"{self.asset_id} · {self.event_type} · {self.status}"


class AssetIncome(models.Model):
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name="incomes",
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    income_type = models.CharField(max_length=32, choices=IncomeType.choices)
    period_start = models.DateField(null=True, blank=True)
    period_end = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-period_end", "-created_at")

    def __str__(self) -> str:
        return f"{self.asset_id} · {self.amount}"
