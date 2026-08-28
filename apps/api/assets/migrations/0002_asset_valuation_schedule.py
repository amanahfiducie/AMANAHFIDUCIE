from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("assets", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="asset",
            name="valuation_frequency",
            field=models.CharField(
                choices=[
                    ("MONTHLY", "Mensuelle"),
                    ("QUARTERLY", "Trimestrielle"),
                    ("SEMIANNUAL", "Semestrielle"),
                    ("ANNUAL", "Annuelle"),
                    ("BIENNIAL", "Tous les 2 ans"),
                ],
                default="QUARTERLY",
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="asset",
            name="valuation_next_due",
            field=models.DateField(blank=True, null=True),
        ),
    ]
