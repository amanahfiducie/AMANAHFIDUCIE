from django.conf import settings
from django.db import models


class FamilyRelationType(models.TextChoices):
    PARENT = "PARENT", "Parent"
    CHILD = "CHILD", "Enfant"
    SPOUSE = "SPOUSE", "Conjoint(e)"
    SIBLING = "SIBLING", "Frère / sœur"
    GUARDIAN = "GUARDIAN", "Tuteur"
    OTHER = "OTHER", "Autre"


class RelationToDonorType(models.TextChoices):
    CHILD = "CHILD", "Enfant"
    SPOUSE = "SPOUSE", "Conjoint(e)"
    PARENT = "PARENT", "Parent"
    SIBLING = "SIBLING", "Frère / sœur"
    HEIR = "HEIR", "Héritier / héritière"
    WARD = "WARD", "Protégé(e) / pupille"
    OTHER = "OTHER", "Autre"


class CaseDonor(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="donors",
    )
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=128, blank=True)
    identification_number = models.CharField(max_length=128, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=64, blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("last_name", "first_name")
        verbose_name = "Donateur"
        verbose_name_plural = "Donateurs"

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"


class DonorTrustedPerson(models.Model):
    """Personne de confiance du donateur (mandataire familial, proche, etc.)."""

    donor = models.ForeignKey(
        CaseDonor,
        on_delete=models.CASCADE,
        related_name="trusted_persons",
    )
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    phone = models.CharField(max_length=64)
    email = models.EmailField()
    relationship_label = models.CharField(
        max_length=128,
        blank=True,
        help_text="Lien avec le donateur (ex. frère, notaire de famille).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("last_name", "first_name")
        verbose_name = "Personne de confiance"
        verbose_name_plural = "Personnes de confiance"

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Beneficiary(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="beneficiaries",
    )
    donor = models.ForeignKey(
        CaseDonor,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="beneficiaries",
    )
    relation_to_donor = models.CharField(
        max_length=32,
        choices=RelationToDonorType.choices,
        blank=True,
    )
    gender = models.CharField(
        max_length=1,
        choices=(("M", "Homme"), ("F", "Femme")),
        blank=True,
        help_text="Sexe (succession : fils / fille pour le farāʾiḍ).",
    )
    father = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children_as_father",
    )
    mother = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="children_as_mother",
    )
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    date_of_birth = models.DateField(null=True, blank=True)
    nationality = models.CharField(max_length=128, blank=True)
    identification_number = models.CharField(max_length=128, blank=True)
    is_minor = models.BooleanField(default=False)
    guardian = models.ForeignKey(
        "Guardian",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="beneficiaries",
    )
    notes = models.TextField(blank=True)
    patrimony_share_percent = models.DecimalField(
        max_digits=7,
        decimal_places=4,
        null=True,
        blank=True,
        help_text="Part du patrimoine du dossier (0–100 %).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("last_name", "first_name")
        verbose_name_plural = "beneficiaries"

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"


class Guardian(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="guardians",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="guardian_profiles",
    )
    first_name = models.CharField(max_length=128)
    last_name = models.CharField(max_length=128)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=64, blank=True)
    relationship_label = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("last_name", "first_name")

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}"


class FamilyRelation(models.Model):
    case = models.ForeignKey(
        "cases.FiduciaryCase",
        on_delete=models.CASCADE,
        related_name="family_relations",
    )
    from_beneficiary = models.ForeignKey(
        Beneficiary,
        on_delete=models.CASCADE,
        related_name="relations_from",
    )
    to_beneficiary = models.ForeignKey(
        Beneficiary,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="relations_to",
    )
    to_guardian = models.ForeignKey(
        Guardian,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="relations_to_guardian",
    )
    relation_type = models.CharField(max_length=32, choices=FamilyRelationType.choices)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.relation_type} ({self.case.reference})"
