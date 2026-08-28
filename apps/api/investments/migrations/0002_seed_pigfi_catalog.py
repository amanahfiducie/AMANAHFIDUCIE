"""Seed catalogue PIGFI."""

from django.db import migrations

from investments.pigfi_catalog import (
    ASSET_CLASSES,
    MANAGEMENT_PROFILES,
    PATRIMONY_CATEGORIES,
)


def seed_catalog(apps, schema_editor):
    AssetClass = apps.get_model("investments", "InvestmentAssetClass")
    Category = apps.get_model("investments", "PatrimonyInvestmentCategory")
    Profile = apps.get_model("investments", "AmanahManagementProfile")

    for slug, label, description, wmin, wmax, order in ASSET_CLASSES:
        AssetClass.objects.update_or_create(
            slug=slug,
            defaults={
                "label": label,
                "description": description,
                "weight_min": wmin,
                "weight_max": wmax,
                "sort_order": order,
                "is_active": True,
            },
        )

    for row in PATRIMONY_CATEGORIES:
        Category.objects.update_or_create(
            code=row["code"],
            defaults={
                "label": row["label"],
                "objective": row["objective"],
                "target_yield_min": row["target_yield_min"],
                "target_yield_max": row["target_yield_max"],
                "allocation_targets": row["allocation_targets"],
                "default_case_types": row["default_case_types"],
                "sort_order": row["sort_order"],
                "is_active": True,
            },
        )

    categories_by_code = {c.code: c for c in Category.objects.all()}
    for row in MANAGEMENT_PROFILES:
        linked = categories_by_code.get(row["linked_category_code"])
        Profile.objects.update_or_create(
            slug=row["slug"],
            defaults={
                "label": row["label"],
                "code_ar": row["code_ar"],
                "description": row["description"],
                "target_yield_min": row["target_yield_min"],
                "target_yield_max": row["target_yield_max"],
                "linked_category": linked,
                "sort_order": row["sort_order"],
                "is_active": True,
            },
        )


class Migration(migrations.Migration):
    dependencies = [
        ("investments", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_catalog, migrations.RunPython.noop),
    ]
