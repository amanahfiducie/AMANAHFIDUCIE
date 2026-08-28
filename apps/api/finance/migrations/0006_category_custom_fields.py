from django.db import migrations, models

from finance.category_catalog import (
    EXPENSE_CATEGORIES,
    NEUTRAL_CATEGORIES,
    REVENUE_SERVICE_CATEGORIES,
)


def mark_system_categories(apps, schema_editor):
    MovementCategory = apps.get_model("finance", "MovementCategory")
    system_slugs = {
        slug for slug, *_ in REVENUE_SERVICE_CATEGORIES
    } | {slug for slug, *_ in EXPENSE_CATEGORIES} | {
        slug for slug, *_ in NEUTRAL_CATEGORIES
    }
    MovementCategory.objects.filter(slug__in=system_slugs).update(is_system=True)


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0005_category_scope_services"),
    ]

    operations = [
        migrations.AddField(
            model_name="movementcategory",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="movementcategory",
            name="is_system",
            field=models.BooleanField(default=False),
        ),
        migrations.RunPython(mark_system_categories, migrations.RunPython.noop),
    ]
