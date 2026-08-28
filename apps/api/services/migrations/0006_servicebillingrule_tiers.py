from django.db import migrations, models


class Migration(migrations.Migration):
    """Aligne l'état Django sur la colonne `tiers` (créée en 0005 si besoin)."""

    dependencies = [
        ("services", "0005_reseed_politique_tarifaire_v1"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.AddField(
                    model_name="servicebillingrule",
                    name="tiers",
                    field=models.JSONField(blank=True, default=list),
                ),
            ],
            database_operations=[],
        ),
    ]
