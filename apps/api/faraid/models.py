from decimal import Decimal

from django.conf import settings
from django.db import models


class FaraidHeir(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="faraid_heirs",
    )
    beneficiary = models.ForeignKey(
        "beneficiaries.Beneficiary",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="faraid_entries",
    )
    full_name = models.CharField(max_length=255)
    relationship_label = models.CharField(max_length=128, blank=True)
    share_fraction = models.DecimalField(
        max_digits=8,
        decimal_places=6,
        default=Decimal("0"),
        help_text="Fraction théorique (ex. 0.25 pour 25 %).",
    )
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-share_fraction", "full_name")

    def __str__(self) -> str:
        return f"{self.full_name} ({self.share_fraction})"


class FaraidReviewStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    FINALIZED = "FINALIZED", "Finalisé"


class FaraidHeirDecisionStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    ACCEPTED = "ACCEPTED", "Héritier retenu"
    REJECTED = "REJECTED", "Exclu"


class FaraidHeirDecisionSource(models.TextChoices):
    FROM_GENEALOGY = "FROM_GENEALOGY", "Arbre de base"
    MANUAL = "MANUAL", "Ajout comité"


class FaraidActionType(models.TextChoices):
    ASSET_PURCHASE = "ASSET_PURCHASE", "Achat d'un bien par un héritier"
    ASSET_ALLOCATION = "ASSET_ALLOCATION", "Attribution d'un bien"
    CASH_SETTLEMENT = "CASH_SETTLEMENT", "Règlement en numéraire"
    OTHER = "OTHER", "Autre arrangement"


class FaraidCommitteeReview(models.Model):
    case = models.OneToOneField(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="faraid_review",
    )
    status = models.CharField(
        max_length=16,
        choices=FaraidReviewStatus.choices,
        default=FaraidReviewStatus.DRAFT,
    )
    net_estate = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
    )
    currency = models.CharField(max_length=3, default="XOF")
    committee_notes = models.TextField(blank=True)
    requested_at = models.DateTimeField(null=True, blank=True)
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="faraid_reviews_requested",
    )
    finalized_at = models.DateTimeField(null=True, blank=True)
    finalized_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="faraid_reviews_finalized",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-updated_at",)

    def __str__(self) -> str:
        return f"Revue farāʾiḍ — dossier {self.case_id}"


class FaraidHeirDecision(models.Model):
    review = models.ForeignKey(
        FaraidCommitteeReview,
        on_delete=models.CASCADE,
        related_name="heir_decisions",
    )
    beneficiary = models.ForeignKey(
        "beneficiaries.Beneficiary",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="faraid_heir_decisions",
    )
    source = models.CharField(
        max_length=20,
        choices=FaraidHeirDecisionSource.choices,
        default=FaraidHeirDecisionSource.FROM_GENEALOGY,
    )
    full_name = models.CharField(max_length=255)
    relationship_label = models.CharField(max_length=128, blank=True)
    faraid_role = models.CharField(max_length=32, blank=True)
    status = models.CharField(
        max_length=16,
        choices=FaraidHeirDecisionStatus.choices,
        default=FaraidHeirDecisionStatus.PENDING,
    )
    rejection_justification = models.TextField(blank=True)
    share_fraction = models.DecimalField(
        max_digits=8,
        decimal_places=6,
        null=True,
        blank=True,
    )
    share_amount = models.DecimalField(
        max_digits=18,
        decimal_places=2,
        null=True,
        blank=True,
    )
    committee_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("id",)

    def __str__(self) -> str:
        return f"{self.full_name} — {self.status}"


class FaraidSettlementAction(models.Model):
    review = models.ForeignKey(
        FaraidCommitteeReview,
        on_delete=models.CASCADE,
        related_name="settlement_actions",
    )
    action_type = models.CharField(max_length=24, choices=FaraidActionType.choices)
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    beneficiary = models.ForeignKey(
        "beneficiaries.Beneficiary",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="faraid_settlement_actions",
    )
    asset = models.ForeignKey(
        "assets.Asset",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="faraid_settlement_actions",
    )
    amount = models.DecimalField(max_digits=18, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=3, default="XOF")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="faraid_settlement_actions_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return self.title
