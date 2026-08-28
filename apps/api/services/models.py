from django.conf import settings
from django.db import models

from cases.models import CaseType


class BillingFormula(models.TextChoices):
    MANAGEMENT_FEE_AUM = "MANAGEMENT_FEE_AUM", "Frais de gestion (AUM)"
    PERFORMANCE_FEE = "PERFORMANCE_FEE", "Commission de performance"
    OPENING_FEE = "OPENING_FEE", "Honoraires d'ouverture / mandat"
    MISSION_FEE = "MISSION_FEE", "Honoraires de mission"
    OTHER = "OTHER", "Autre"


class BillingPeriodicity(models.TextChoices):
    ONCE = "ONCE", "Ponctuel (à l'ouverture / mission)"
    QUARTERLY = "QUARTERLY", "Trimestriel"
    ANNUAL = "ANNUAL", "Annuel"
    ON_PROFIT = "ON_PROFIT", "Sur profit positif"


class ServiceOffer(models.Model):
    """Catalogue des offres métier (aligné sur CaseType)."""

    case_type = models.CharField(
        max_length=32,
        choices=CaseType.choices,
        unique=True,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("sort_order", "name")
        verbose_name = "Service"
        verbose_name_plural = "Services"

    def __str__(self) -> str:
        return self.name


class ServiceBillingRule(models.Model):
    """Règle tarifaire applicable à un service (versionnée par dates)."""

    service = models.ForeignKey(
        ServiceOffer,
        on_delete=models.CASCADE,
        related_name="billing_rules",
    )
    formula = models.CharField(max_length=32, choices=BillingFormula.choices)
    label = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    rate_percent = models.DecimalField(
        max_digits=7,
        decimal_places=3,
        null=True,
        blank=True,
        help_text="Taux par défaut (%) pour les formules proportionnelles.",
    )
    rate_min_percent = models.DecimalField(
        max_digits=7,
        decimal_places=3,
        null=True,
        blank=True,
    )
    rate_max_percent = models.DecimalField(
        max_digits=7,
        decimal_places=3,
        null=True,
        blank=True,
    )
    fixed_amount = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Montant forfaitaire (XOF) pour honoraires ponctuels.",
    )
    fixed_amount_min = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Borne basse du forfait (fourchette politique tarifaire).",
    )
    fixed_amount_max = models.DecimalField(
        max_digits=14,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Borne haute du forfait (fourchette politique tarifaire).",
    )
    base_min = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Tranche basse de la base (AUM / patrimoine) incluse.",
    )
    base_max = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Tranche haute de la base (AUM / patrimoine) incluse ; vide = pas de plafond.",
    )
    # Colonne legacy éventuelle (jsonb NOT NULL en prod) — non utilisée par le calcul actuel.
    tiers = models.JSONField(default=list, blank=True)
    currency = models.CharField(max_length=3, default="XOF")
    periodicity = models.CharField(
        max_length=16,
        choices=BillingPeriodicity.choices,
        default=BillingPeriodicity.ONCE,
    )
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    effective_from = models.DateField(null=True, blank=True)
    effective_to = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="service_billing_rules_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("service_id", "sort_order", "id")
        verbose_name = "Règle tarifaire"
        verbose_name_plural = "Règles tarifaires"

    def __str__(self) -> str:
        return f"{self.service.case_type}: {self.label}"


class CaseBillingChargeStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    POSTED = "POSTED", "Comptabilisé"
    CANCELLED = "CANCELLED", "Annulé"


class CaseBillingCharge(models.Model):
    """Honoraires calculés pour un dossier, éventuellement passés en recette entreprise."""

    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="billing_charges",
    )
    billing_rule = models.ForeignKey(
        ServiceBillingRule,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="charges",
    )
    formula = models.CharField(max_length=32, choices=BillingFormula.choices)
    label = models.CharField(max_length=255)
    base_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
        help_text="Base de calcul (AUM, profit net, etc.).",
    )
    rate_percent = models.DecimalField(
        max_digits=7,
        decimal_places=3,
        null=True,
        blank=True,
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    period_label = models.CharField(max_length=64, blank=True)
    movement_date = models.DateField()
    status = models.CharField(
        max_length=16,
        choices=CaseBillingChargeStatus.choices,
        default=CaseBillingChargeStatus.DRAFT,
    )
    enterprise_movement = models.OneToOneField(
        "finance.EnterpriseMovement",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="case_billing_charge",
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="case_billing_charges_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-movement_date", "-created_at")
        verbose_name = "Charge facturable"
        verbose_name_plural = "Charges facturables"

    def __str__(self) -> str:
        return f"{self.case_id} · {self.label} · {self.amount}"


class BillingInvoice(models.Model):
    """Une facture d'honoraires par dossier et par période."""

    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="billing_invoices",
    )
    period_label = models.CharField(max_length=64)
    label = models.CharField(max_length=255, blank=True)
    amount = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    currency = models.CharField(max_length=3, default="XOF")
    movement_date = models.DateField()
    status = models.CharField(
        max_length=16,
        choices=CaseBillingChargeStatus.choices,
        default=CaseBillingChargeStatus.DRAFT,
    )
    enterprise_movement = models.OneToOneField(
        "finance.EnterpriseMovement",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="billing_invoice",
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="billing_invoices_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-movement_date", "-created_at")
        verbose_name = "Facture d'honoraires"
        verbose_name_plural = "Factures d'honoraires"

    def __str__(self) -> str:
        return f"{self.case_id} · {self.period_label} · {self.amount}"


class BillingInvoiceLine(models.Model):
    """Ligne de facture liée à une règle tarifaire (sélectionnable / modifiable)."""

    invoice = models.ForeignKey(
        BillingInvoice,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    billing_rule = models.ForeignKey(
        ServiceBillingRule,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="invoice_lines",
    )
    formula = models.CharField(max_length=32, choices=BillingFormula.choices)
    label = models.CharField(max_length=255)
    base_amount = models.DecimalField(
        max_digits=18, decimal_places=2, null=True, blank=True
    )
    rate_percent = models.DecimalField(
        max_digits=7, decimal_places=3, null=True, blank=True
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2)
    is_selected = models.BooleanField(default=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ("sort_order", "id")
        verbose_name = "Ligne de facture"
        verbose_name_plural = "Lignes de facture"

    def __str__(self) -> str:
        return f"{self.invoice_id} · {self.label}"
