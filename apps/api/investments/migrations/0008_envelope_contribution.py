from decimal import Decimal

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("investments", "0007_investmentvaluation"),
    ]

    operations = [
        migrations.CreateModel(
            name="EnvelopeContribution",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "amount",
                    models.DecimalField(
                        decimal_places=2,
                        help_text="Somme ajoutée à l'enveloppe à investir.",
                        max_digits=16,
                        validators=[django.core.validators.MinValueValidator(Decimal("0.01"))],
                    ),
                ),
                ("previous_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=16)),
                ("new_total", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=16)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="envelope_contributions_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "policy",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="envelope_contributions",
                        to="investments.caseinvestmentpolicy",
                    ),
                ),
            ],
            options={
                "verbose_name": "Ajout enveloppe à investir",
                "verbose_name_plural": "Ajouts enveloppe à investir",
                "ordering": ("-created_at",),
            },
        ),
    ]
