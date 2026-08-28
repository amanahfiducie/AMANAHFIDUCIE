from django.db import migrations

DEFAULT_CATEGORIES = [
    ("honoraires-fiduciaires", "Honoraires fiduciaires", "INCOME"),
    ("honoraires-conseil", "Honoraires de conseil", "INCOME"),
    ("frais-gestion", "Frais de gestion mandats", "MANAGEMENT_FEE"),
    ("frais-performance", "Frais de performance", "PERFORMANCE_FEE"),
    ("autres-produits", "Autres produits / recettes", "INCOME"),
    ("loyer-siege", "Loyer et charges locatives", "EXPENSE"),
    ("salaires", "Salaires et charges sociales", "EXPENSE"),
    ("fournitures", "Fournitures et consommables", "EXPENSE"),
    ("deplacements", "Déplacements et missions", "EXPENSE"),
    ("honoraires-prestataires", "Honoraires prestataires externes", "EXPENSE"),
    ("telecom-informatique", "Télécoms et informatique", "EXPENSE"),
    ("assurances", "Assurances", "EXPENSE"),
    ("impots-taxes", "Impôts et taxes", "EXPENSE"),
    ("autres-depenses", "Autres dépenses", "EXPENSE"),
    ("virement-interne", "Virement interne", "TRANSFER"),
]


def seed_categories(apps, schema_editor):
    MovementCategory = apps.get_model("finance", "MovementCategory")
    for slug, label, movement_type in DEFAULT_CATEGORIES:
        MovementCategory.objects.get_or_create(
            slug=slug,
            defaults={"label": label, "movement_type": movement_type},
        )


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0003_enterprise_justificatifs"),
    ]

    operations = [
        migrations.RunPython(seed_categories, migrations.RunPython.noop),
    ]
