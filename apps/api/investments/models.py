from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.db.models import Sum

from cases.models import FiduciaryCase


class InvestmentAssetClass(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=160)
    description = models.TextField(blank=True)
    weight_min = models.PositiveSmallIntegerField(
        default=0,
        validators=[MaxValueValidator(100)],
        help_text="Poids cible minimum (%) dans l'univers PIGFI.",
    )
    weight_max = models.PositiveSmallIntegerField(
        default=100,
        validators=[MaxValueValidator(100)],
        help_text="Poids cible maximum (%) dans l'univers PIGFI.",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "label"]
        verbose_name = "Classe d'actif PIGFI"
        verbose_name_plural = "Classes d'actifs PIGFI"

    def __str__(self) -> str:
        return self.label


class PatrimonyInvestmentCategory(models.Model):
    class Code(models.TextChoices):
        A = "A", "Catégorie A — Mineurs"
        B = "B", "Catégorie B — Successoraux"
        C = "C", "Catégorie C — Familial long terme"
        D = "D", "Catégorie D — Waqf"

    code = models.CharField(max_length=1, choices=Code.choices, unique=True)
    label = models.CharField(max_length=200)
    objective = models.TextField(blank=True)
    target_yield_min = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
    )
    target_yield_max = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
    )
    allocation_targets = models.JSONField(
        default=dict,
        help_text="Répartition cible par slug de classe d'actif (%, total ~100).",
    )
    default_case_types = models.JSONField(
        default=list,
        blank=True,
        help_text="Types de dossier associés par défaut (codes CaseType).",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "code"]
        verbose_name = "Catégorie patrimoniale PIGFI"
        verbose_name_plural = "Catégories patrimoniales PIGFI"

    def __str__(self) -> str:
        return f"{self.code} — {self.label}"


class AmanahManagementProfile(models.Model):
    slug = models.SlugField(max_length=64, unique=True)
    label = models.CharField(max_length=200)
    code_ar = models.CharField(max_length=80, blank=True)
    description = models.TextField(blank=True)
    target_yield_min = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
    )
    target_yield_max = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
    )
    linked_category = models.ForeignKey(
        PatrimonyInvestmentCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="management_profiles",
    )
    sort_order = models.PositiveSmallIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["sort_order", "label"]
        verbose_name = "Profil de gestion AMANAH"
        verbose_name_plural = "Profils de gestion AMANAH"

    def __str__(self) -> str:
        return self.label


class CaseInvestmentPolicy(models.Model):
    case = models.OneToOneField(
        FiduciaryCase,
        on_delete=models.CASCADE,
        related_name="investment_policy",
    )
    patrimony_category = models.ForeignKey(
        PatrimonyInvestmentCategory,
        on_delete=models.PROTECT,
        related_name="case_policies",
    )
    management_profile = models.ForeignKey(
        AmanahManagementProfile,
        on_delete=models.PROTECT,
        related_name="case_policies",
    )
    sharia_compliance_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    planned_investment_amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
        help_text="Enveloppe patrimoniale cible à investir pour ce dossier.",
    )
    amanah_management_share_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
        help_text="Part AMANAH (%) sur la gestion du patrimoine.",
    )
    scheduled_payments = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            "Versements clients (sommes versées pour investir) : "
            "[{id, date, amount, label, status, notes, paid_at, "
            "beneficiary_id, beneficiary_name}]."
        ),
    )
    notes = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Politique d'investissement dossier"
        verbose_name_plural = "Politiques d'investissement dossier"

    def __str__(self) -> str:
        return f"Politique investissement — {self.case_id}"


class EnvelopeContribution(models.Model):
    """Historique des ajouts à l'enveloppe à investir d'un dossier."""

    policy = models.ForeignKey(
        CaseInvestmentPolicy,
        on_delete=models.CASCADE,
        related_name="envelope_contributions",
    )
    amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
        help_text="Somme ajoutée à l'enveloppe à investir.",
    )
    previous_total = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        default=Decimal("0"),
    )
    new_total = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        default=Decimal("0"),
    )
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="envelope_contributions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)
        verbose_name = "Ajout enveloppe à investir"
        verbose_name_plural = "Ajouts enveloppe à investir"

    def __str__(self) -> str:
        return f"{self.policy.case_id} · +{self.amount}"


class Investment(models.Model):
    class Status(models.TextChoices):
        PENDING_VALIDATION = "PENDING_VALIDATION", "En attente de validation"
        ACTIVE = "ACTIVE", "Actif"
        MATURED = "MATURED", "Arrivé à échéance"
        CLOSED = "CLOSED", "Clôturé"

    case = models.ForeignKey(
        FiduciaryCase,
        on_delete=models.CASCADE,
        related_name="investments",
        null=True,
        blank=True,
        help_text="Dossier client. Vide = investissement pas encore alloué à un dossier.",
    )
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="allocations",
        help_text="Investissement parent (enveloppe) dont cette ligne est une allocation dossier.",
    )
    asset_class = models.ForeignKey(
        InvestmentAssetClass,
        on_delete=models.PROTECT,
        related_name="investments",
    )
    label = models.CharField(max_length=255)
    reference = models.CharField(max_length=120, blank=True)
    amount_invested = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
    )
    current_value = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0"))],
    )
    currency = models.CharField(max_length=8, default="XOF")
    start_date = models.DateField()
    maturity_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=32,
        choices=Status.choices,
        default=Status.PENDING_VALIDATION,
    )
    annual_yield_percent = models.DecimalField(
        max_digits=6,
        decimal_places=2,
        null=True,
        blank=True,
    )
    distributed_income = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        default=Decimal("0"),
        validators=[MinValueValidator(Decimal("0"))],
    )
    sharia_compliance_score = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0")), MaxValueValidator(Decimal("100"))],
    )
    requires_purification = models.BooleanField(default=False)
    purification_amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal("0"))],
    )
    notes = models.TextField(blank=True)
    risk_summary = models.TextField(
        blank=True,
        help_text="Risques identifiés pour cet investissement.",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="investments_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-start_date", "-created_at"]
        verbose_name = "Investissement"
        verbose_name_plural = "Investissements"

    def __str__(self) -> str:
        return f"{self.label} ({self.case_id or 'non alloué'})"

    @property
    def latent_gain(self) -> Decimal:
        return self.current_value - self.amount_invested

    @property
    def is_envelope(self) -> bool:
        """Enveloppe globale (pas encore / partiellement allouée aux dossiers)."""
        return self.parent_id is None and self.case_id is None

    def allocated_amount(self) -> Decimal:
        if self.case_id is not None and self.parent_id is None:
            # Legacy / dossier unique : déjà « alloué » au dossier.
            return self.amount_invested
        total = self.allocations.exclude(status=Investment.Status.CLOSED).aggregate(
            total=Sum("amount_invested")
        )["total"]
        return total or Decimal("0")

    def allocation_progress_percent(self) -> float:
        if self.amount_invested <= 0:
            return 100.0
        allocated = self.allocated_amount()
        pct = float((allocated / self.amount_invested) * Decimal("100"))
        return max(0.0, min(100.0, pct))

    def is_allocation_complete(self) -> bool:
        if self.case_id is not None and self.parent_id is None:
            return True
        return self.allocated_amount() + Decimal("0.009") >= self.amount_invested


class InvestmentParticipant(models.Model):
    """Part d'un client (bénéficiaire) dans un investissement."""

    investment = models.ForeignKey(
        Investment,
        on_delete=models.CASCADE,
        related_name="participants",
    )
    beneficiary = models.ForeignKey(
        "beneficiaries.Beneficiary",
        on_delete=models.PROTECT,
        related_name="investment_participations",
    )
    patrimony_category = models.ForeignKey(
        PatrimonyInvestmentCategory,
        on_delete=models.PROTECT,
        related_name="investment_participations",
    )
    allocated_amount = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    share_percent = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        null=True,
        blank=True,
        validators=[
            MinValueValidator(Decimal("0")),
            MaxValueValidator(Decimal("100")),
        ],
        help_text="Part de l'investissement total (0–100 %).",
    )

    class Meta:
        ordering = ["id"]
        verbose_name = "Participant investissement"
        verbose_name_plural = "Participants investissement"
        constraints = [
            models.UniqueConstraint(
                fields=["investment", "beneficiary", "patrimony_category"],
                name="unique_investment_beneficiary_category",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.beneficiary_id} → {self.investment_id} ({self.allocated_amount})"


class InvestmentValuation(models.Model):
    """Historique des estimations de valeur d'un investissement."""

    investment = models.ForeignKey(
        Investment,
        on_delete=models.CASCADE,
        related_name="valuations",
    )
    value = models.DecimalField(
        max_digits=16,
        decimal_places=2,
        validators=[MinValueValidator(Decimal("0.01"))],
    )
    currency = models.CharField(max_length=8, default="XOF")
    valued_at = models.DateField()
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="investment_valuations_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-valued_at", "-created_at")
        verbose_name = "Estimation investissement"
        verbose_name_plural = "Estimations investissement"

    def __str__(self) -> str:
        return f"{self.investment_id} · {self.value} @ {self.valued_at}"
