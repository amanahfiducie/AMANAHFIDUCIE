import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assets", "0002_asset_valuation_schedule"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AssetEvent",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "event_type",
                    models.CharField(
                        choices=[
                            ("GAIN", "Gain"),
                            ("EXPENSE", "Dépense"),
                            ("ESTIMATION", "Estimation"),
                            ("OTHER", "Autre"),
                        ],
                        max_length=16,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[("ACTIVE", "Actif"), ("CANCELLED", "Annulé")],
                        default="ACTIVE",
                        max_length=16,
                    ),
                ),
                (
                    "reference",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("RENT", "Loyer / revenu locatif"),
                            ("DIVIDEND", "Dividende / distribution"),
                            ("SALE", "Vente / cession"),
                            ("INTEREST", "Intérêts / rendement financier"),
                            ("SUBSIDY", "Subvention / aide"),
                            ("PRODUCTION", "Production / récolte"),
                            ("OTHER", "Autre référence"),
                        ],
                        max_length=32,
                    ),
                ),
                ("title", models.CharField(blank=True, max_length=255)),
                ("description", models.TextField(blank=True)),
                (
                    "amount",
                    models.DecimalField(
                        blank=True, decimal_places=2, max_digits=18, null=True
                    ),
                ),
                ("currency", models.CharField(default="XOF", max_length=3)),
                ("event_date", models.DateField(blank=True, null=True)),
                ("justification", models.TextField(blank=True)),
                (
                    "expense_kind",
                    models.CharField(
                        blank=True,
                        choices=[("FIXED", "Fixe"), ("VARIABLE", "Variable")],
                        max_length=16,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("cancelled_at", models.DateTimeField(blank=True, null=True)),
                (
                    "asset",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="events",
                        to="assets.asset",
                    ),
                ),
                (
                    "cancelled_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="asset_events_cancelled",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "created_by",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="asset_events_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "updated_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="asset_events_updated",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ("-event_date", "-created_at"),
            },
        ),
    ]
