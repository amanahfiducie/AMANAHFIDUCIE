from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("beneficiaries", "0005_beneficiary_guardian"),
    ]

    operations = [
        migrations.AddField(
            model_name="beneficiary",
            name="patrimony_share_percent",
            field=models.DecimalField(
                blank=True,
                decimal_places=4,
                help_text="Part du patrimoine du dossier (0–100 %).",
                max_digits=7,
                null=True,
            ),
        ),
    ]
