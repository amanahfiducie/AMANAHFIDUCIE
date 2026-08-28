from django.db import migrations, models

from finance.category_catalog import (
    EXPENSE_CATEGORIES,
    NEUTRAL_CATEGORIES,
    REVENUE_SERVICE_CATEGORIES,
)


def reseed_categories(apps, schema_editor):
    MovementCategory = apps.get_model("finance", "MovementCategory")

    # Recettes par service (5 types)
    for slug, label, service_type, sort_order in REVENUE_SERVICE_CATEGORIES:
        MovementCategory.objects.update_or_create(
            slug=slug,
            defaults={
                "label": label,
                "movement_type": "INCOME",
                "scope": "REVENUE",
                "service_type": service_type,
                "sort_order": sort_order,
            },
        )

    # Dépenses par catégorie
    for slug, label, sort_order in EXPENSE_CATEGORIES:
        MovementCategory.objects.update_or_create(
            slug=slug,
            defaults={
                "label": label,
                "movement_type": "EXPENSE",
                "scope": "EXPENSE",
                "service_type": "",
                "sort_order": sort_order,
            },
        )

    for slug, label, sort_order in NEUTRAL_CATEGORIES:
        MovementCategory.objects.update_or_create(
            slug=slug,
            defaults={
                "label": label,
                "movement_type": "TRANSFER",
                "scope": "NEUTRAL",
                "service_type": "",
                "sort_order": sort_order,
            },
        )

    # Retirer les anciennes catégories génériques de recettes
    obsolete = [
        "honoraires-fiduciaires",
        "honoraires-conseil",
        "frais-gestion",
        "frais-performance",
        "autres-produits",
        "loyer-siege",
        "salaires",
        "fournitures",
        "deplacements",
        "honoraires-prestataires",
        "telecom-informatique",
        "assurances",
        "impots-taxes",
        "autres-depenses",
    ]
    MovementCategory.objects.filter(slug__in=obsolete).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0004_seed_movement_categories"),
    ]

    operations = [
        migrations.AddField(
            model_name="movementcategory",
            name="scope",
            field=models.CharField(
                choices=[
                    ("REVENUE", "Recette / chiffre d'affaires"),
                    ("EXPENSE", "Dépense"),
                    ("NEUTRAL", "Neutre"),
                ],
                default="EXPENSE",
                max_length=16,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="movementcategory",
            name="service_type",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="movementcategory",
            name="sort_order",
            field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name="movementcategory",
            options={"ordering": ("sort_order", "slug"), "verbose_name_plural": "movement categories"},
        ),
        migrations.RunPython(reseed_categories, migrations.RunPython.noop),
    ]
